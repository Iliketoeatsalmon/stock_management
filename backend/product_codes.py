"""
รหัสสินค้ารันอัตโนมัติ: NE-0001, NE-0002, ...

แยกออกจาก main.py เพราะ main.py ต่อฐานข้อมูลตั้งแต่ตอน import
ทำให้เทสต์ logic ตรงนี้กับ Postgres ชั่วคราวไม่ได้
"""
from sqlalchemy import text
from sqlalchemy.orm import Session

# เปลี่ยน prefix/จำนวนหลักที่นี่ที่เดียว (สคริปต์ 004_renumber_product_codes.sql ต้องตรงกันด้วย)
PRODUCT_CODE_PREFIX = "NE"
PRODUCT_CODE_WIDTH = 4

# จับเฉพาะรหัสรูปแบบใหม่ (prefix + ขีด + ตัวเลขอย่างน้อย WIDTH หลัก)
# รหัสเก่าแบบ 3 หลัก (NE-116) หรือที่มีอักขระแปลกนำหน้า (์NE-0062) จะไม่ถูกนับ
PRODUCT_CODE_REGEX = rf"^{PRODUCT_CODE_PREFIX}-([0-9]{{{PRODUCT_CODE_WIDTH},}})$"


def format_product_code(number: int) -> str:
    """5 -> 'NE-0005' (ถ้าเลขยาวเกิน WIDTH ก็ไม่ตัด: 12345 -> 'NE-12345')"""
    if number < 1:
        raise ValueError("เลขรหัสสินค้าต้องเริ่มที่ 1")
    return f"{PRODUCT_CODE_PREFIX}-{number:0{PRODUCT_CODE_WIDTH}d}"


def next_product_code(db: Session) -> str:
    """
    รหัสถัดไป = เลขสูงสุดของรหัสรูปแบบใหม่ + 1
    ใช้ MAX ไม่ใช่ COUNT เหมือนเลขที่ใบส่งของ เพื่อไม่ให้ชนกับรหัสที่มีอยู่ถ้ามีช่องว่างของเลข
    การกันซ้ำตอนสร้างพร้อมกันพึ่ง UNIQUE(code) + การลองใหม่ใน create_product
    """
    last = db.execute(
        text("SELECT MAX(CAST(SUBSTRING(code FROM :pattern) AS INTEGER)) FROM products"),
        {"pattern": PRODUCT_CODE_REGEX},
    ).scalar()
    return format_product_code(int(last or 0) + 1)
