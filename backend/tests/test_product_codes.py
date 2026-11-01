"""
เทสต์ระบบรหัสสินค้ารันอัตโนมัติ + สคริปต์รันรหัสใหม่ (sql/004_renumber_product_codes.sql)

ใช้ schema แยกของตัวเอง (t_product_codes) ในฐานข้อมูลชั่วคราว
เพื่อไม่ให้ชนกับตาราง products ที่เทสต์ไฟล์อื่นสร้างไว้
"""
import os
from pathlib import Path

import pytest

from product_codes import PRODUCT_CODE_REGEX, format_product_code, next_product_code

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "")
SCHEMA = "t_product_codes"
RENUMBER_SQL = Path(__file__).resolve().parent.parent / "sql" / "004_renumber_product_codes.sql"

pg = pytest.mark.skipif(not TEST_DATABASE_URL, reason="ไม่ได้ตั้ง TEST_DATABASE_URL")


# ---------------------------------------------------------------------------
# 1) รูปแบบรหัส — ไม่ต้องใช้ DB
# ---------------------------------------------------------------------------
def test_format_pads_to_four_digits():
    assert format_product_code(1) == "NE-0001"
    assert format_product_code(263) == "NE-0263"


def test_format_does_not_truncate_large_numbers():
    assert format_product_code(12345) == "NE-12345"


def test_format_rejects_zero_and_negative():
    with pytest.raises(ValueError):
        format_product_code(0)


# ---------------------------------------------------------------------------
# 2) เลขถัดไป + สคริปต์รันรหัสใหม่ — ใช้ Postgres ชั่วคราว
# ---------------------------------------------------------------------------
def _raw_conn():
    """psycopg2 ตรง ๆ เพื่อรันไฟล์ .sql ทั้งไฟล์ (มี DO $$ และ BEGIN/COMMIT ของตัวเอง)"""
    import psycopg2

    dsn = TEST_DATABASE_URL.replace("postgresql+psycopg2://", "postgresql://")
    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(f"SET search_path TO {SCHEMA}")
    return conn


def _session():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(
        TEST_DATABASE_URL, connect_args={"options": f"-csearch_path={SCHEMA}"}
    )
    return sessionmaker(bind=engine)()


# ข้อมูลจำลองที่มีปัญหาแบบเดียวกับของจริง: รหัสซ้ำ, สระการันต์นำหน้า, prefix ปน, เลข 4 หลักแบบเก่า
SEED_PRODUCTS = [
    (1, "P001", "น้ำยาล้างจาน", True),
    (2, "NE-116", "กระดาษชำระ JRT", True),
    (3, "NE-116", "ยางอะไหล่ไม้ปาด 18 นิ้ว", True),   # รหัสซ้ำ
    (4, "์NE-0062", "ผ้าไมโครไฟเบอร์", True),     # มีสระการันต์ติดหน้า
    (5, "สัตหีบ-01", "เครื่องดูดฝุ่น", True),
    (6, "NE-0124", "ยางอะไหล่ไม้ปาดน้ำ 24 นิ้ว", True),  # เลข 4 หลักแบบเก่า
    (7, "jfkfj", "ข้อมูลทดสอบ", False),               # ปิดใช้งาน ก็ต้องได้รหัสด้วย
]


@pytest.fixture()
def fresh_schema():
    """สร้าง schema ใหม่ทุกเทสต์ ให้แต่ละเทสต์ไม่กระทบกัน"""
    conn = _raw_conn()
    with conn.cursor() as cur:
        cur.execute(f"DROP SCHEMA IF EXISTS {SCHEMA} CASCADE")
        cur.execute(f"CREATE SCHEMA {SCHEMA}")
        cur.execute(f"SET search_path TO {SCHEMA}")
        # ตารางจำลองให้เหมือนของจริง: ไม่มี PRIMARY KEY และไม่มี UNIQUE(code)
        cur.execute("""
            CREATE TABLE products (
                id INTEGER, code VARCHAR(50) NOT NULL, name VARCHAR(100),
                is_active BOOLEAN DEFAULT true, updated_at TIMESTAMP DEFAULT NOW()
            )
        """)
        for row in SEED_PRODUCTS:
            cur.execute(
                "INSERT INTO products (id, code, name, is_active) VALUES (%s, %s, %s, %s)", row
            )
    yield conn
    with conn.cursor() as cur:
        cur.execute(f"DROP SCHEMA IF EXISTS {SCHEMA} CASCADE")
    conn.close()


def _run_renumber(conn):
    with conn.cursor() as cur:
        cur.execute(RENUMBER_SQL.read_text(encoding="utf-8"))


def _products(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT id, code, legacy_code, name FROM products ORDER BY id")
        return cur.fetchall()


@pg
def test_next_code_on_empty_table_starts_at_one(fresh_schema):
    with fresh_schema.cursor() as cur:
        cur.execute("DELETE FROM products")
    db = _session()
    try:
        assert next_product_code(db) == "NE-0001"
    finally:
        db.close()


@pg
def test_next_code_ignores_old_three_digit_codes(fresh_schema):
    """NE-116 เป็นรูปแบบเก่า 3 หลัก ต้องไม่ถูกนับ ไม่งั้นเลขจะกระโดดไปตามรหัสเก่า"""
    with fresh_schema.cursor() as cur:
        cur.execute("DELETE FROM products WHERE code <> 'NE-116'")
    db = _session()
    try:
        assert next_product_code(db) == "NE-0001"
    finally:
        db.close()


@pg
def test_next_code_before_renumber_never_collides(fresh_schema):
    """
    ก่อนรันสคริปต์ มีรหัสเก่าแบบ 4 หลัก (NE-0124) ที่ตรงรูปแบบใหม่โดยบังเอิญ
    เลขถัดไปต้องมากกว่านั้น จึงไม่ชนกับรหัสเดิมตัวไหนเลย
    """
    db = _session()
    try:
        code = next_product_code(db)
    finally:
        db.close()
    assert code == "NE-0125"
    assert code not in {c for _, c, _, _ in SEED_PRODUCTS}


@pg
def test_renumber_assigns_sequential_codes_by_id(fresh_schema):
    _run_renumber(fresh_schema)
    rows = _products(fresh_schema)
    assert [code for _, code, _, _ in rows] == [f"NE-{i:04d}" for i in range(1, 8)]


@pg
def test_renumber_keeps_exact_legacy_code(fresh_schema):
    """รหัสเดิมต้องถูกเก็บตามตัวอักษรเดิมทุกตัว รวมสระที่พิมพ์ติดมา เพราะนั่นคือสิ่งที่อยู่บนเอกสารเก่า"""
    _run_renumber(fresh_schema)
    legacy = {pid: lc for pid, _, lc, _ in _products(fresh_schema)}
    assert legacy == {pid: code for pid, code, _, _ in SEED_PRODUCTS}


@pg
def test_renumber_resolves_duplicates(fresh_schema):
    _run_renumber(fresh_schema)
    codes = [code for _, code, _, _ in _products(fresh_schema)]
    assert len(codes) == len(set(codes))


@pg
def test_renumber_only_touches_code_columns(fresh_schema):
    def snapshot():
        # ก่อนรันสคริปต์ยังไม่มีคอลัมน์ legacy_code จึงเลือกเฉพาะคอลัมน์ที่มีทั้งก่อนและหลัง
        with fresh_schema.cursor() as cur:
            cur.execute("SELECT id, name, is_active FROM products ORDER BY id")
            return cur.fetchall()

    before = snapshot()
    _run_renumber(fresh_schema)
    assert snapshot() == before


@pg
def test_unique_constraint_blocks_duplicate_after_renumber(fresh_schema):
    import psycopg2

    _run_renumber(fresh_schema)
    with pytest.raises(psycopg2.errors.UniqueViolation):
        with fresh_schema.cursor() as cur:
            cur.execute("INSERT INTO products (id, code, name) VALUES (99, 'NE-0001', 'ซ้ำ')")


@pg
def test_renumber_refuses_to_run_twice(fresh_schema):
    """รันซ้ำต้องหยุดเอง ไม่งั้น legacy_code ของสินค้าที่สร้างหลังเปลี่ยนระบบจะเพี้ยน"""
    import psycopg2

    _run_renumber(fresh_schema)
    with pytest.raises(psycopg2.Error):
        _run_renumber(fresh_schema)
    with fresh_schema.cursor() as cur:
        cur.execute("ROLLBACK")
    # รอบแรกต้องยังอยู่ครบ ไม่ถูกรอบที่สองทำเสีย
    assert [code for _, code, _, _ in _products(fresh_schema)][0] == "NE-0001"


@pg
def test_refuses_when_ids_are_duplicated(fresh_schema):
    """id ซ้ำ = อ้างแถวไม่ได้แน่นอน ต้องไม่แตะอะไรเลย"""
    import psycopg2

    with fresh_schema.cursor() as cur:
        cur.execute("INSERT INTO products (id, code, name) VALUES (2, 'X-1', 'id ซ้ำ')")
    with pytest.raises(psycopg2.Error):
        _run_renumber(fresh_schema)
    with fresh_schema.cursor() as cur:
        cur.execute("ROLLBACK")
        cur.execute("SELECT COUNT(*) FROM products WHERE code LIKE 'NE-0%%'")
        assert cur.fetchone()[0] == 0 + 1  # มีแค่ NE-0124 เดิม ยังไม่ถูกเปลี่ยน


@pg
def test_next_code_after_renumber_continues_sequence(fresh_schema):
    _run_renumber(fresh_schema)
    db = _session()
    try:
        assert next_product_code(db) == "NE-0008"
    finally:
        db.close()


def test_regex_matches_only_new_format():
    import re

    pattern = re.compile(PRODUCT_CODE_REGEX)
    assert pattern.match("NE-0001")
    assert pattern.match("NE-12345")
    assert not pattern.match("NE-116")        # เก่า 3 หลัก
    assert not pattern.match("์NE-0062")  # สระนำหน้า
    assert not pattern.match("NE-0001 ")      # ช่องว่างท้าย
    assert not pattern.match("SP-0001")       # prefix อื่น
