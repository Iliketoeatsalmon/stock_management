"""
เทสต์ SQL ของรายงาน ERP (backend/erp_reports.py) บน Postgres ชั่วคราว
ไม่ได้ตั้ง TEST_DATABASE_URL = skip  (รันด้วย bash backend/tests/run_tests.sh)
"""
import os
import sys
from datetime import date

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "")
pytestmark = pytest.mark.skipif(not TEST_DATABASE_URL, reason="ไม่ได้ตั้ง TEST_DATABASE_URL")

SCHEMA = """
DROP TABLE IF EXISTS purchase_items, purchases, suppliers, delivery_items, deliveries,
    movements, customers, products CASCADE;
CREATE TABLE suppliers (id INTEGER PRIMARY KEY, name VARCHAR(100));
CREATE TABLE customers (id INTEGER PRIMARY KEY, name VARCHAR(100), is_site BOOLEAN NOT NULL DEFAULT false);
CREATE TABLE products (
    id INTEGER PRIMARY KEY, code VARCHAR(50), name VARCHAR(100), unit VARCHAR(20),
    category VARCHAR(100), item_kind VARCHAR(20) NOT NULL DEFAULT 'CONSUMABLE',
    min_stock INTEGER DEFAULT 0, cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true);
CREATE TABLE purchases (
    id INTEGER PRIMARY KEY, invoice_number VARCHAR(50), supplier_id INTEGER, purchase_date DATE NOT NULL,
    total_amount NUMERIC(12,2) DEFAULT 0, status VARCHAR(20) DEFAULT 'confirmed');
CREATE TABLE purchase_items (
    id INTEGER PRIMARY KEY, purchase_id INTEGER, product_id INTEGER,
    quantity INTEGER NOT NULL, unit_price NUMERIC(12,2) DEFAULT 0);
CREATE TABLE deliveries (
    id INTEGER PRIMARY KEY, customer_id INTEGER, delivery_date DATE NOT NULL, status VARCHAR(20));
CREATE TABLE delivery_items (id INTEGER PRIMARY KEY, delivery_id INTEGER, product_id INTEGER, quantity INTEGER NOT NULL);
CREATE TABLE movements (
    id SERIAL PRIMARY KEY, product_id INTEGER, movement_type VARCHAR(10) NOT NULL,
    quantity INTEGER NOT NULL, created_at TIMESTAMP DEFAULT NOW());

INSERT INTO suppliers VALUES (1, 'ร้าน ก'), (2, 'ร้าน ข');
INSERT INTO customers VALUES (7, 'ไซต์ ก', true), (8, 'ออฟฟิศ', false);
INSERT INTO products (id, code, name, unit, min_stock, cost_price) VALUES
    (1, 'P1', 'น้ำยาถูพื้น', 'แกลลอน', 10, 0),
    (2, 'P2', 'ไม้ม็อบ', 'อัน', 0, 50),
    (3, 'P3', 'ถุงขยะ', 'แพ็ค', 0, 0);
INSERT INTO products (id, code, name, unit, is_active) VALUES (4, 'P4', 'เลิกขายแล้ว', 'อัน', false);

-- ซื้อ P1 สองครั้ง: มกราคม 100, มีนาคม 120 ; ใบหนึ่งไม่กรอกยอดรวม ; ใบ cancelled ต้องไม่นับ
INSERT INTO purchases VALUES
    (1, 'INV-1', 1, '2026-01-10', 1000, 'confirmed'),
    (2, 'INV-2', 2, '2026-03-05', 0,    'confirmed'),
    (3, 'INV-3', 1, '2026-03-06', 999,  'cancelled');
INSERT INTO purchase_items VALUES
    (1, 1, 1, 10, 100), (2, 2, 1, 5, 120), (3, 3, 1, 1, 9999);

INSERT INTO deliveries VALUES
    (1, 7, '2026-02-01', 'confirmed'),
    (2, 7, '2026-03-20', 'confirmed'),
    (3, 8, '2026-03-21', 'confirmed'),
    (4, 7, '2026-03-22', 'draft');
INSERT INTO delivery_items VALUES
    (1, 1, 1, 2),   -- ก.พ. P1 x2 : ราคาซื้อ ณ วันนั้น = 100
    (2, 2, 1, 3),   -- มี.ค. P1 x3 : ราคาซื้อ ณ วันนั้น = 120
    (3, 2, 2, 4),   -- P2 ไม่เคยซื้อ ใช้ cost_price 50
    (4, 3, 3, 6),   -- P3 ไม่มีต้นทุนเลย
    (5, 4, 1, 99);  -- draft ต้องไม่นับ

INSERT INTO movements (product_id, movement_type, quantity, created_at) VALUES
    (1, 'IN', 15, '2026-03-05'), (1, 'OUT', 5, '2026-03-20'),
    (2, 'IN', 4, '2026-01-01');
"""


@pytest.fixture(scope="module")
def db():
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker

    s = sessionmaker(bind=create_engine(TEST_DATABASE_URL))()
    s.execute(text(SCHEMA))
    s.commit()
    yield s
    s.close()


def _rows(db, sql, **params):
    from sqlalchemy import text

    base = {"start_date": None, "end_date": None}
    base.update(params)
    return db.execute(text(sql), base).fetchall()


def test_purchases_skips_cancelled_and_falls_back_to_item_total(db):
    from erp_reports import PURCHASES_SQL

    rows = {r.invoice_number: r for r in _rows(db, PURCHASES_SQL)}
    assert set(rows) == {"INV-1", "INV-2"}
    assert float(rows["INV-1"].total) == 1000
    assert float(rows["INV-2"].total) == 600  # ยอดรวมเป็น 0 ใช้ 5 x 120


def test_purchases_date_filter(db):
    from erp_reports import PURCHASES_SQL

    rows = _rows(db, PURCHASES_SQL, start_date=date(2026, 3, 1), end_date=date(2026, 3, 31))
    assert [r.invoice_number for r in rows] == ["INV-2"]


def test_deliveries_cost_uses_price_as_of_delivery_date(db):
    from erp_reports import DELIVERIES_SQL

    rows = {(r.month, r.customer_id, r.product_id): r for r in _rows(db, DELIVERIES_SQL)}
    assert float(rows[("2026-02", 7, 1)].cost_value) == 200  # 2 x 100
    assert float(rows[("2026-03", 7, 1)].cost_value) == 360  # 3 x 120 (ไม่ใช่ราคาปัจจุบันย้อนกลับ)


def test_deliveries_fallback_to_cost_price_and_flags_missing_cost(db):
    from erp_reports import DELIVERIES_SQL

    rows = {(r.month, r.customer_id, r.product_id): r for r in _rows(db, DELIVERIES_SQL)}
    p2 = rows[("2026-03", 7, 2)]
    assert float(p2.cost_value) == 200 and float(p2.quantity_without_cost) == 0
    p3 = rows[("2026-03", 8, 3)]
    assert float(p3.cost_value) == 0 and float(p3.quantity_without_cost) == 6


def test_deliveries_ignores_draft_and_marks_site(db):
    from erp_reports import DELIVERIES_SQL

    rows = _rows(db, DELIVERIES_SQL)
    assert all(float(r.quantity) != 99 for r in rows)
    assert {r.customer_name: r.is_site for r in rows} == {"ไซต์ ก": True, "ออฟฟิศ": False}


def test_deliveries_in_january_has_no_earlier_purchase_price(db):
    """ส่งก่อนมีการซื้อครั้งแรก: ไม่เอาราคาจากอนาคตมาใช้ ตกไป cost_price (P1 = 0) = ไม่มีต้นทุน"""
    from erp_reports import DELIVERIES_SQL

    rows = _rows(db, DELIVERIES_SQL, end_date=date(2026, 1, 31))
    assert rows == []
    db.execute(__import__("sqlalchemy").text("INSERT INTO deliveries VALUES (9,7,'2026-01-02','confirmed')"))
    db.execute(__import__("sqlalchemy").text("INSERT INTO delivery_items VALUES (9,9,1,1)"))
    rows = _rows(db, DELIVERIES_SQL, end_date=date(2026, 1, 31))
    assert float(rows[0].cost_value) == 0 and float(rows[0].quantity_without_cost) == 1
    db.rollback()


def test_inventory_stock_cost_and_previous_price(db):
    from erp_reports import INVENTORY_SQL, unit_cost_of

    rows = {r.code: r for r in _rows(db, INVENTORY_SQL)}
    assert "P4" not in rows  # สินค้าที่ปิดใช้งาน
    p1 = rows["P1"]
    assert float(p1.current_stock) == 10 and float(p1.min_stock) == 10
    assert float(p1.last_buy_price) == 120 and float(p1.previous_buy_price) == 100
    assert p1.last_supplier == "ร้าน ข"
    assert p1.last_out_at is not None
    assert unit_cost_of(p1.last_buy_price, p1.cost_price) == (120.0, "purchase")
    p2 = rows["P2"]
    assert unit_cost_of(p2.last_buy_price, p2.cost_price) == (50.0, "cost_price")
    p3 = rows["P3"]
    assert unit_cost_of(p3.last_buy_price, p3.cost_price) == (None, "none")
    assert float(p3.current_stock) == 0
