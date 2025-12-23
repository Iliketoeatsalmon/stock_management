# Stock Management System

ระบบจัดการสต๊อกสินค้าครบวงจร พร้อม Docker

## Features

- Dashboard แสดงภาพรวมและสินค้าใกล้หมด
- จัดการสินค้า (เพิ่ม/แก้ไข/ค้นหา)
- รับสินค้าเข้า (บิลซื้อ / Manual)
- ใบส่งของ (สร้าง/ยืนยัน/ตัดสต๊อก)
- จัดการลูกค้าและ Supplier
- รายงานประวัติการเคลื่อนไหว
- ระบบ User Authentication

## Tech Stack

- **Backend:** Python FastAPI + PostgreSQL
- **Frontend:** Next.js + Tailwind CSS
- **Database:** PostgreSQL 15
- **Container:** Docker + Docker Compose

---

## Quick Start (3 Commands)

### 1. Clone หรือ Download ZIP แล้วแตกไฟล์

### 2. รัน Docker Compose

\`\`\`bash
docker-compose up -d --build
\`\`\`

### 3. เปิดใช้งาน

- **Web App:** http://localhost:3000
- **API Docs:** http://localhost:8000/docs
- **Login:** admin / admin123

---

## เชื่อมต่อ DBeaver

| Field    | Value            |
|----------|------------------|
| Host     | localhost        |
| Port     | 5432             |
| Database | stock_management |
| Username | stockadmin       |
| Password | stockpass123     |

---

## Commands Reference

\`\`\`bash
# Start ระบบทั้งหมด
docker-compose up -d --build

# หยุดระบบ
docker-compose down

# ดู logs
docker-compose logs -f

# ดู logs เฉพาะ service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres

# Restart service
docker-compose restart backend

# ลบทั้งหมดรวม database
docker-compose down -v
\`\`\`

---

## Project Structure

\`\`\`
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── main.py
│   ├── requirements.txt
│   └── sql/
│       └── 001_init.sql
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── app/
│   │   ├── page.tsx (Login)
│   │   ├── dashboard/
│   │   ├── products/
│   │   ├── stock-in/
│   │   ├── deliveries/
│   │   ├── customers/
│   │   ├── suppliers/
│   │   ├── reports/
│   │   └── users/
│   ├── components/
│   └── lib/
└── README.md
\`\`\`

---

## Default Users

| Username | Password  | Role  |
|----------|-----------|-------|
| admin    | admin123  | Admin |

---

## API Endpoints

| Method | Endpoint                    | Description          |
|--------|-----------------------------|--------------------- |
| POST   | /api/auth/login             | Login                |
| GET    | /api/dashboard              | Dashboard data       |
| GET    | /api/products               | List products        |
| POST   | /api/products               | Create product       |
| GET    | /api/suppliers              | List suppliers       |
| GET    | /api/customers              | List customers       |
| POST   | /api/purchases              | Create purchase      |
| POST   | /api/stock/manual-in        | Manual stock in      |
| GET    | /api/deliveries             | List deliveries      |
| POST   | /api/deliveries             | Create delivery      |
| POST   | /api/deliveries/{id}/confirm| Confirm delivery     |
| GET    | /api/movements              | Stock movements      |
| GET    | /api/users                  | List users           |

---

## Troubleshooting

### Port already in use
\`\`\`bash
# ดู port ที่ใช้อยู่
lsof -i :5432
lsof -i :8000
lsof -i :3000

# หรือเปลี่ยน port ใน docker-compose.yml
\`\`\`

### Database connection error
\`\`\`bash
# รอ postgres start ก่อน
docker-compose logs postgres

# Restart backend
docker-compose restart backend
\`\`\`

### Reset everything
\`\`\`bash
docker-compose down -v
docker-compose up -d --build
