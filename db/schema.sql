-- =============================================================
-- StockPilot · Esquema relacional (PostgreSQL / Neon)
-- Ejecutar una vez sobre una base de datos vacía: psql "$DATABASE_URL" -f db/schema.sql
-- =============================================================

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,                       -- UID de Firebase Auth
  email       TEXT NOT NULL,
  full_name   TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 3 AND 80),
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 200)
);
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_lower_idx ON categories (lower(name));

CREATE TABLE IF NOT EXISTS suppliers (
  id     SERIAL PRIMARY KEY,
  name   TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  email  TEXT NOT NULL,
  phone  TEXT,
  city   TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id           SERIAL PRIMARY KEY,
  sku          TEXT NOT NULL CHECK (sku ~ '^[A-Z]{3,4}-[0-9]{4,6}$'),
  name         TEXT NOT NULL CHECK (char_length(name) BETWEEN 3 AND 120),
  category_id  INTEGER NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
  supplier_id  INTEGER NOT NULL REFERENCES suppliers (id) ON DELETE RESTRICT,
  price        NUMERIC(10, 2) NOT NULL CHECK (price > 0),
  stock        INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock    INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS products_sku_idx ON products (sku);
CREATE INDEX IF NOT EXISTS products_category_idx ON products (category_id);
CREATE INDEX IF NOT EXISTS products_supplier_idx ON products (supplier_id);

CREATE TABLE IF NOT EXISTS orders (
  id          SERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'cancelled')),
  total       NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
  notes       TEXT CHECK (notes IS NULL OR char_length(notes) <= 300),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_id);
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);

CREATE TABLE IF NOT EXISTS order_items (
  order_id    INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  unit_price  NUMERIC(10, 2) NOT NULL CHECK (unit_price > 0),
  PRIMARY KEY (order_id, product_id)
);
CREATE INDEX IF NOT EXISTS order_items_product_idx ON order_items (product_id);
