-- Create tables for Stock Management System

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    tax_id VARCHAR(30),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    tax_id VARCHAR(30),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    unit VARCHAR(20) NOT NULL DEFAULT 'ชิ้น',
    min_stock INTEGER DEFAULT 0,
    image_url VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Purchases table (บิลซื้อเข้า)
CREATE TABLE IF NOT EXISTS purchases (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) NOT NULL,
    supplier_id INTEGER REFERENCES suppliers(id),
    purchase_date DATE NOT NULL,
    total_amount DECIMAL(12,2) DEFAULT 0,
    notes TEXT,
    attachment_url VARCHAR(255),
    status VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN ('draft', 'confirmed', 'cancelled')),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Purchase Items table
CREATE TABLE IF NOT EXISTS purchase_items (
    id SERIAL PRIMARY KEY,
    purchase_id INTEGER REFERENCES purchases(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Deliveries table (ใบส่งของ)
CREATE TABLE IF NOT EXISTS deliveries (
    id SERIAL PRIMARY KEY,
    delivery_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id),
    delivery_date DATE NOT NULL,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'cancelled')),
    confirmed_by INTEGER REFERENCES users(id),
    confirmed_at TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Delivery Items table
CREATE TABLE IF NOT EXISTS delivery_items (
    id SERIAL PRIMARY KEY,
    delivery_id INTEGER REFERENCES deliveries(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stock Movements table (ประวัติการเคลื่อนไหว)
CREATE TABLE IF NOT EXISTS movements (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id),
    movement_type VARCHAR(10) NOT NULL CHECK (movement_type IN ('IN', 'OUT')),
    quantity INTEGER NOT NULL,
    reference_type VARCHAR(20), -- 'purchase', 'delivery', 'manual', 'return'
    reference_id INTEGER,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_movements_product ON movements(product_id);
CREATE INDEX idx_movements_type ON movements(movement_type);
CREATE INDEX idx_movements_created ON movements(created_at);
CREATE INDEX idx_products_code ON products(code);
CREATE INDEX idx_deliveries_number ON deliveries(delivery_number);
CREATE INDEX idx_purchases_invoice ON purchases(invoice_number);

-- Insert default admin user (password: admin123)
INSERT INTO users (username, email, password_hash, full_name, role) 
VALUES ('admin', 'admin@company.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.6HwC8c/K3i1Y9e', 'Administrator', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Insert sample suppliers
INSERT INTO suppliers (name, contact_person, phone, email) VALUES
('บริษัท ซัพพลาย จำกัด', 'คุณสมชาย', '02-123-4567', 'supply@example.com'),
('ร้านขายส่งอุปกรณ์ทำความสะอาด', 'คุณสมหญิง', '02-234-5678', 'wholesale@example.com')
ON CONFLICT DO NOTHING;

-- Insert sample customers
INSERT INTO customers (name, contact_person, phone, address) VALUES
('บริษัท ABC จำกัด', 'คุณวิชัย', '02-345-6789', '123 ถนนสุขุมวิท กรุงเทพฯ'),
('โรงแรม Grand Palace', 'คุณนภา', '02-456-7890', '456 ถนนเพชรบุรี กรุงเทพฯ'),
('อาคาร Tower One', 'คุณประภา', '02-567-8901', '789 ถนนสีลม กรุงเทพฯ')
ON CONFLICT DO NOTHING;

-- Insert sample products
INSERT INTO products (code, name, unit, min_stock) VALUES
('CLN-001', 'น้ำยาทำความสะอาดพื้น 5L', 'แกลลอน', 10),
('CLN-002', 'น้ำยาล้างห้องน้ำ 1L', 'ขวด', 20),
('CLN-003', 'น้ำยาเช็ดกระจก 500ml', 'ขวด', 15),
('EQP-001', 'ไม้กวาด', 'อัน', 5),
('EQP-002', 'ไม้ถูพื้น', 'อัน', 5),
('EQP-003', 'ถังน้ำ 20L', 'ใบ', 3),
('CON-001', 'ถุงมือยาง', 'คู่', 50),
('CON-002', 'ผ้าเช็ดทำความสะอาด', 'ผืน', 30)
ON CONFLICT (code) DO NOTHING;
