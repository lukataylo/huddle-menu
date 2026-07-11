import { pool } from '../lib/db'

const STATEMENTS = [
  `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`,
  `CREATE TABLE IF NOT EXISTS vendors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text UNIQUE NOT NULL,
    admin_token text NOT NULL,
    name text NOT NULL,
    emoji text NOT NULL DEFAULT '🍽️',
    currency text NOT NULL DEFAULT 'GBP',
    next_order_number int NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
  );`,
  `CREATE TABLE IF NOT EXISTS menu_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    price_pence int NOT NULL DEFAULT 0,
    category text NOT NULL DEFAULT 'Menu',
    available boolean NOT NULL DEFAULT true,
    sort int NOT NULL DEFAULT 0
  );`,
  `CREATE TABLE IF NOT EXISTS orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    order_number int NOT NULL,
    customer_name text NOT NULL,
    items jsonb NOT NULL,
    total_pence int NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','preparing','ready','collected','cancelled')),
    mollie_payment_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );`,
  `CREATE TABLE IF NOT EXISTS markets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text UNIQUE NOT NULL,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );`,
  `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS market_id uuid REFERENCES markets(id) ON DELETE SET NULL;`,
  `CREATE TABLE IF NOT EXISTS vendor_art (
    vendor_id uuid PRIMARY KEY REFERENCES vendors(id) ON DELETE CASCADE,
    png bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );`,
  `CREATE INDEX IF NOT EXISTS idx_vendors_market ON vendors(market_id);`,
  `CREATE INDEX IF NOT EXISTS idx_menu_items_vendor ON menu_items(vendor_id);`,
  `CREATE INDEX IF NOT EXISTS idx_orders_vendor ON orders(vendor_id);`,
  `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(vendor_id, status);`,
]

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error('[migrate] ERROR: DATABASE_URL is not set. Aborting.')
    process.exit(1)
  }

  const client = await pool.connect()
  try {
    console.log('[migrate] Connected to database. Running migrations...')
    for (const statement of STATEMENTS) {
      const label = statement.trim().split('\n')[0].slice(0, 80)
      await client.query(statement)
      console.log(`[migrate] OK: ${label}`)
    }
    console.log('[migrate] All migrations applied successfully.')
  } catch (err) {
    console.error('[migrate] FAILED:', err)
    client.release()
    await pool.end()
    process.exit(1)
  }
  client.release()
  await pool.end()
  process.exit(0)
}

migrate()
