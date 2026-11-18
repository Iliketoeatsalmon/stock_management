"""
รายงานสำหรับ ERP (อ่านอย่างเดียว ยืนยันตัวตนด้วย X-API-Key เหมือน /api/catalog)

ต่างจาก /api/reports/* ที่ใช้ login ของผู้ใช้ และต่างจาก /api/catalog ตรงที่ส่ง "ต้นทุน" ด้วย
ฝั่ง ERP ใช้เฉพาะ OWNER/FINANCE ดูตัวเลขเหล่านี้

กติกาต้นทุนต่อหน่วย (ใช้ทุก endpoint ให้ตรงกัน):
  1. ราคาซื้อล่าสุดที่ยืนยันแล้ว (purchases.status='confirmed', unit_price > 0)
     - รายงานส่งของ: ล่าสุด "ณ วันที่ส่ง" (ไม่เอาราคาที่มาทีหลัง) เพื่อให้ยอดย้อนหลังไม่เปลี่ยนเมื่อราคาซื้อขยับ
  2. ถ้าไม่เคยซื้อ ใช้ products.cost_price (ถ้า > 0)
  3. ไม่มีทั้งคู่ = ไม่มีต้นทุน (cost_source = 'none') นับเป็น 0 แต่รายงานจำนวนที่ไม่มีต้นทุนแยกให้
"""
from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

# purchases.total_amount บางใบเป็น 0 (ไม่ได้กรอก) จึงใช้ผลรวมรายการแทนเมื่อเป็น 0
PURCHASES_SQL = """
SELECT
    p.id, p.invoice_number, p.purchase_date, p.supplier_id,
    COALESCE(s.name, '') AS supplier_name,
    CASE WHEN COALESCE(p.total_amount, 0) > 0 THEN p.total_amount
         ELSE COALESCE(it.items_total, 0) END AS total
FROM purchases p
LEFT JOIN suppliers s ON s.id = p.supplier_id
LEFT JOIN (
    SELECT purchase_id, SUM(quantity * COALESCE(unit_price, 0)) AS items_total
    FROM purchase_items GROUP BY purchase_id
) it ON it.purchase_id = p.id
WHERE p.status = 'confirmed'
  AND (CAST(:start_date AS date) IS NULL OR p.purchase_date >= CAST(:start_date AS date))
  AND (CAST(:end_date AS date) IS NULL OR p.purchase_date <= CAST(:end_date AS date))
ORDER BY p.purchase_date, p.id
"""

DELIVERIES_SQL = """
WITH lines AS (
    SELECT
        d.id AS delivery_id, d.delivery_date, d.customer_id,
        di.product_id, di.quantity,
        buy.unit_price AS buy_price,
        NULLIF(pr.cost_price, 0) AS cost_price
    FROM delivery_items di
    JOIN deliveries d ON d.id = di.delivery_id
    JOIN products pr ON pr.id = di.product_id
    LEFT JOIN LATERAL (
        SELECT pi.unit_price
        FROM purchase_items pi
        JOIN purchases pu ON pu.id = pi.purchase_id
        WHERE pi.product_id = di.product_id
          AND pu.status = 'confirmed'
          AND COALESCE(pi.unit_price, 0) > 0
          AND pu.purchase_date <= d.delivery_date
        ORDER BY pu.purchase_date DESC, pu.id DESC
        LIMIT 1
    ) buy ON true
    WHERE d.status = 'confirmed'
      AND (CAST(:start_date AS date) IS NULL OR d.delivery_date >= CAST(:start_date AS date))
      AND (CAST(:end_date AS date) IS NULL OR d.delivery_date <= CAST(:end_date AS date))
)
SELECT
    to_char(l.delivery_date, 'YYYY-MM') AS month,
    l.customer_id,
    COALESCE(c.name, '') AS customer_name,
    COALESCE(c.is_site, false) AS is_site,
    l.product_id, pr.code AS product_code, pr.name AS product_name, pr.unit,
    COALESCE(pr.category, '') AS category,
    COALESCE(pr.item_kind, 'CONSUMABLE') AS item_kind,
    COUNT(DISTINCT l.delivery_id) AS delivery_count,
    SUM(l.quantity) AS quantity,
    SUM(l.quantity * COALESCE(l.buy_price, l.cost_price, 0)) AS cost_value,
    SUM(CASE WHEN COALESCE(l.buy_price, l.cost_price) IS NULL THEN l.quantity ELSE 0 END) AS quantity_without_cost
FROM lines l
JOIN products pr ON pr.id = l.product_id
LEFT JOIN customers c ON c.id = l.customer_id
GROUP BY 1, l.customer_id, c.name, c.is_site, l.product_id,
         pr.code, pr.name, pr.unit, pr.category, pr.item_kind
ORDER BY 1, c.name, pr.name
"""

INVENTORY_SQL = """
WITH stock AS (
    SELECT product_id,
           SUM(CASE WHEN movement_type = 'IN' THEN quantity ELSE -quantity END) AS current_stock,
           MAX(CASE WHEN movement_type = 'OUT' THEN created_at END) AS last_out_at,
           MAX(CASE WHEN movement_type = 'IN' THEN created_at END) AS last_in_at
    FROM movements GROUP BY product_id
),
buys AS (
    SELECT pi.product_id, pi.unit_price, pu.purchase_date, COALESCE(s.name, '') AS supplier_name,
           ROW_NUMBER() OVER (
               PARTITION BY pi.product_id ORDER BY pu.purchase_date DESC, pu.id DESC
           ) AS rn
    FROM purchase_items pi
    JOIN purchases pu ON pu.id = pi.purchase_id
    LEFT JOIN suppliers s ON s.id = pu.supplier_id
    WHERE pu.status = 'confirmed' AND COALESCE(pi.unit_price, 0) > 0
)
SELECT
    p.id AS product_id, p.code, p.name, p.unit,
    COALESCE(p.category, '') AS category,
    COALESCE(p.item_kind, 'CONSUMABLE') AS item_kind,
    COALESCE(p.min_stock, 0) AS min_stock,
    COALESCE(st.current_stock, 0) AS current_stock,
    NULLIF(p.cost_price, 0) AS cost_price,
    b1.unit_price AS last_buy_price, b1.purchase_date AS last_buy_date, b1.supplier_name AS last_supplier,
    b2.unit_price AS previous_buy_price,
    st.last_out_at, st.last_in_at
FROM products p
LEFT JOIN stock st ON st.product_id = p.id
LEFT JOIN buys b1 ON b1.product_id = p.id AND b1.rn = 1
LEFT JOIN buys b2 ON b2.product_id = p.id AND b2.rn = 2
WHERE p.is_active = true
ORDER BY p.name
"""


def _num(v) -> Optional[float]:
    if v is None:
        return None
    return float(v) if isinstance(v, Decimal) else float(v)


def _day(v) -> Optional[str]:
    return v.isoformat() if v is not None else None


def _parse_date(value: Optional[str], field: str) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"{field} ต้องเป็นรูปแบบ YYYY-MM-DD")


def unit_cost_of(last_buy_price, cost_price):
    """ต้นทุนต่อหน่วย + แหล่งที่มา ตามกติกาข้างบน"""
    if last_buy_price is not None:
        return float(last_buy_price), "purchase"
    if cost_price is not None:
        return float(cost_price), "cost_price"
    return None, "none"


def build_router(get_db, require_api_key) -> APIRouter:
    router = APIRouter(prefix="/api/erp/reports", tags=["erp-reports"])

    @router.get("/purchases")
    def purchases(
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        db: Session = Depends(get_db),
        _: bool = Depends(require_api_key),
    ):
        params = {
            "start_date": _parse_date(start_date, "start_date"),
            "end_date": _parse_date(end_date, "end_date"),
        }
        rows = db.execute(text(PURCHASES_SQL), params).fetchall()
        return {
            "invoices": [
                {
                    "id": r.id,
                    "invoice_number": r.invoice_number,
                    "purchase_date": _day(r.purchase_date),
                    "supplier_id": r.supplier_id,
                    "supplier_name": r.supplier_name,
                    "total": _num(r.total) or 0.0,
                }
                for r in rows
            ],
        }

    @router.get("/deliveries")
    def deliveries(
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        db: Session = Depends(get_db),
        _: bool = Depends(require_api_key),
    ):
        params = {
            "start_date": _parse_date(start_date, "start_date"),
            "end_date": _parse_date(end_date, "end_date"),
        }
        rows = db.execute(text(DELIVERIES_SQL), params).fetchall()
        return {
            "rows": [
                {
                    "month": r.month,
                    "customer_id": r.customer_id,
                    "customer_name": r.customer_name,
                    "is_site": bool(r.is_site),
                    "product_id": r.product_id,
                    "product_code": r.product_code,
                    "product_name": r.product_name,
                    "unit": r.unit,
                    "category": r.category,
                    "item_kind": r.item_kind,
                    "delivery_count": int(r.delivery_count),
                    "quantity": _num(r.quantity) or 0.0,
                    "cost_value": _num(r.cost_value) or 0.0,
                    "quantity_without_cost": _num(r.quantity_without_cost) or 0.0,
                }
                for r in rows
            ],
        }

    @router.get("/inventory")
    def inventory(
        db: Session = Depends(get_db),
        _: bool = Depends(require_api_key),
    ):
        rows = db.execute(text(INVENTORY_SQL)).fetchall()
        items = []
        for r in rows:
            unit_cost, source = unit_cost_of(r.last_buy_price, r.cost_price)
            items.append(
                {
                    "product_id": r.product_id,
                    "code": r.code,
                    "name": r.name,
                    "unit": r.unit,
                    "category": r.category,
                    "item_kind": r.item_kind,
                    "min_stock": _num(r.min_stock) or 0.0,
                    "current_stock": _num(r.current_stock) or 0.0,
                    "unit_cost": unit_cost,
                    "cost_source": source,
                    "last_buy_price": _num(r.last_buy_price),
                    "last_buy_date": _day(r.last_buy_date),
                    "last_supplier": r.last_supplier or "",
                    "previous_buy_price": _num(r.previous_buy_price),
                    "last_out_at": r.last_out_at.isoformat() if r.last_out_at else None,
                    "last_in_at": r.last_in_at.isoformat() if r.last_in_at else None,
                }
            )
        return {"items": items}

    return router
