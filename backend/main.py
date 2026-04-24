from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
from pydantic_settings import BaseSettings
from typing import Optional, List
from datetime import datetime, date, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from passlib.exc import UnknownHashError
import os
import shutil
import uuid
import io
import logging
from logging.handlers import RotatingFileHandler

from pdf_generator import generate_delivery_pdf

# Setup logging
os.makedirs("/var/log/stock_management", exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        RotatingFileHandler(
            "/var/log/stock_management/app.log",
            maxBytes=10485760,  # 10MB
            backupCount=5
        ),
        logging.StreamHandler()  # Also log to stdout
    ]
)
logger = logging.getLogger(__name__)

# Settings
class Settings(BaseSettings):
    database_url: str = "postgresql://stockadmin:stockpass123@localhost:5432/stock_management"
    secret_key: str = "your-super-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    class Config:
        env_file = ".env"

settings = Settings()

# Database
engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Ensure optional columns exist for new fields
with engine.begin() as conn:
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS company_settings (
            id INTEGER PRIMARY KEY,
            name_th TEXT,
            name_en TEXT,
            address TEXT,
            tax_id TEXT,
            tel TEXT,
            fax TEXT,
            email TEXT,
            logo TEXT,
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(text("INSERT INTO company_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING"))
    conn.execute(text("ALTER TABLE IF EXISTS company_settings ADD COLUMN IF NOT EXISTS email TEXT"))
    conn.execute(text("ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS tax_id VARCHAR(30)"))
    conn.execute(text("ALTER TABLE IF EXISTS suppliers ADD COLUMN IF NOT EXISTS tax_id VARCHAR(30)"))
    conn.execute(text("ALTER TABLE IF EXISTS delivery_items ADD COLUMN IF NOT EXISTS note TEXT"))
    conn.execute(text("ALTER TABLE IF EXISTS users ALTER COLUMN email DROP NOT NULL"))
    conn.execute(text("ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS phone VARCHAR(30)"))
    # Ensure `customers.id` has a default sequence (fix when table was created without SERIAL default)
    try:
        # Ensure sequences/defaults for common tables with SERIAL-like ids
        tables = [
            "customers",
            "deliveries",
            "delivery_items",
            "suppliers",
            "products",
            "purchases",
            "purchase_items",
            "movements",
            "users",
        ]
        for t in tables:
            try:
                row = conn.execute(text("""
                    SELECT column_default, is_identity
                    FROM information_schema.columns
                    WHERE table_name = :table AND column_name = 'id'
                """), {"table": t}).fetchone()
                if not row:
                    continue
                col_default, is_identity = row
                if is_identity == "YES" or col_default:
                    continue
                seq = f"{t}_id_seq"
                conn.execute(text(f"CREATE SEQUENCE IF NOT EXISTS {seq}"))
                conn.execute(text(f"ALTER TABLE {t} ALTER COLUMN id SET DEFAULT nextval('{seq}'::regclass)"))
                conn.execute(text(f"SELECT setval('{seq}', COALESCE((SELECT MAX(id) FROM {t}), 1), true)"))
            except Exception:
                # best-effort; do not block app startup
                continue
    except Exception:
        # If tables don't exist yet or any permission issue, skip sequence fixes
        pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_table_id_sequence(db: Session, table: str):
    # Check if id column has a default or identity; if not, create/attach a sequence
    row = db.execute(text("""
        SELECT column_default, is_identity
        FROM information_schema.columns
        WHERE table_name = :table AND column_name = 'id'
    """), {"table": table}).fetchone()
    if not row:
        return
    col_default, is_identity = row
    if is_identity == "YES" or col_default:
        return
    seq = f"{table}_id_seq"
    db.execute(text(f"CREATE SEQUENCE IF NOT EXISTS {seq}"))
    db.execute(text(f"ALTER TABLE {table} ALTER COLUMN id SET DEFAULT nextval('{seq}'::regclass)"))
    db.execute(text(f"SELECT setval('{seq}', COALESCE((SELECT MAX(id) FROM {table}), 1), true)"))

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

def verify_password(plain_password, hashed_password):
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except (UnknownHashError, ValueError, TypeError):
        return False

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    # JWT spec requires subject to be a string; convert here to avoid jose JWTClaimsError
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id_value = payload.get("sub")
        user_id = int(user_id_value) if user_id_value is not None else None
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    result = db.execute(text("SELECT * FROM users WHERE id = :id AND is_active = true"), {"id": user_id})
    user = result.fetchone()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def require_admin(user):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user

def normalize_optional_str(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value if value else None

# Pydantic Models
class LoginRequest(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str
    full_name: str
    role: str = "staff"

class UserUpdate(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None

class UserStatusUpdate(BaseModel):
    is_active: bool

class CompanySettingsUpdate(BaseModel):
    nameTh: Optional[str] = None
    nameEn: Optional[str] = None
    address: Optional[str] = None
    taxId: Optional[str] = None
    tel: Optional[str] = None
    fax: Optional[str] = None
    email: Optional[str] = None
    logo: Optional[str] = None

class ProductCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    unit: str = "ชิ้น"
    min_stock: int = 0
    image_url: Optional[str] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    unit: Optional[str] = None
    min_stock: Optional[int] = None
    is_active: Optional[bool] = None
    image_url: Optional[str] = None

class SupplierCreate(BaseModel):
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None

class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None
    is_active: Optional[bool] = None

class CustomerCreate(BaseModel):
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None
    is_active: Optional[bool] = None

class PurchaseItemCreate(BaseModel):
    product_id: int
    quantity: int
    unit_price: float = 0

class PurchaseCreate(BaseModel):
    invoice_number: str
    supplier_id: int
    purchase_date: date
    notes: Optional[str] = None
    attachment_url: Optional[str] = None
    items: List[PurchaseItemCreate]

class DeliveryItemCreate(BaseModel):
    product_id: int
    quantity: int
    note: Optional[str] = None

class DeliveryCreate(BaseModel):
    customer_id: int
    delivery_date: date
    notes: Optional[str] = None
    items: List[DeliveryItemCreate]

class DeliveryUpdate(BaseModel):
    customer_id: Optional[int] = None
    delivery_date: Optional[date] = None
    notes: Optional[str] = None
    items: Optional[List[DeliveryItemCreate]] = None

class ManualStockIn(BaseModel):
    product_id: int
    quantity: int
    notes: Optional[str] = None

# FastAPI App
app = FastAPI(title="Stock Management API", version="1.0.0")

@app.on_event("startup")
async def startup_event():
    logger.info("=== Stock Management API Starting ===")
    logger.info(f"Database URL: {settings.database_url.split('@')[1] if '@' in settings.database_url else 'configured'}")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("=== Stock Management API Shutting Down ===")

@app.middleware("http")
async def log_requests(request, call_next):
    logger.info(f"{request.method} {request.url.path}")
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        logger.error(f"Request failed: {request.method} {request.url.path} - {str(e)}", exc_info=True)
        raise

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded images
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
# Also serve uploads under /api/uploads to support older client URLs
app.mount("/api/uploads", StaticFiles(directory="uploads"), name="api_uploads")

# Auth Routes
@app.post("/api/auth/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    logger.info(f"Login attempt for user: {request.username}")
    result = db.execute(
        text("SELECT * FROM users WHERE username = :username AND is_active = true"),
        {"username": request.username}
    )
    user = result.fetchone()

    if not user or not verify_password(request.password, user.password_hash):
        logger.warning(f"Failed login attempt for user: {request.username}")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    logger.info(f"Successful login for user: {request.username}")
    token = create_access_token({"sub": user.id})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "phone": user.phone,
            "full_name": user.full_name,
            "role": user.role
        }
    }

@app.get("/api/auth/me")
def get_me(user = Depends(get_current_user)):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "phone": user.phone,
        "full_name": user.full_name,
        "role": user.role
    }

# Dashboard
@app.get("/api/dashboard")
def get_dashboard(
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    # จำนวนสินค้า
    total_products = db.execute(
        text("SELECT COUNT(*) FROM products WHERE is_active = true")
    ).scalar()

    # สินค้าที่ stock ต่ำกว่าขั้นต่ำ
    low_stock_query = """
        SELECT
            p.id,
            p.code,
            p.name,
            p.unit,
            p.min_stock,
            COALESCE(
                SUM(
                    CASE
                        WHEN m.movement_type = 'IN' THEN m.quantity
                        ELSE -m.quantity
                    END
                ),
                0
            ) AS current_stock
        FROM products p
        LEFT JOIN movements m ON p.id = m.product_id
        WHERE p.is_active = true
        GROUP BY
            p.id,
            p.code,
            p.name,
            p.unit,
            p.min_stock
        HAVING COALESCE(
                SUM(
                    CASE
                        WHEN m.movement_type = 'IN' THEN m.quantity
                        ELSE -m.quantity
                    END
                ),
                0
            ) <= p.min_stock
        ORDER BY p.name
    """
    low_stock_rows = db.execute(text(low_stock_query)).fetchall()
    low_stock = [dict(row._mapping) for row in low_stock_rows]

    # movement ล่าสุด
    recent_movements_rows = db.execute(text("""
        SELECT
            m.*,
            p.name AS product_name,
            p.code AS product_code,
            u.full_name AS user_name
        FROM movements m
        JOIN products p ON m.product_id = p.id
        LEFT JOIN users u ON m.created_by = u.id
        ORDER BY m.created_at DESC
        LIMIT 10
    """)).fetchall()
    recent_movements = [dict(row._mapping) for row in recent_movements_rows]

    # จำนวนลูกค้า/ซัพพลายเออร์
    total_customers = db.execute(
        text("SELECT COUNT(*) FROM customers WHERE is_active = true")
    ).scalar()
    total_suppliers = db.execute(
        text("SELECT COUNT(*) FROM suppliers WHERE is_active = true")
    ).scalar()

    return {
        "total_products": total_products,
        "low_stock_count": len(low_stock),
        "low_stock_products": low_stock,
        "recent_movements": recent_movements,
        "total_customers": total_customers,
        "total_suppliers": total_suppliers,
    }

# Products
@app.get("/api/products")
def get_products(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    query = """
        SELECT
            p.id,
            p.code,
            p.name,
            p.description,
            p.unit,
            p.min_stock,
            p.image_url,
            p.is_active,
            p.created_at,
            p.updated_at,
            COALESCE(
                SUM(
                    CASE
                        WHEN m.movement_type = 'IN' THEN m.quantity
                        ELSE -m.quantity
                    END
                ),
                0
            ) AS current_stock
        FROM products p
        LEFT JOIN movements m ON p.id = m.product_id
        WHERE p.is_active = true
    """

    params = {}

    if search:
        query += """
            AND (p.name ILIKE :search OR p.code ILIKE :search)
        """
        params["search"] = f"%{search}%"

    query += """
        GROUP BY
            p.id,
            p.code,
            p.name,
            p.description,
            p.unit,
            p.min_stock,
            p.image_url,
            p.is_active,
            p.created_at,
            p.updated_at
        ORDER BY p.name
    """

    result = db.execute(text(query), params)
    return [dict(row._mapping) for row in result.fetchall()]

@app.get("/api/products/{product_id}")
def get_product(product_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    result = db.execute(text("""
        SELECT p.*, 
            COALESCE(SUM(CASE WHEN m.movement_type = 'IN' THEN m.quantity ELSE -m.quantity END), 0) as current_stock
        FROM products p
        LEFT JOIN movements m ON p.id = m.product_id
        WHERE p.id = :id
        GROUP BY p.id
    """), {"id": product_id})
    product = result.fetchone()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return dict(product._mapping)

@app.post("/api/products")
def create_product(product: ProductCreate, db: Session = Depends(get_db), user = Depends(get_current_user)):
    result = db.execute(text("""
        INSERT INTO products (code, name, description, unit, min_stock, image_url)
        VALUES (:code, :name, :description, :unit, :min_stock, :image_url)
        RETURNING *
    """), product.model_dump())
    db.commit()
    return dict(result.fetchone()._mapping)

@app.put("/api/products/{product_id}")
def update_product(product_id: int, product: ProductUpdate, db: Session = Depends(get_db), user = Depends(get_current_user)):
    updates = {k: v for k, v in product.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    set_clause = ", ".join([f"{k} = :{k}" for k in updates.keys()])
    updates["id"] = product_id
    updates["updated_at"] = datetime.now()
    
    result = db.execute(text(f"""
        UPDATE products SET {set_clause}, updated_at = :updated_at WHERE id = :id RETURNING *
    """), updates)
    db.commit()
    
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Product not found")
    return dict(row._mapping)

@app.delete("/api/products/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    result = db.execute(text("""
        UPDATE products SET is_active = false, updated_at = :now WHERE id = :id RETURNING id
    """), {"id": product_id, "now": datetime.now()})
    db.commit()
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}

# Reports
@app.get("/api/reports/stock")
def report_stock(db: Session = Depends(get_db), user = Depends(get_current_user)):
    query = """
        SELECT
            p.*,
            COALESCE(s.current_stock, 0) AS current_stock
        FROM products p
        LEFT JOIN (
            SELECT
                product_id,
                SUM(
                    CASE
                        WHEN movement_type = 'IN' THEN quantity
                        ELSE -quantity
                    END
                ) AS current_stock
            FROM movements
            GROUP BY product_id
        ) AS s
            ON p.id = s.product_id
        WHERE p.is_active = TRUE
        ORDER BY p.name;
    """
    result = db.execute(text(query))
    return [dict(row._mapping) for row in result.fetchall()]

@app.get("/api/reports/purchases")
def report_purchases(
    supplier_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    conditions = ["1=1"]
    params = {}
    if supplier_id:
        conditions.append("p.supplier_id = :supplier_id")
        params["supplier_id"] = supplier_id
    if start_date:
        conditions.append("p.purchase_date >= :start_date")
        params["start_date"] = start_date
    if end_date:
        conditions.append("p.purchase_date <= :end_date")
        params["end_date"] = end_date
    where_clause = " AND ".join(conditions)

    rows = db.execute(text(f"""
        SELECT p.id, p.invoice_number, p.purchase_date, p.total_amount, p.notes,
               s.name AS supplier_name
        FROM purchases p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        WHERE {where_clause}
        ORDER BY p.purchase_date DESC, p.id DESC
    """), params).fetchall()

    total_amount = db.execute(text(f"""
        SELECT COALESCE(SUM(p.total_amount), 0) AS total
        FROM purchases p
        WHERE {where_clause}
    """), params).scalar()

    return {
        "total_amount": float(total_amount or 0),
        "rows": [dict(r._mapping) for r in rows],
    }

# Image Upload
@app.post("/api/upload-image")
def upload_image(file: UploadFile = File(...)):
    logger.info(f"Image upload: {file.filename}, size: {file.size if hasattr(file, 'size') else 'unknown'}")
    ext = os.path.splitext(file.filename)[1].lower()
    filename = f"{uuid.uuid4().hex}{ext}"
    save_path = os.path.join("uploads", filename)
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    logger.info(f"Image uploaded successfully: {filename}")
    return {"url": f"/uploads/{filename}"}

# Suppliers
@app.get("/api/suppliers")
def get_suppliers(db: Session = Depends(get_db), user = Depends(get_current_user)):
    result = db.execute(text("SELECT * FROM suppliers WHERE is_active = true ORDER BY name"))
    return [dict(row._mapping) for row in result.fetchall()]

@app.post("/api/suppliers")
def create_supplier(supplier: SupplierCreate, db: Session = Depends(get_db), user = Depends(get_current_user)):
    ensure_table_id_sequence(db, "suppliers")
    data = supplier.model_dump()
    data["name"] = data["name"].strip()
    if not data["name"]:
        raise HTTPException(status_code=400, detail="Name is required")
    for key in ["contact_person", "phone", "email", "address", "tax_id"]:
        data[key] = normalize_optional_str(data.get(key))
    result = db.execute(text("""
        INSERT INTO suppliers (name, contact_person, phone, email, address, tax_id)
        VALUES (:name, :contact_person, :phone, :email, :address, :tax_id)
        RETURNING *
    """), data)
    db.commit()
    return dict(result.fetchone()._mapping)

@app.put("/api/suppliers/{supplier_id}")
def update_supplier(supplier_id: int, data: SupplierUpdate, db: Session = Depends(get_db), user = Depends(get_current_user)):
    updates = data.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    if "name" in updates:
        updates["name"] = updates["name"].strip()
        if not updates["name"]:
            raise HTTPException(status_code=400, detail="Name is required")
    for key in ["contact_person", "phone", "email", "address", "tax_id"]:
        if key in updates:
            updates[key] = normalize_optional_str(updates[key])
    updates["id"] = supplier_id
    updates["updated_at"] = datetime.now()
    set_clause = ", ".join([f"{k} = :{k}" for k in updates.keys() if k != "id"])
    result = db.execute(text(f"""
        UPDATE suppliers SET {set_clause} WHERE id = :id RETURNING *
    """), updates)
    db.commit()
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return dict(row._mapping)

@app.delete("/api/suppliers/{supplier_id}")
def delete_supplier(supplier_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    result = db.execute(text("""
        UPDATE suppliers SET is_active = false, updated_at = :now WHERE id = :id RETURNING id
    """), {"id": supplier_id, "now": datetime.now()})
    db.commit()
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return {"message": "Supplier deleted"}

# Customers
@app.get("/api/customers")
def get_customers(db: Session = Depends(get_db), user = Depends(get_current_user)):
    result = db.execute(text("SELECT * FROM customers WHERE is_active = true ORDER BY name"))
    return [dict(row._mapping) for row in result.fetchall()]

@app.post("/api/customers")
def create_customer(customer: CustomerCreate, db: Session = Depends(get_db), user = Depends(get_current_user)):
    result = db.execute(text("""
        INSERT INTO customers (name, contact_person, phone, email, address, tax_id)
        VALUES (:name, :contact_person, :phone, :email, :address, :tax_id)
        RETURNING *
    """), customer.model_dump())
    db.commit()
    return dict(result.fetchone()._mapping)

@app.put("/api/customers/{customer_id}")
def update_customer(customer_id: int, data: CustomerUpdate, db: Session = Depends(get_db), user = Depends(get_current_user)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates["id"] = customer_id
    updates["updated_at"] = datetime.now()
    set_clause = ", ".join([f"{k} = :{k}" for k in updates.keys() if k != "id"])
    result = db.execute(text(f"""
        UPDATE customers SET {set_clause} WHERE id = :id RETURNING *
    """), updates)
    db.commit()
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Customer not found")
    return dict(row._mapping)

@app.delete("/api/customers/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    result = db.execute(text("""
        UPDATE customers SET is_active = false, updated_at = :now WHERE id = :id RETURNING id
    """), {"id": customer_id, "now": datetime.now()})
    db.commit()
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer deleted"}

# Users
@app.get("/api/users")
def get_users(db: Session = Depends(get_db), user = Depends(get_current_user)):
    result = db.execute(text("SELECT id, username, email, phone, full_name, role, is_active, created_at FROM users ORDER BY created_at DESC"))
    return [dict(row._mapping) for row in result.fetchall()]

@app.post("/api/users")
def create_user(user_data: UserCreate, db: Session = Depends(get_db), user = Depends(get_current_user)):
    require_admin(user)
    password_hash = get_password_hash(user_data.password)
    email_value = user_data.email.strip() if user_data.email else None
    if email_value == "":
        email_value = None
    phone_value = normalize_optional_str(user_data.phone)
    result = db.execute(text("""
        INSERT INTO users (username, email, phone, password_hash, full_name, role)
        VALUES (:username, :email, :phone, :password_hash, :full_name, :role)
        RETURNING id, username, email, phone, full_name, role, is_active
    """), {
        "username": user_data.username,
        "email": email_value,
        "phone": phone_value,
        "password_hash": password_hash,
        "full_name": user_data.full_name,
        "role": user_data.role
    })
    db.commit()
    return dict(result.fetchone()._mapping)

@app.put("/api/users/{user_id}")
def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db), user = Depends(get_current_user)):
    require_admin(user)
    updates = {}

    if data.email is not None:
        updates["email"] = normalize_optional_str(data.email)
    if data.phone is not None:
        updates["phone"] = normalize_optional_str(data.phone)
    if data.full_name is not None:
        updates["full_name"] = data.full_name.strip()
    if data.role is not None:
        if data.role not in ("admin", "staff"):
            raise HTTPException(status_code=400, detail="Invalid role")
        updates["role"] = data.role
    if data.password:
        updates["password_hash"] = get_password_hash(data.password)

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clause = ", ".join([f"{key} = :{key}" for key in updates.keys()]) + ", updated_at = :now"
    params = {**updates, "id": user_id, "now": datetime.now()}
    result = db.execute(text(f"""
        UPDATE users
        SET {set_clause}
        WHERE id = :id
        RETURNING id, username, email, phone, full_name, role, is_active
    """), params)
    db.commit()
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(row._mapping)

@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    require_admin(user)
    if user_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    result = db.execute(text("""
        UPDATE users SET is_active = false, updated_at = :now WHERE id = :id RETURNING id
    """), {"id": user_id, "now": datetime.now()})
    db.commit()
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}

@app.put("/api/users/{user_id}/status")
def update_user_status(user_id: int, data: UserStatusUpdate, db: Session = Depends(get_db), user = Depends(get_current_user)):
    require_admin(user)
    if user_id == user.id and data.is_active is False:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    result = db.execute(text("""
        UPDATE users SET is_active = :is_active, updated_at = :now WHERE id = :id
        RETURNING id, is_active
    """), {"id": user_id, "is_active": data.is_active, "now": datetime.now()})
    db.commit()
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return {"id": row.id, "is_active": row.is_active}

def format_company_settings(row):
    if not row:
        return {
            "nameTh": "",
            "nameEn": "",
            "address": "",
            "taxId": "",
            "tel": "",
            "fax": "",
            "email": "",
            "logo": "",
        }
    return {
        "nameTh": row.name_th or "",
        "nameEn": row.name_en or "",
        "address": row.address or "",
        "taxId": row.tax_id or "",
        "tel": row.tel or "",
        "fax": row.fax or "",
        "email": row.email or "",
        "logo": row.logo or "",
    }

@app.get("/api/company-settings")
def get_company_settings(db: Session = Depends(get_db)):
    row = db.execute(text("""
        SELECT name_th, name_en, address, tax_id, tel, fax, email, logo
        FROM company_settings
        WHERE id = 1
    """)).fetchone()
    if not row:
        db.execute(text("INSERT INTO company_settings (id) VALUES (1)"))
        db.commit()
        row = db.execute(text("""
            SELECT name_th, name_en, address, tax_id, tel, fax, email, logo
            FROM company_settings
            WHERE id = 1
        """)).fetchone()
    return format_company_settings(row)

@app.put("/api/company-settings")
def update_company_settings(
    data: CompanySettingsUpdate,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    require_admin(user)
    row = db.execute(text("""
        SELECT name_th, name_en, address, tax_id, tel, fax, email, logo
        FROM company_settings
        WHERE id = 1
    """)).fetchone()
    current = format_company_settings(row)
    payload = {
        "name_th": data.nameTh if data.nameTh is not None else current["nameTh"],
        "name_en": data.nameEn if data.nameEn is not None else current["nameEn"],
        "address": data.address if data.address is not None else current["address"],
        "tax_id": data.taxId if data.taxId is not None else current["taxId"],
        "tel": data.tel if data.tel is not None else current["tel"],
        "fax": data.fax if data.fax is not None else current["fax"],
        "email": data.email if data.email is not None else current["email"],
        "logo": data.logo if data.logo is not None else current["logo"],
        "updated_at": datetime.now(),
    }
    db.execute(text("""
        INSERT INTO company_settings (id, name_th, name_en, address, tax_id, tel, fax, email, logo, updated_at)
        VALUES (1, :name_th, :name_en, :address, :tax_id, :tel, :fax, :email, :logo, :updated_at)
        ON CONFLICT (id) DO UPDATE SET
            name_th = EXCLUDED.name_th,
            name_en = EXCLUDED.name_en,
            address = EXCLUDED.address,
            tax_id = EXCLUDED.tax_id,
            tel = EXCLUDED.tel,
            fax = EXCLUDED.fax,
            email = EXCLUDED.email,
            logo = EXCLUDED.logo,
            updated_at = EXCLUDED.updated_at
    """), payload)
    db.commit()
    return {
        "nameTh": payload["name_th"] or "",
        "nameEn": payload["name_en"] or "",
        "address": payload["address"] or "",
        "taxId": payload["tax_id"] or "",
        "tel": payload["tel"] or "",
        "fax": payload["fax"] or "",
        "email": payload["email"] or "",
        "logo": payload["logo"] or "",
    }

# Purchases (Stock IN)
@app.get("/api/purchases")
def get_purchases(db: Session = Depends(get_db), user = Depends(get_current_user)):
    result = db.execute(text("""
        SELECT p.*, s.name as supplier_name, u.full_name as created_by_name,
            COALESCE(pi_sum.total_qty, 0) AS total_qty
        FROM purchases p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN users u ON p.created_by = u.id
        LEFT JOIN (
            SELECT purchase_id, SUM(quantity) AS total_qty
            FROM purchase_items
            GROUP BY purchase_id
        ) pi_sum ON pi_sum.purchase_id = p.id
        ORDER BY p.created_at DESC
    """))
    return [dict(row._mapping) for row in result.fetchall()]

@app.get("/api/purchases/{purchase_id}")
def get_purchase_detail(purchase_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    purchase = db.execute(text("""
        SELECT p.*, s.name as supplier_name, u.full_name as created_by_name
        FROM purchases p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN users u ON p.created_by = u.id
        WHERE p.id = :id
    """), {"id": purchase_id}).fetchone()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")

    items = db.execute(text("""
        SELECT pi.*, pr.code AS product_code, pr.name AS product_name, pr.unit
        FROM purchase_items pi
        JOIN products pr ON pi.product_id = pr.id
        WHERE pi.purchase_id = :id
    """), {"id": purchase_id}).fetchall()

    return {
        "purchase": dict(purchase._mapping),
        "items": [dict(i._mapping) for i in items],
    }

@app.delete("/api/purchases/{purchase_id}")
def delete_purchase(purchase_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    require_admin(user)
    purchase = db.execute(text("SELECT id FROM purchases WHERE id = :id"), {"id": purchase_id}).fetchone()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    db.execute(
        text("DELETE FROM movements WHERE reference_type = 'purchase' AND reference_id = :id"),
        {"id": purchase_id},
    )
    db.execute(text("DELETE FROM purchases WHERE id = :id"), {"id": purchase_id})
    db.commit()
    return {"message": "Purchase deleted"}

@app.post("/api/purchases")
def create_purchase(purchase: PurchaseCreate, db: Session = Depends(get_db), user = Depends(get_current_user)):
    logger.info(f"Creating purchase: invoice={purchase.invoice_number}, supplier_id={purchase.supplier_id}, items={len(purchase.items)}")
    ensure_table_id_sequence(db, "purchases")
    ensure_table_id_sequence(db, "purchase_items")
    ensure_table_id_sequence(db, "movements")
    result = db.execute(text("""
        INSERT INTO purchases (invoice_number, supplier_id, purchase_date, notes, attachment_url, created_by, status)
        VALUES (:invoice_number, :supplier_id, :purchase_date, :notes, :attachment_url, :created_by, 'confirmed')
        RETURNING *
    """), {
        "invoice_number": purchase.invoice_number,
        "supplier_id": purchase.supplier_id,
        "purchase_date": purchase.purchase_date,
        "notes": purchase.notes,
        "attachment_url": purchase.attachment_url,
        "created_by": user.id
    })
    purchase_row = result.fetchone()
    purchase_id = purchase_row.id
    
    total_amount = 0
    for item in purchase.items:
        db.execute(text("""
            INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_price)
            VALUES (:purchase_id, :product_id, :quantity, :unit_price)
        """), {
            "purchase_id": purchase_id,
            "product_id": item.product_id,
            "quantity": item.quantity,
            "unit_price": item.unit_price
        })
        
        db.execute(text("""
            INSERT INTO movements (product_id, movement_type, quantity, reference_type, reference_id, created_by)
            VALUES (:product_id, 'IN', :quantity, 'purchase', :reference_id, :created_by)
        """), {
            "product_id": item.product_id,
            "quantity": item.quantity,
            "reference_id": purchase_id,
            "created_by": user.id
        })
        
        total_amount += item.quantity * item.unit_price
    
    db.execute(text("UPDATE purchases SET total_amount = :amount WHERE id = :id"), 
               {"amount": total_amount, "id": purchase_id})
    
    db.commit()
    return {"id": purchase_id, "message": "Purchase created successfully"}

# Manual Stock IN
@app.post("/api/stock/manual-in")
def manual_stock_in(data: ManualStockIn, db: Session = Depends(get_db), user = Depends(get_current_user)):
    ensure_table_id_sequence(db, "movements")
    db.execute(text("""
        INSERT INTO movements (product_id, movement_type, quantity, reference_type, notes, created_by)
        VALUES (:product_id, 'IN', :quantity, 'manual', :notes, :created_by)
    """), {
        "product_id": data.product_id,
        "quantity": data.quantity,
        "notes": data.notes,
        "created_by": user.id
    })
    db.commit()
    return {"message": "Stock added successfully"}

# Deliveries (Stock OUT)
@app.get("/api/deliveries")
def get_deliveries(
    status: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    query = """
        SELECT d.*, c.name as customer_name, 
            u1.full_name as created_by_name,
            u2.full_name as confirmed_by_name
        FROM deliveries d
        LEFT JOIN customers c ON d.customer_id = c.id
        LEFT JOIN users u1 ON d.created_by = u1.id
        LEFT JOIN users u2 ON d.confirmed_by = u2.id
    """
    params = {}
    conditions = []
    if status:
        conditions.append("d.status = :status")
        params["status"] = status
    if start_date:
        conditions.append("d.delivery_date >= :start_date")
        params["start_date"] = start_date
    if end_date:
        conditions.append("d.delivery_date <= :end_date")
        params["end_date"] = end_date
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY d.created_at DESC"
    
    result = db.execute(text(query), params)
    return [dict(row._mapping) for row in result.fetchall()]

@app.get("/api/deliveries/{delivery_id}")
def get_delivery(delivery_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    result = db.execute(text("""
        SELECT d.*, c.name as customer_name, c.address as customer_address,
            c.phone as customer_phone, c.contact_person as customer_contact_person,
            u1.full_name as created_by_name, u1.phone as created_by_phone
        FROM deliveries d
        LEFT JOIN customers c ON d.customer_id = c.id
        LEFT JOIN users u1 ON d.created_by = u1.id
        WHERE d.id = :id
    """), {"id": delivery_id})
    delivery = result.fetchone()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    
    items = db.execute(text("""
        SELECT di.*, p.code as product_code, p.name as product_name, p.unit, p.image_url
        FROM delivery_items di
        JOIN products p ON di.product_id = p.id
        WHERE di.delivery_id = :id
    """), {"id": delivery_id})
    
    return {
        **dict(delivery._mapping),
        "items": [dict(row._mapping) for row in items.fetchall()]
    }

@app.get("/api/deliveries/{delivery_id}/pdf")
def get_delivery_pdf(delivery_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    delivery = get_delivery(delivery_id, db, user)
    company = get_company_settings(db)
    pdf_bytes = generate_delivery_pdf(delivery, company)
    filename = f"delivery-{delivery_id}.pdf"
    headers = {"Content-Disposition": f"inline; filename={filename}"}
    return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf", headers=headers)

@app.post("/api/deliveries")
def create_delivery(delivery: DeliveryCreate, db: Session = Depends(get_db), user = Depends(get_current_user)):
    today = datetime.now().strftime("%Y%m%d")
    count = db.execute(text(
        "SELECT COUNT(*) FROM deliveries WHERE delivery_number LIKE :pattern"
    ), {"pattern": f"DO-{today}%"}).scalar()
    delivery_number = f"DO-{today}-{str(count + 1).zfill(4)}"
    
    # ensure id default/sequence exists for deliveries table (fix for missing SERIAL defaults)
    ensure_table_id_sequence(db, "deliveries")

    result = db.execute(text("""
        INSERT INTO deliveries (delivery_number, customer_id, delivery_date, notes, created_by, status)
        VALUES (:delivery_number, :customer_id, :delivery_date, :notes, :created_by, 'draft')
        RETURNING *
    """), {
        "delivery_number": delivery_number,
        "customer_id": delivery.customer_id,
        "delivery_date": delivery.delivery_date,
        "notes": delivery.notes,
        "created_by": user.id
    })
    delivery_row = result.fetchone()
    delivery_id = delivery_row.id
    
    for item in delivery.items:
        # ensure delivery_items id default exists before inserting rows
        ensure_table_id_sequence(db, "delivery_items")
        db.execute(text("""
            INSERT INTO delivery_items (delivery_id, product_id, quantity, note)
            VALUES (:delivery_id, :product_id, :quantity, :note)
        """), {
            "delivery_id": delivery_id,
            "product_id": item.product_id,
            "quantity": item.quantity,
            "note": item.note
        })
    
    db.commit()
    return {"id": delivery_id, "delivery_number": delivery_number, "message": "Delivery created"}

@app.put("/api/deliveries/{delivery_id}")
def update_delivery(delivery_id: int, data: DeliveryUpdate, db: Session = Depends(get_db), user = Depends(get_current_user)):
    current = db.execute(text("SELECT * FROM deliveries WHERE id = :id"), {"id": delivery_id}).fetchone()
    if not current:
        raise HTTPException(status_code=404, detail="Delivery not found")
    if current.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft delivery can be updated")

    updates = {
        "customer_id": data.customer_id if data.customer_id is not None else current.customer_id,
        "delivery_date": data.delivery_date if data.delivery_date is not None else current.delivery_date,
        "notes": data.notes if data.notes is not None else current.notes,
        "id": delivery_id,
        "updated_at": datetime.now(),
    }
    db.execute(text("""
        UPDATE deliveries
        SET customer_id = :customer_id,
            delivery_date = :delivery_date,
            notes = :notes,
            updated_at = :updated_at
        WHERE id = :id
    """), updates)

    if data.items is not None:
        db.execute(text("DELETE FROM delivery_items WHERE delivery_id = :id"), {"id": delivery_id})
        for item in data.items:
            db.execute(text("""
                INSERT INTO delivery_items (delivery_id, product_id, quantity, note)
                VALUES (:delivery_id, :product_id, :quantity, :note)
            """), {
                "delivery_id": delivery_id,
                "product_id": item.product_id,
                "quantity": item.quantity,
                "note": item.note
            })
    db.commit()
    return {"message": "Delivery updated"}

@app.post("/api/deliveries/{delivery_id}/confirm")
def confirm_delivery(delivery_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    logger.info(f"Confirming delivery: delivery_id={delivery_id}, user={user.username}")
    delivery = db.execute(text("SELECT * FROM deliveries WHERE id = :id"), {"id": delivery_id}).fetchone()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    if delivery.status != 'draft':
        raise HTTPException(status_code=400, detail="Delivery already confirmed or cancelled")
    
    items = db.execute(text("SELECT * FROM delivery_items WHERE delivery_id = :id"), {"id": delivery_id}).fetchall()
    
    for item in items:
        db.execute(text("""
            INSERT INTO movements (product_id, movement_type, quantity, reference_type, reference_id, created_by)
            VALUES (:product_id, 'OUT', :quantity, 'delivery', :reference_id, :created_by)
        """), {
            "product_id": item.product_id,
            "quantity": item.quantity,
            "reference_id": delivery_id,
            "created_by": user.id
        })
    
    db.execute(text("""
        UPDATE deliveries SET status = 'confirmed', confirmed_by = :user_id, confirmed_at = :now
        WHERE id = :id
    """), {"id": delivery_id, "user_id": user.id, "now": datetime.now()})
    
    db.commit()
    return {"message": "Delivery confirmed, stock deducted"}

@app.delete("/api/deliveries/{delivery_id}")
def delete_delivery(delivery_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    delivery = db.execute(text("SELECT status FROM deliveries WHERE id = :id"), {"id": delivery_id}).fetchone()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    if delivery.status != "draft" and user.role != "admin":
        raise HTTPException(status_code=400, detail="Only draft delivery can be deleted")
    db.execute(text("DELETE FROM delivery_items WHERE delivery_id = :id"), {"id": delivery_id})
    db.execute(text("DELETE FROM deliveries WHERE id = :id"), {"id": delivery_id})
    db.commit()
    return {"message": "Delivery deleted"}

# Stock Movements
@app.get("/api/movements")
def get_movements(product_id: Optional[int] = None, db: Session = Depends(get_db), user = Depends(get_current_user)):
    query = """
        SELECT m.*, p.name as product_name, p.code as product_code, u.full_name as user_name
        FROM movements m
        JOIN products p ON m.product_id = p.id
        LEFT JOIN users u ON m.created_by = u.id
    """
    params = {}
    if product_id:
        query += " WHERE m.product_id = :product_id"
        params["product_id"] = product_id
    query += " ORDER BY m.created_at DESC"
    
    result = db.execute(text(query), params)
    return [dict(row._mapping) for row in result.fetchall()]

@app.get("/api/stock-card/{product_id}")
def get_stock_card(product_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    product = db.execute(text("SELECT * FROM products WHERE id = :id"), {"id": product_id}).fetchone()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    movements = db.execute(text("""
        SELECT m.*, u.full_name as user_name
        FROM movements m
        LEFT JOIN users u ON m.created_by = u.id
        WHERE m.product_id = :product_id
        ORDER BY m.created_at ASC
    """), {"product_id": product_id}).fetchall()
    
    stock_card = []
    balance = 0
    for m in movements:
        if m.movement_type == "IN":
            balance += m.quantity
        else:
            balance -= m.quantity
        stock_card.append({
            **dict(m._mapping),
            "balance": balance
        })
    
    return {
        "product": dict(product._mapping),
        "movements": stock_card,
        "current_stock": balance
    }

# Health check
@app.get("/health")
def health_check():
    return {"status": "healthy"}
@app.get("/api/health")
def api_health():
    return {"status": "ok"}

# System Logs
@app.get("/api/system/logs")
def get_system_logs(
    service: Optional[str] = None,
    lines: int = 100,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Get application logs from log files"""
    require_admin(user)

    logs = []
    log_dir = "/var/log/stock_management"

    # Read application log file
    app_log_path = os.path.join(log_dir, "app.log")

    try:
        if os.path.exists(app_log_path):
            with open(app_log_path, "r") as f:
                all_lines = f.readlines()
                recent_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines
                logs.append({
                    "service": "stock_api",
                    "stdout": "".join(recent_lines),
                    "success": True
                })
        else:
            logs.append({
                "service": "stock_api",
                "stdout": "Log file not created yet. No logs available.",
                "success": True
            })
    except Exception as e:
        logs.append({
            "service": "stock_api",
            "error": f"Failed to read log file: {str(e)}"
        })

    # Add info about other services
    if not service or service == "all":
        logs.append({
            "service": "stock_web",
            "stdout": "Frontend logs: Check browser console or Docker logs from host machine",
            "success": True
        })
        logs.append({
            "service": "stock_db",
            "stdout": "Database logs: Check Docker logs from host machine",
            "success": True
        })

    return {"logs": logs}
