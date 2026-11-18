-- ============================================================================
-- 004_renumber_product_codes.sql
-- รันรหัสสินค้าใหม่ทั้งหมดเป็น NE-0001, NE-0002, ... เรียงตาม id
-- และล็อกให้รหัสห้ามซ้ำถาวร
--
-- สถานะ: ยังไม่ได้รันกับฐานข้อมูลจริง รอเจ้าของสั่ง
--
-- ทำไมต้องทำ:
--   รหัสเดิมซ้ำกัน 18 รหัส (เช่น NE-116 เป็นทั้งกระดาษชำระและยางอะไหล่ไม้ปาด)
--   มีรหัสที่พิมพ์สระการันต์ติดหน้า (์NE-0062, ๋JS-002) และ prefix ปนกันหลายแบบ
--
-- สิ่งที่สคริปต์นี้ทำ:
--   1. เก็บรหัสเดิมทุกตัวไว้ในคอลัมน์ legacy_code (ค้นด้วยรหัสเดิมได้ต่อ / ERP ใช้จับคู่)
--   2. ให้รหัสใหม่เรียงตาม id: id 1 -> NE-0001 ... id 263 -> NE-0263
--   3. เพิ่ม UNIQUE(code) กันรหัสซ้ำในระดับฐานข้อมูล
--
-- สิ่งที่สคริปต์นี้ "ไม่" แตะ: ชื่อ ราคา หมวด สต็อก ประวัติการเคลื่อนไหว เอกสารใด ๆ
-- (ตารางอื่นอ้างสินค้าด้วย product_id ไม่ใช่ code จึงไม่มีอะไรหลุด)
--
-- ผลข้างเคียงที่ต้องรู้:
--   - ใบส่งของ/รายงานที่ "พิมพ์ใหม่" หลังจากนี้จะแสดงรหัสใหม่ เพราะ PDF ดึงรหัสสดจาก products
--   - updated_at ของสินค้าทุกตัวจะขยับ ฝั่ง ERP ที่ sync ด้วย updated_since จะดึงใหม่ทั้งหมดหนึ่งรอบ (ตั้งใจ)
--
-- รันครั้งเดียวเท่านั้น: ถ้าเคยรันแล้ว (มี UNIQUE products_code_key อยู่) สคริปต์จะหยุดเอง
-- ถ้าต้องการเปลี่ยน prefix ให้แก้ 'NE-' ในข้อ 3 และ PRODUCT_CODE_PREFIX ใน backend/product_codes.py ให้ตรงกัน
-- ============================================================================

BEGIN;

-- 0) ตรวจเงื่อนไขก่อนเริ่ม ------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'products'::regclass AND conname = 'products_code_key'
    ) THEN
        RAISE EXCEPTION 'สคริปต์นี้เคยรันแล้ว (มี products_code_key อยู่) หยุดเพื่อไม่ให้รันซ้ำ';
    END IF;

    -- ต้องอ้างแถวด้วย id ได้แน่นอน ถ้า id ซ้ำจะเปลี่ยนรหัสผิดตัว
    IF EXISTS (SELECT 1 FROM products GROUP BY id HAVING COUNT(*) > 1) THEN
        RAISE EXCEPTION 'products.id ซ้ำกัน หยุดการเปลี่ยนรหัส ต้องแก้ id ก่อน';
    END IF;
    IF EXISTS (SELECT 1 FROM products WHERE id IS NULL) THEN
        RAISE EXCEPTION 'products.id เป็น NULL หยุดการเปลี่ยนรหัส';
    END IF;
END $$;

-- 1) คอลัมน์เก็บรหัสเดิม --------------------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS legacy_code VARCHAR(50);

-- 2) เก็บรหัสเดิมตามที่เป็นอยู่ทุกตัวอักษร (รวมสระที่พิมพ์ติดมา) ---------------------
--    เพราะนี่คือค่าที่พิมพ์อยู่บนเอกสารเก่า ต้องใช้ตามรอยกลับได้
UPDATE products SET legacy_code = code WHERE legacy_code IS NULL;

-- 3) รหัสใหม่เรียงตาม id -------------------------------------------------------
WITH numbered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
    FROM products
)
UPDATE products p
SET code = 'NE-' || LPAD(n.rn::text, 4, '0'),
    updated_at = NOW()
FROM numbered n
WHERE p.id = n.id;

-- 4) ห้ามรหัสซ้ำถาวร ------------------------------------------------------------
ALTER TABLE products ADD CONSTRAINT products_code_key UNIQUE (code);

-- 5) ตรวจผลก่อน COMMIT ---------------------------------------------------------
SELECT
    COUNT(*)                                           AS สินค้าทั้งหมด,
    COUNT(DISTINCT code)                               AS รหัสไม่ซ้ำ,
    COUNT(*) FILTER (WHERE code !~ '^NE-[0-9]{4,}$')    AS รหัสผิดรูปแบบ,
    COUNT(*) FILTER (WHERE legacy_code IS NULL)        AS ไม่มีรหัสเดิม,
    MIN(code)                                          AS รหัสแรก,
    MAX(code)                                          AS รหัสสุดท้าย
FROM products;
-- ที่ถูกต้อง: สินค้าทั้งหมด = รหัสไม่ซ้ำ, รหัสผิดรูปแบบ = 0, ไม่มีรหัสเดิม = 0

-- ตัวอย่างเทียบเก่า-ใหม่ 10 แถวแรก
SELECT id, legacy_code AS รหัสเดิม, code AS รหัสใหม่, name
FROM products ORDER BY id LIMIT 10;

-- ถ้าผลถูกต้อง -> COMMIT;   ถ้าไม่ถูก -> ROLLBACK;
COMMIT;

-- ----------------------------------------------------------------------------
-- วิธีย้อนกลับ (ถ้าจำเป็น หลัง COMMIT ไปแล้ว)
-- ----------------------------------------------------------------------------
-- BEGIN;
-- ALTER TABLE products DROP CONSTRAINT products_code_key;
-- UPDATE products SET code = legacy_code, updated_at = NOW() WHERE legacy_code IS NOT NULL;
-- COMMIT;
-- (คืนรหัสเดิมได้ครบ เพราะ legacy_code เก็บไว้ทุกตัว แต่รหัสซ้ำแบบเดิมจะกลับมาด้วย)
