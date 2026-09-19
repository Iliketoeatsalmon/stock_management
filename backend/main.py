from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import StreamingResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings
from typing import Optional, List
from datetime import datetime, date, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from passlib.exc import UnknownHashError
import os
import uuid
import io
import csv
import zipfile
import logging
from logging.handlers import RotatingFileHandler

from pdf_generator import generate_delivery_pdf, generate_delivery_report_pdf

# Setup logging
# Log directory is configurable so the app also runs outside the Linux container
# (e.g. Windows dev via run-backend.bat) where /var/log is not writable.
LOG_DIR = os.environ.get("LOG_DIR", "/var/log/stock_management")
try:
    os.makedirs(LOG_DIR, exist_ok=True)
except OSError:
    # Fall back to a local ./logs folder if the configured path is not writable
    LOG_DIR = os.path.join(os.path.dirname(__file__), "logs")
    os.makedirs(LOG_DIR, exist_ok=True)

LOG_FILE = os.path.join(LOG_DIR, "app.log")
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        RotatingFileHandler(
            LOG_FILE,
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
    conn.execute(text("ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS notify_enabled BOOLEAN NOT NULL DEFAULT true"))
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
    notify_enabled: Optional[bool] = None

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
    quantity: int = Field(gt=0)
    unit_price: float = Field(default=0, ge=0)

class PurchaseCreate(BaseModel):
    invoice_number: str
    supplier_id: int
    purchase_date: date
    notes: Optional[str] = None
    attachment_url: Optional[str] = None
    items: List[PurchaseItemCreate]

class DeliveryItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)
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
    quantity: int = Field(gt=0)
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
            p.notify_enabled,
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
            p.min_stock,
            p.notify_enabled
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
    low_stock_alert_count = sum(1 for row in low_stock if row["notify_enabled"])

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
        "low_stock_alert_count": low_stock_alert_count,
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
            p.notify_enabled,
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
            p.notify_enabled,
            p.created_at,
            p.updated_at
        ORDER BY p.name
    """

    result = db.execute(text(query), params)
    return [dict(row._mapping) for row in result.fetchall()]

# --- One-time migration export: product registry + qty on hand, as CSV -----
# See README/task history for the full field contract. This is read-only:
# it never writes to the old system's tables.
EXPORT_FETCH_BATCH_SIZE = 500


def _build_csv_bytes(header: List[str], rows: List[list]) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer)  # default dialect: comma, CRLF, QUOTE_MINIMAL — matches the contract
    writer.writerow(header)
    writer.writerows(rows)
    return (chr(0xFEFF) + buffer.getvalue()).encode("utf-8")


@app.get("/api/products/export")
def export_products_csv(db: Session = Depends(get_db), user = Depends(get_current_user)):
    require_admin(user)

    cutoff_date = datetime.now().strftime("%Y-%m-%d")

    # Single read-only query: full registry (active + inactive) plus qty on hand,
    # computed with the exact same formula used everywhere else in this app.
    result = db.execute(text("""
        SELECT
            p.id,
            p.code,
            p.name,
            p.unit,
            p.description,
            p.min_stock,
            p.is_active,
            COALESCE(
                SUM(CASE WHEN m.movement_type = 'IN' THEN m.quantity ELSE -m.quantity END),
                0
            ) AS current_stock
        FROM products p
        LEFT JOIN movements m ON m.product_id = p.id
        GROUP BY p.id, p.code, p.name, p.unit, p.description, p.min_stock, p.is_active
        ORDER BY p.id
    """))

    # Fetch in batches rather than one giant fetchall() — the dedup/sort step
    # below inherently needs the full set in memory regardless, but this avoids
    # holding the raw DB cursor buffer and the Python row list in memory twice.
    raw_rows = []
    while True:
        batch = result.fetchmany(EXPORT_FETCH_BATCH_SIZE)
        if not batch:
            break
        raw_rows.extend(dict(row._mapping) for row in batch)

    # Group by original code to find duplicates before assigning final codes.
    by_code: dict = {}
    for row in raw_rows:
        code = (row["code"] or "").strip()
        by_code.setdefault(code, []).append(row)

    issues = []  # (source_id, code, name, issue)
    final_rows = []

    for code, group in by_code.items():
        # Lowest id keeps the original code; later duplicates get renamed. This
        # is deterministic across reruns (id never changes), unlike row order.
        group.sort(key=lambda r: r["id"])
        for idx, row in enumerate(group):
            source_id = row["id"]
            name = row["name"] or ""

            if not code:
                final_code = f"LEG-{source_id:06d}"
                issues.append((source_id, final_code, name, "MISSING_CODE_GENERATED"))
            elif len(group) > 1 and idx > 0:
                final_code = f"{code}-{source_id}"
                issues.append((source_id, final_code, name, "DUPLICATE_CODE_RENAMED"))
            else:
                final_code = code

            unit = (row["unit"] or "").strip()
            if not unit:
                issues.append((source_id, final_code, name, "MISSING_UNIT"))

            raw_qty = row["current_stock"] or 0
            if raw_qty < 0:
                qty_on_hand = 0
                issues.append((source_id, final_code, name, "NEGATIVE_QTY"))
            elif raw_qty == 0:
                qty_on_hand = 0
                issues.append((source_id, final_code, name, "ZERO_QTY"))
            else:
                qty_on_hand = raw_qty

            # No unit_cost field exists anywhere in this system for products —
            # always blank, never guessed/zero-filled, per the migration contract.
            issues.append((source_id, final_code, name, "MISSING_COST"))

            final_rows.append([
                source_id,
                final_code,
                name,
                unit,
                "CONSUMABLE",
                "",  # category — no source field
                str(qty_on_hand),
                "",  # unit_cost — always blank, see above
                str(row["min_stock"] if row["min_stock"] is not None else 0),
                "true" if row["is_active"] else "false",
                (row["description"] or "").strip(),
            ])

    final_rows.sort(key=lambda r: r[1])  # sort by final code
    issues.sort(key=lambda i: i[1])  # same order as the main file, for easy side-by-side review

    main_csv = _build_csv_bytes(
        ["source_id", "code", "name", "unit", "kind", "category", "qty_on_hand", "unit_cost", "reorder_point", "is_active", "note"],
        final_rows,
    )
    issues_csv = _build_csv_bytes(
        ["source_id", "code", "name", "issue"],
        [[i[0], i[1], i[2], i[3]] for i in issues],
    )

    # date_time is fixed to the cutoff date (not wall-clock time) so re-running
    # the export with unchanged data produces a byte-identical zip file.
    fixed_date = (int(cutoff_date[0:4]), int(cutoff_date[5:7]), int(cutoff_date[8:10]), 0, 0, 0)
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for filename, content in [
            (f"stock-export-{cutoff_date}.csv", main_csv),
            (f"stock-export-{cutoff_date}-issues.csv", issues_csv),
        ]:
            info = zipfile.ZipInfo(filename, date_time=fixed_date)
            info.compress_type = zipfile.ZIP_DEFLATED
            zf.writestr(info, content)

    zip_filename = f"stock-export-{cutoff_date}.zip"
    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_filename}"'},
    )

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
    code = product.code.strip()
    if not code:
        raise HTTPException(status_code=400, detail="กรุณาระบุรหัสสินค้า")

    # Code is permanent once set (checked against every product ever created,
    # active or not) so a code can never be reused for a different item later.
    existing = db.execute(
        text("SELECT id, name, is_active FROM products WHERE TRIM(code) = :code"),
        {"code": code},
    ).fetchone()
    if existing:
        status_label = "ใช้งานอยู่" if existing.is_active else "ถูกลบ/ปิดใช้งานแล้ว"
        raise HTTPException(
            status_code=400,
            detail=f'รหัส "{code}" ถูกใช้แล้วโดยสินค้า "{existing.name}" ({status_label}) กรุณาใช้รหัสอื่น',
        )

    data = product.model_dump()
    data["code"] = code
    result = db.execute(text("""
        INSERT INTO products (code, name, description, unit, min_stock, image_url)
        VALUES (:code, :name, :description, :unit, :min_stock, :image_url)
        RETURNING *
    """), data)
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
def report_stock(
    filter: Optional[str] = None,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    filter_clause = ""
    if filter == "available":
        filter_clause = "AND COALESCE(s.current_stock, 0) > 0"
    elif filter == "low":
        filter_clause = "AND COALESCE(s.current_stock, 0) <= p.min_stock"

    query = f"""
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
        {filter_clause}
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

@app.get("/api/reports/deliveries")
def report_deliveries(
    customer_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    status: Optional[str] = "confirmed",
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """สรุปสิ่งของที่ส่งให้แต่ละหน่วยงาน (ลูกค้า) รวมจำนวนต่อสินค้า"""
    conditions = ["1=1"]
    params = {}
    if customer_id:
        conditions.append("d.customer_id = :customer_id")
        params["customer_id"] = customer_id
    if start_date:
        conditions.append("d.delivery_date >= :start_date")
        params["start_date"] = start_date
    if end_date:
        conditions.append("d.delivery_date <= :end_date")
        params["end_date"] = end_date
    if status:
        conditions.append("d.status = :status")
        params["status"] = status
    where_clause = " AND ".join(conditions)

    # จำนวนต่อสินค้า (รวมทุกใบส่งของในช่วง/หน่วยงานที่เลือก)
    rows = db.execute(text(f"""
        SELECT p.id AS product_id, p.code AS product_code, p.name AS product_name,
               p.unit AS unit,
               SUM(di.quantity) AS total_quantity,
               COUNT(DISTINCT d.id) AS delivery_count
        FROM delivery_items di
        JOIN deliveries d ON di.delivery_id = d.id
        JOIN products p ON di.product_id = p.id
        WHERE {where_clause}
        GROUP BY p.id, p.code, p.name, p.unit
        ORDER BY p.name
    """), params).fetchall()

    total_quantity = db.execute(text(f"""
        SELECT COALESCE(SUM(di.quantity), 0) AS total
        FROM delivery_items di
        JOIN deliveries d ON di.delivery_id = d.id
        WHERE {where_clause}
    """), params).scalar()

    delivery_count = db.execute(text(f"""
        SELECT COUNT(DISTINCT d.id) AS cnt
        FROM deliveries d
        WHERE {where_clause}
    """), params).scalar()

    return {
        "total_quantity": int(total_quantity or 0),
        "delivery_count": int(delivery_count or 0),
        "rows": [dict(r._mapping) for r in rows],
    }

@app.get("/api/reports/deliveries/pdf")
def report_deliveries_pdf(
    customer_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    status: Optional[str] = "confirmed",
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    report = report_deliveries(customer_id, start_date, end_date, status, db, user)
    company = get_company_settings(db)

    customer = None
    if customer_id:
        row = db.execute(text(
            "SELECT name, address, phone, contact_person FROM customers WHERE id = :id"
        ), {"id": customer_id}).fetchone()
        if row:
            customer = dict(row._mapping)

    status_labels = {
        "confirmed": "ยืนยันแล้ว (ส่งจริง)",
        "draft": "ร่าง",
        "cancelled": "ยกเลิก",
    }
    meta = {
        "customer_name": customer["name"] if customer else "ทั้งหมด",
        "customer_address": (customer.get("address") if customer else "") or "-",
        "customer_contact": (customer.get("contact_person") if customer else "") or "-",
        "customer_phone": (customer.get("phone") if customer else "") or "-",
        "start_date": start_date or "-",
        "end_date": end_date or "-",
        "status_label": status_labels.get(status or "", "ทุกสถานะ"),
        "printed_at": datetime.now().strftime("%d/%m/%Y %H:%M"),
    }

    pdf_bytes = generate_delivery_report_pdf(report, company, meta)
    headers = {"Content-Disposition": "inline; filename=delivery-report.pdf"}
    return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf", headers=headers)

# Image Upload
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB

@app.post("/api/upload-image")
def upload_image(file: UploadFile = File(...), user = Depends(get_current_user)):
    logger.info(f"Image upload: {file.filename}, size: {file.size if hasattr(file, 'size') else 'unknown'}")
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    # Read into memory so we can enforce a size limit before writing to disk
    contents = file.file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")

    filename = f"{uuid.uuid4().hex}{ext}"
    save_path = os.path.join("uploads", filename)
    with open(save_path, "wb") as buffer:
        buffer.write(contents)
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
    ensure_table_id_sequence(db, "customers")
    data = customer.model_dump()
    data["name"] = data["name"].strip()
    if not data["name"]:
        raise HTTPException(status_code=400, detail="Name is required")
    for key in ["contact_person", "phone", "email", "address", "tax_id"]:
        data[key] = normalize_optional_str(data.get(key))
    result = db.execute(text("""
        INSERT INTO customers (name, contact_person, phone, email, address, tax_id)
        VALUES (:name, :contact_person, :phone, :email, :address, :tax_id)
        RETURNING *
    """), data)
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
    prefix = f"DO-{today}-"
    # Use MAX of the numeric suffix (not COUNT) so deleting an older delivery
    # cannot cause a new one to reuse an existing number and hit the UNIQUE constraint.
    last_seq = db.execute(text("""
        SELECT MAX(CAST(SUBSTRING(delivery_number FROM :start) AS INTEGER))
        FROM deliveries
        WHERE delivery_number LIKE :pattern
    """), {"start": len(prefix) + 1, "pattern": f"{prefix}%"}).scalar()
    delivery_number = f"{prefix}{str((last_seq or 0) + 1).zfill(4)}"
    
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

    # Verify there is enough stock for every product before deducting anything,
    # so a delivery cannot drive current_stock negative. Aggregate by product in
    # case the same product appears on more than one line.
    required_by_product = {}
    for item in items:
        required_by_product[item.product_id] = required_by_product.get(item.product_id, 0) + item.quantity

    for product_id, required_qty in required_by_product.items():
        current_stock = db.execute(text("""
            SELECT COALESCE(SUM(CASE WHEN movement_type = 'IN' THEN quantity ELSE -quantity END), 0)
            FROM movements WHERE product_id = :product_id
        """), {"product_id": product_id}).scalar()
        if required_qty > current_stock:
            product = db.execute(
                text("SELECT code, name FROM products WHERE id = :id"),
                {"id": product_id},
            ).fetchone()
            product_label = f"{product.code} - {product.name}" if product else f"product {product_id}"
            raise HTTPException(
                status_code=400,
                detail=f"สต๊อกไม่พอสำหรับ {product_label} (มี {current_stock}, ต้องการ {required_qty})",
            )

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

    # Read application log file (same path used by the logging handler)
    app_log_path = LOG_FILE

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
