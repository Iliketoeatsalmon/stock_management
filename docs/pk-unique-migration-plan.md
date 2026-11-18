# แผนเพิ่ม PRIMARY KEY(id) + UNIQUE(code) ให้ตาราง products

**สถานะ: ยังไม่ได้รันอะไรทั้งสิ้น — รอเจ้าของอนุมัติ**

ห้ามรันขั้นตอนในเอกสารนี้จนกว่าเจ้าของจะสั่ง และต้องทำ backup ก่อนเสมอ

---

## 1. ทำไมต้องทำ

ตรวจพบว่า `products` **ไม่มี PRIMARY KEY และไม่มี UNIQUE constraint เลย**
(ตรวจจาก `pg_constraint` ไม่เจอทั้ง `contype='p'` และ `contype='u'`)

ผลที่ตามมา:

- `code` ซ้ำกันได้ในระดับฐานข้อมูล โค้ดแอปกันไว้ แต่ DB ไม่กัน ถ้ามีใครเขียนเข้า DB ตรง ๆ จะหลุด
- ตัว CSV export มี logic เปลี่ยนชื่อรหัสซ้ำ (`DUPLICATE_CODE_RENAMED`) อยู่แล้ว แปลว่าเคยเจอปัญหานี้จริง
- ERP จะ sync ด้วย `code` เป็น key ถ้าซ้ำจะได้ข้อมูลผิดแบบเงียบ ๆ
- query ที่ `GROUP BY p.id` ใช้ไม่ได้ ต้องไล่ใส่ทุกคอลัมน์ใน GROUP BY (เจอตอนเขียน catalog จริง)

ตารางอื่นในระบบก็ไม่มี PK เหมือนกัน แต่รอบนี้ขอแก้เฉพาะ `products` ก่อน
เพราะเป็นตารางเดียวที่ ERP จะใช้เป็น key

---

## 2. ตรวจสภาพข้อมูลก่อน (อ่านอย่างเดียว ปลอดภัย)

รันชุดนี้ก่อน แล้วส่งผลให้ดูก่อนตัดสินใจขั้นถัดไป

```sql
-- 2.1 มีรหัสซ้ำกี่ตัว ซ้ำเป็นอะไรบ้าง
SELECT TRIM(code) AS code,
       COUNT(*)   AS n,
       STRING_AGG(id::text, ',' ORDER BY id) AS ids,
       STRING_AGG(name, ' | ' ORDER BY id)   AS names
FROM products
GROUP BY TRIM(code)
HAVING COUNT(*) > 1
ORDER BY n DESC, code;

-- 2.2 รหัสว่าง/NULL (ต้องเติมก่อนทำ UNIQUE)
SELECT id, name, is_active
FROM products
WHERE code IS NULL OR TRIM(code) = '';

-- 2.3 id ซ้ำหรือ NULL (ต้องเป็น 0 ทั้งคู่ถึงจะทำ PRIMARY KEY ได้)
SELECT COUNT(*) AS dup_id FROM (SELECT id FROM products GROUP BY id HAVING COUNT(*) > 1) x;
SELECT COUNT(*) AS null_id FROM products WHERE id IS NULL;

-- 2.4 รหัสที่ต่างกันแค่ช่องว่างหน้า-หลัง (จะกลายเป็นซ้ำหลัง TRIM)
SELECT code, LENGTH(code), TRIM(code)
FROM products
WHERE code <> TRIM(code);
```

**เงื่อนไขที่ต้องผ่านก่อนไปขั้น 4:**

| เช็ค | ต้องได้ |
|---|---|
| 2.1 รหัสซ้ำ | 0 แถว (หรือเคลียร์ตามขั้น 3 แล้ว) |
| 2.2 รหัสว่าง | 0 แถว |
| 2.3 id ซ้ำ / id NULL | 0 ทั้งคู่ |

---

## 3. เคลียร์รหัสซ้ำ (ถ้าขั้น 2.1 เจอ)

### หลักการ
**ห้ามลบสินค้าทิ้ง** เพราะทุกแถวผูกกับ `movements`, `delivery_items`, `purchase_items`, `return_items`
ลบแล้วประวัติจะกำพร้า (ตารางพวกนี้ไม่มี FK คอยกัน)

วิธีที่ปลอดภัยคือ **เปลี่ยนรหัสของตัวที่ซ้ำ** โดยให้ id น้อยสุดเก็บรหัสเดิมไว้
(ใช้กติกาเดียวกับที่ CSV export ใช้อยู่แล้ว จะได้ไม่ขัดกัน)

### 3.1 ดูก่อนว่าจะเปลี่ยนเป็นอะไร (ยังไม่เขียน)
```sql
WITH ranked AS (
    SELECT id, code, name,
           ROW_NUMBER() OVER (PARTITION BY TRIM(code) ORDER BY id) AS rn
    FROM products
    WHERE TRIM(code) <> ''
)
SELECT id, code AS code_เดิม, TRIM(code) || '-' || id AS code_ใหม่, name
FROM ranked
WHERE rn > 1
ORDER BY code, id;
```

### 3.2 ให้เจ้าของตรวจรายการจากข้อ 3.1 ทีละแถว
ตัดสินใจว่าแต่ละคู่คือ "ของชิ้นเดียวกันที่ถูกสร้างซ้ำ" หรือ "คนละของแต่ใส่รหัสชนกัน"

- **คนละของ** → ใช้รหัสใหม่ตามข้อ 3.3 ได้เลย
- **ของเดียวกันสร้างซ้ำ** → ต้องรวมประวัติก่อน (ย้าย movements/items ไปที่ id ที่เก็บไว้
  แล้วค่อยปิด `is_active=false` ตัวซ้ำ) อันนี้ต้องทำทีละเคส ไม่มีสคริปต์สำเร็จรูป

### 3.3 คำสั่งเปลี่ยนรหัส (รันหลังเจ้าของอนุมัติรายการเท่านั้น)
```sql
BEGIN;

WITH ranked AS (
    SELECT id, TRIM(code) AS base,
           ROW_NUMBER() OVER (PARTITION BY TRIM(code) ORDER BY id) AS rn
    FROM products
    WHERE TRIM(code) <> ''
)
UPDATE products p
SET code = r.base || '-' || p.id,
    updated_at = NOW()
FROM ranked r
WHERE p.id = r.id AND r.rn > 1;

-- ตัดช่องว่างหน้า-หลังให้เรียบร้อย
UPDATE products SET code = TRIM(code) WHERE code <> TRIM(code);

-- เติมรหัสให้แถวที่ว่าง (รูปแบบเดียวกับ CSV export)
UPDATE products
SET code = 'LEG-' || LPAD(id::text, 6, '0'), updated_at = NOW()
WHERE code IS NULL OR TRIM(code) = '';

-- ตรวจซ้ำก่อน commit ต้องได้ 0
SELECT COUNT(*) FROM (SELECT code FROM products GROUP BY code HAVING COUNT(*) > 1) x;

-- ถ้าได้ 0 -> COMMIT;  ถ้าไม่ใช่ -> ROLLBACK;
COMMIT;
```

> ⚠️ การเปลี่ยนรหัสสินค้ากระทบเอกสารที่พิมพ์ไปแล้ว (ใบส่งของเก่าจะโชว์รหัสใหม่
> เพราะ PDF ดึงรหัสสดจาก `products` ไม่ได้ snapshot ไว้) ต้องแจ้งหน้างานก่อน

---

## 4. เพิ่ม constraint (รันหลังขั้น 2 ผ่านหมด)

```sql
BEGIN;

-- id เป็น PRIMARY KEY
ALTER TABLE products ADD CONSTRAINT products_pkey PRIMARY KEY (id);

-- code ห้ามซ้ำ
ALTER TABLE products ADD CONSTRAINT products_code_key UNIQUE (code);

COMMIT;
```

ตรวจผล:
```sql
SELECT conname, contype FROM pg_constraint WHERE conrelid = 'products'::regclass;
-- ควรเห็น products_pkey (p) และ products_code_key (u)
```

**เวลาที่ใช้:** 244 แถว ใช้เวลาไม่ถึงวินาที แต่ `ALTER TABLE ... ADD PRIMARY KEY`
จะ lock ตารางแบบ `ACCESS EXCLUSIVE` ชั่วขณะ ควรทำนอกเวลาทำงาน

---

## 5. Backup ก่อนทำทุกขั้นที่เขียนข้อมูล (บังคับ)

```bash
# ดัมป์เฉพาะตาราง products (เร็ว ใช้กู้เฉพาะจุด)
pg_dump -h 127.0.0.1 -p 5432 -U <user> -d stock_management \
        -t products --data-only --column-inserts \
        -f backup_products_$(date +%Y%m%d_%H%M%S).sql

# ดัมป์ทั้งฐาน (แนะนำ ใช้กู้ได้ทุกกรณี)
pg_dump -h 127.0.0.1 -p 5432 -U <user> -d stock_management \
        -Fc -f backup_stock_full_$(date +%Y%m%d_%H%M%S).dump
```

- ใส่รหัสผ่านผ่าน `PGPASSWORD` หรือไฟล์ `.pgpass` **ห้ามพิมพ์รหัสลงคำสั่งตรง ๆ**
- เก็บไฟล์ backup ไว้นอกโฟลเดอร์โปรเจกต์ และตรวจขนาดไฟล์ว่าไม่ใช่ 0 ก่อนไปต่อ
- ทดสอบกู้คืนลงฐานข้อมูลเปล่าก่อนอย่างน้อยหนึ่งครั้ง

### วิธีกู้คืน
```bash
# เฉพาะตาราง products
psql -h 127.0.0.1 -U <user> -d stock_management -f backup_products_XXXX.sql

# ทั้งฐาน
pg_restore -h 127.0.0.1 -U <user> -d stock_management --clean backup_stock_full_XXXX.dump
```

---

## 6. ลำดับการทำจริง (สรุป)

1. รันขั้น 2 ทั้งหมด (อ่านอย่างเดียว) → ส่งผลให้เจ้าของดู
2. ถ้าไม่มีรหัสซ้ำเลย → ข้ามไปข้อ 5 แล้วต่อข้อ 4 ได้เลย
3. ถ้ามีรหัสซ้ำ → เจ้าของตรวจรายการข้อ 3.1 ทีละแถว และตัดสินว่าเคสไหนต้องรวมประวัติ
4. **ทำ backup (ขั้น 5)**
5. รันขั้น 3.3 ในทรานแซกชัน ตรวจผลก่อน COMMIT
6. รันขั้น 4
7. ตรวจว่าแอปยังทำงานปกติ (เปิดหน้าสินค้า สร้างใบส่งของทดสอบ)

**ทั้งหมดนี้ยังไม่ได้ทำ รอเจ้าของสั่ง**
