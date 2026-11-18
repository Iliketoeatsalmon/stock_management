"""
เทสต์สำหรับ ERP catalog sync

รันแบบไม่แตะฐานข้อมูลจริง:
  - เทสต์ API key ไม่ต้องใช้ DB เลย
  - เทสต์ SQL ใช้ Postgres ชั่วคราว (ตั้ง TEST_DATABASE_URL) ถ้าไม่ตั้งจะ skip

วิธีรัน (ดูสคริปต์ run_tests.sh):
  TEST_DATABASE_URL=postgresql://... pytest backend/tests/test_catalog.py -v
"""
import os

import pytest

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "")

# SQL ชุดเดียวกับที่ /api/catalog ใช้ แยกมาไว้ที่นี่เพื่อเทสต์ได้โดยไม่ต้องยก FastAPI ทั้งแอป
LOCATIONS_SQL = """
WITH sent AS (
    SELECT d.customer_id, di.product_id, SUM(di.quantity) AS qty_sent
    FROM delivery_items di
    JOIN deliveries d ON d.id = di.delivery_id
    WHERE d.status = 'confirmed'
      AND di.product_id = ANY(:ids)
    GROUP BY d.customer_id, di.product_id
),
ret AS (
    SELECT rt.customer_id, ri.product_id, SUM(ri.quantity) AS qty_returned
    FROM return_items ri
    JOIN returns rt ON rt.id = ri.return_id
    WHERE ri.product_id = ANY(:ids)
    GROUP BY rt.customer_id, ri.product_id
)
SELECT
    COALESCE(s.product_id, r.product_id)   AS product_id,
    COALESCE(s.customer_id, r.customer_id) AS customer_id,
    c.name                                 AS customer_name,
    c.is_site                              AS is_site,
    COALESCE(s.qty_sent, 0)                AS qty_sent,
    COALESCE(r.qty_returned, 0)            AS qty_returned
FROM sent s
FULL JOIN ret r
    ON r.product_id = s.product_id AND r.customer_id = s.customer_id
LEFT JOIN customers c ON c.id = COALESCE(s.customer_id, r.customer_id)
ORDER BY product_id, customer_id
"""


# ---------------------------------------------------------------------------
# 1) API key — ไม่ต้องใช้ DB
# ---------------------------------------------------------------------------
class _FakeSettings:
    def __init__(self, key):
        self.erp_api_key = key


def _check_key(settings, provided):
    """คัดลอก logic ของ require_api_key มาเทสต์ตรง ๆ (ไม่พึ่ง FastAPI Depends)"""
    import secrets

    from fastapi import HTTPException

    if not settings.erp_api_key:
        raise HTTPException(status_code=503, detail="Catalog API is not enabled")
    if not provided:
        raise HTTPException(status_code=401, detail="Missing X-API-Key header")
    if not secrets.compare_digest(provided, settings.erp_api_key):
        raise HTTPException(status_code=403, detail="Invalid API key")
    return True


def test_api_key_disabled_when_env_empty():
    """ไม่ตั้ง ERP_API_KEY = ปิดบริการ ไม่ใช่เปิดให้ใครก็เรียกได้"""
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as e:
        _check_key(_FakeSettings(""), "อะไรก็ได้")
    assert e.value.status_code == 503


def test_api_key_missing_header():
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as e:
        _check_key(_FakeSettings("secret-abc"), None)
    assert e.value.status_code == 401


def test_api_key_wrong_value():
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as e:
        _check_key(_FakeSettings("secret-abc"), "secret-xyz")
    assert e.value.status_code == 403


def test_api_key_correct():
    assert _check_key(_FakeSettings("secret-abc"), "secret-abc") is True


def test_api_key_is_not_prefix_matched():
    """กันบั๊กคลาสสิก: key ที่ขึ้นต้นเหมือนกันต้องไม่ผ่าน"""
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as e:
        _check_key(_FakeSettings("secret-abcdef"), "secret-abc")
    assert e.value.status_code == 403


# ---------------------------------------------------------------------------
# 2) SQL คำนวณ "ของอยู่ที่ไหน" — ใช้ Postgres ชั่วคราว
# ---------------------------------------------------------------------------
pg = pytest.mark.skipif(not TEST_DATABASE_URL, reason="ไม่ได้ตั้ง TEST_DATABASE_URL")


@pytest.fixture(scope="module")
def db():
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(TEST_DATABASE_URL)
    Session = sessionmaker(bind=engine)
    s = Session()

    # สร้างสคีมาย่อเฉพาะที่ query ใช้ (ฐานข้อมูลชั่วคราวเท่านั้น)
    s.execute(text("""
        CREATE TABLE customers (
            id INTEGER PRIMARY KEY, name VARCHAR(100), is_site BOOLEAN NOT NULL DEFAULT false);
        CREATE TABLE products (
            id INTEGER PRIMARY KEY, code VARCHAR(50), name VARCHAR(100), unit VARCHAR(20),
            category VARCHAR(100), item_kind VARCHAR(20) NOT NULL DEFAULT 'CONSUMABLE',
            is_active BOOLEAN DEFAULT true, updated_at TIMESTAMP DEFAULT NOW());
        CREATE TABLE deliveries (
            id INTEGER PRIMARY KEY, customer_id INTEGER, status VARCHAR(20));
        CREATE TABLE delivery_items (
            id INTEGER PRIMARY KEY, delivery_id INTEGER, product_id INTEGER, quantity DECIMAL(12,4));
        CREATE TABLE returns (
            id INTEGER PRIMARY KEY, customer_id INTEGER);
        CREATE TABLE return_items (
            id INTEGER PRIMARY KEY, return_id INTEGER, product_id INTEGER, quantity DECIMAL(12,4));
        CREATE TABLE movements (
            id INTEGER PRIMARY KEY, product_id INTEGER, movement_type VARCHAR(10), quantity DECIMAL(12,4));
    """))

    s.execute(text("""
        INSERT INTO customers (id,name,is_site) VALUES
            (1,'ไซต์ A',true), (2,'ไซต์ B',true), (3,'ออฟฟิศ',false);

        INSERT INTO products (id,code,name,unit,category,item_kind) VALUES
            (10,'P-001','ไม้ถูพื้น','ด้าม','อุปกรณ์','REUSABLE'),
            (11,'P-002','น้ำยาถูพื้น','แกลลอน','น้ำยา','CONSUMABLE'),
            (12,'P-003','ของไม่เคยส่ง','ชิ้น',NULL,'CONSUMABLE');

        -- ไซต์ A: ส่งไม้ถูพื้น 10 (confirmed) + 5 (draft ไม่ควรนับ) คืน 4
        INSERT INTO deliveries (id,customer_id,status) VALUES
            (100,1,'confirmed'), (101,1,'draft'), (102,2,'confirmed'), (103,3,'confirmed');
        INSERT INTO delivery_items (id,delivery_id,product_id,quantity) VALUES
            (1000,100,10,10), (1001,101,10,5), (1002,100,11,20),
            (1003,102,10,7), (1004,103,11,3);

        INSERT INTO returns (id,customer_id) VALUES (200,1), (201,2);
        INSERT INTO return_items (id,return_id,product_id,quantity) VALUES
            (2000,200,10,4),     -- ไซต์ A คืนไม้ถูพื้น 4
            (2001,201,10,9);     -- ไซต์ B คืน 9 ทั้งที่ส่งไปแค่ 7 (คืนเกิน เกิดขึ้นจริงในข้อมูล)
    """))
    s.commit()
    yield s
    s.close()


def _rows_to_map(rows):
    return {(r.product_id, r.customer_id): r for r in rows}


@pg
def test_draft_delivery_is_excluded(db):
    """ใบ draft ยังไม่ตัดสต็อก ต้องไม่ถูกนับเป็นของที่ส่งไปแล้ว"""
    from sqlalchemy import text

    rows = db.execute(text(LOCATIONS_SQL), {"ids": [10, 11, 12]}).fetchall()
    m = _rows_to_map(rows)
    # ไซต์ A ส่งไม้ถูพื้น: confirmed 10 เท่านั้น ไม่รวม draft 5
    assert float(m[(10, 1)].qty_sent) == 10.0


@pg
def test_outstanding_basic(db):
    from sqlalchemy import text

    rows = db.execute(text(LOCATIONS_SQL), {"ids": [10, 11, 12]}).fetchall()
    m = _rows_to_map(rows)
    r = m[(10, 1)]
    sent, returned = float(r.qty_sent), float(r.qty_returned)
    assert sent == 10.0 and returned == 4.0
    assert max(sent - returned, 0.0) == 6.0


@pg
def test_over_return_is_clamped_to_zero(db):
    """คืนมากกว่าที่ส่ง (มีจริง 93 คู่ในข้อมูลจริง) ต้องไม่ให้ยอดค้างติดลบ"""
    from sqlalchemy import text

    rows = db.execute(text(LOCATIONS_SQL), {"ids": [10, 11, 12]}).fetchall()
    m = _rows_to_map(rows)
    r = m[(10, 2)]
    sent, returned = float(r.qty_sent), float(r.qty_returned)
    assert sent == 7.0 and returned == 9.0
    assert max(sent - returned, 0.0) == 0.0


@pg
def test_product_never_sent_has_no_location(db):
    from sqlalchemy import text

    rows = db.execute(text(LOCATIONS_SQL), {"ids": [10, 11, 12]}).fetchall()
    assert all(r.product_id != 12 for r in rows)


@pg
def test_non_site_customer_still_listed_but_flagged(db):
    """'ออฟฟิศ' เบิกของไปด้วย ต้องยังเห็นในผล แต่ is_site=false ให้ ERP กรองเอง"""
    from sqlalchemy import text

    rows = db.execute(text(LOCATIONS_SQL), {"ids": [10, 11, 12]}).fetchall()
    m = _rows_to_map(rows)
    assert (11, 3) in m
    assert m[(11, 3)].is_site is False
    assert m[(11, 1)].is_site is True
