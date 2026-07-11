import crypto from 'crypto'
import { pool } from './db'
import type { Market, MenuItem, Order, OrderLineItem, OrderStatus, Vendor } from './types'

export async function getMarketById(id: string): Promise<Market | null> {
  const { rows } = await pool.query<Market>(`SELECT * FROM markets WHERE id = $1`, [id])
  return rows[0] ?? null
}

export async function getMarketBySlug(slug: string): Promise<Market | null> {
  const { rows } = await pool.query<Market>(`SELECT * FROM markets WHERE slug = $1`, [slug])
  return rows[0] ?? null
}

export interface MarketWithCount extends Market {
  stall_count: number
}

export async function listMarkets(): Promise<MarketWithCount[]> {
  const { rows } = await pool.query<MarketWithCount>(
    `SELECT m.*, count(v.id)::int AS stall_count
     FROM markets m LEFT JOIN vendors v ON v.market_id = m.id
     GROUP BY m.id ORDER BY m.created_at`
  )
  return rows
}

/** Finds a market whose slug matches the name, or creates it. */
export async function createOrGetMarket(name: string): Promise<Market> {
  const slug = slugify(name)
  const { rows } = await pool.query<Market>(
    `INSERT INTO markets (slug, name) VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET slug = markets.slug RETURNING *`,
    [slug, name]
  )
  return rows[0]
}

export async function getVendorArt(vendorId: string): Promise<Buffer | null> {
  const { rows } = await pool.query<{ png: Buffer }>(
    `SELECT png FROM vendor_art WHERE vendor_id = $1`,
    [vendorId]
  )
  return rows[0]?.png ?? null
}

export async function setVendorArt(vendorId: string, png: Buffer): Promise<void> {
  await pool.query(
    `INSERT INTO vendor_art (vendor_id, png) VALUES ($1, $2)
     ON CONFLICT (vendor_id) DO UPDATE SET png = EXCLUDED.png, created_at = now()`,
    [vendorId, png]
  )
}

export async function getVendorBySlug(slug: string): Promise<Vendor | null> {
  const { rows } = await pool.query<Vendor>(`SELECT * FROM vendors WHERE slug = $1`, [slug])
  return rows[0] ?? null
}

export async function listVendors(): Promise<Vendor[]> {
  const { rows } = await pool.query<Vendor>(`SELECT * FROM vendors ORDER BY created_at`)
  return rows
}

export interface VendorWithMenu {
  vendor: Vendor
  items: MenuItem[]
}

export async function listVendorsWithMenus(marketId?: string): Promise<VendorWithMenu[]> {
  const vendors = marketId
    ? (
        await pool.query<Vendor>(
          `SELECT * FROM vendors WHERE market_id = $1 ORDER BY created_at`,
          [marketId]
        )
      ).rows
    : await listVendors()
  if (vendors.length === 0) return []
  const { rows: items } = await pool.query<MenuItem>(
    `SELECT * FROM menu_items WHERE vendor_id = ANY($1) ORDER BY sort, name`,
    [vendors.map((v) => v.id)]
  )
  return vendors.map((vendor) => ({
    vendor,
    items: items.filter((item) => item.vendor_id === vendor.id),
  }))
}

export interface OrderWithVendor extends Order {
  vendor_slug: string
  vendor_name: string
  vendor_emoji: string
  vendor_currency: string
}

export async function getOrderWithVendor(orderId: string): Promise<OrderWithVendor | null> {
  const { rows } = await pool.query<OrderWithVendor>(
    `SELECT o.*, v.slug AS vendor_slug, v.name AS vendor_name,
            v.emoji AS vendor_emoji, v.currency AS vendor_currency
     FROM orders o JOIN vendors v ON v.id = o.vendor_id
     WHERE o.id = $1`,
    [orderId]
  )
  return rows[0] ?? null
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-+|-+$)/g, '')
      .slice(0, 40) || 'stall'
  )
}

export interface NewMenuItem {
  name: string
  description: string
  price_pence: number
  category: string
}

export async function createVendorWithMenu(
  name: string,
  emoji: string,
  currency: string,
  items: NewMenuItem[],
  marketId: string | null = null
): Promise<Vendor> {
  const adminToken = crypto.randomBytes(24).toString('base64url')
  const base = slugify(name)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    let vendor: Vendor | null = null
    for (let attempt = 0; attempt < 5 && !vendor; attempt++) {
      const slug = attempt === 0 ? base : `${base}-${crypto.randomBytes(2).toString('hex')}`
      const { rows } = await client.query<Vendor>(
        `INSERT INTO vendors (slug, admin_token, name, emoji, currency, market_id)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (slug) DO NOTHING RETURNING *`,
        [slug, adminToken, name, emoji, currency, marketId]
      )
      vendor = rows[0] ?? null
    }
    if (!vendor) throw new Error('Could not find a free slug')
    for (const [sort, item] of items.entries()) {
      await client.query(
        `INSERT INTO menu_items (vendor_id, name, description, price_pence, category, available, sort)
         VALUES ($1, $2, $3, $4, $5, true, $6)`,
        [vendor.id, item.name, item.description, item.price_pence, item.category, sort]
      )
    }
    await client.query('COMMIT')
    return vendor
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function getMenuItems(vendorId: string): Promise<MenuItem[]> {
  const { rows } = await pool.query<MenuItem>(
    `SELECT * FROM menu_items WHERE vendor_id = $1 ORDER BY sort, name`,
    [vendorId]
  )
  return rows
}

export async function getOrder(orderId: string): Promise<Order | null> {
  const { rows } = await pool.query<Order>(`SELECT * FROM orders WHERE id = $1`, [orderId])
  return rows[0] ?? null
}

/**
 * Creates an order in a single transaction, drawing the vendor's
 * per-vendor order number from its counter.
 */
export async function createOrder(
  vendor: Vendor,
  customerName: string,
  items: OrderLineItem[],
  status: OrderStatus
): Promise<Order> {
  const totalPence = items.reduce((sum, item) => sum + item.price_pence * item.quantity, 0)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const counter = await client.query<{ order_number: number }>(
      `UPDATE vendors SET next_order_number = next_order_number + 1
       WHERE id = $1 RETURNING next_order_number - 1 AS order_number`,
      [vendor.id]
    )
    const { rows } = await client.query<Order>(
      `INSERT INTO orders (vendor_id, order_number, customer_name, items, total_pence, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        vendor.id,
        counter.rows[0].order_number,
        customerName,
        JSON.stringify(items),
        totalPence,
        status,
      ]
    )
    await client.query('COMMIT')
    return rows[0]
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function setOrderPaymentId(orderId: string, molliePaymentId: string): Promise<void> {
  await pool.query(
    `UPDATE orders SET mollie_payment_id = $2, updated_at = now() WHERE id = $1`,
    [orderId, molliePaymentId]
  )
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  allowedFrom?: OrderStatus[]
): Promise<Order | null> {
  const { rows } = await pool.query<Order>(
    allowedFrom
      ? `UPDATE orders SET status = $2, updated_at = now()
         WHERE id = $1 AND status = ANY($3) RETURNING *`
      : `UPDATE orders SET status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    allowedFrom ? [orderId, status, allowedFrom] : [orderId, status]
  )
  return rows[0] ?? null
}

export interface QueueStats {
  /** Highest ticket number currently called (or recently served) — the "now serving" board. */
  now_serving: number | null
  /** Tickets still waiting ahead of the given ticket (all waiting if no ticket given). */
  ahead: number
  waiting_count: number
}

// Queue semantics reuse order statuses: paid = waiting, ready = called,
// collected = served, cancelled = left/no-show.
export async function getQueueStats(vendorId: string, beforeOrderNumber?: number): Promise<QueueStats> {
  const { rows } = await pool.query<{ now_serving: number | null; ahead: string; waiting_count: string }>(
    `SELECT
       (SELECT MAX(order_number) FROM orders
        WHERE vendor_id = $1 AND status IN ('ready', 'collected')
          AND updated_at > now() - interval '6 hours') AS now_serving,
       (SELECT COUNT(*) FROM orders
        WHERE vendor_id = $1 AND status = 'paid' AND order_number < COALESCE($2, 2147483647)) AS ahead,
       (SELECT COUNT(*) FROM orders WHERE vendor_id = $1 AND status = 'paid') AS waiting_count`,
    [vendorId, beforeOrderNumber ?? null]
  )
  return {
    now_serving: rows[0].now_serving,
    ahead: Number(rows[0].ahead),
    waiting_count: Number(rows[0].waiting_count),
  }
}

/** Orders the kitchen cares about: everything active, plus recently finished ones. */
export async function listKitchenOrders(vendorId: string): Promise<Order[]> {
  const { rows } = await pool.query<Order>(
    `SELECT * FROM orders
     WHERE vendor_id = $1
       AND (status IN ('pending', 'paid', 'preparing', 'ready')
            OR (status IN ('collected', 'cancelled') AND updated_at > now() - interval '2 hours'))
     ORDER BY order_number`,
    [vendorId]
  )
  return rows
}

export async function setMenuItemAvailability(
  vendorId: string,
  itemId: string,
  available: boolean
): Promise<MenuItem | null> {
  const { rows } = await pool.query<MenuItem>(
    `UPDATE menu_items SET available = $3 WHERE id = $2 AND vendor_id = $1 RETURNING *`,
    [vendorId, itemId, available]
  )
  return rows[0] ?? null
}

/** Item ids ranked by how often they've actually been ordered. */
export async function getPopularItemIds(vendorId: string, limit = 3): Promise<string[]> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT li->>'id' AS id
     FROM orders o, jsonb_array_elements(o.items) li
     WHERE o.vendor_id = $1 AND o.status IN ('paid', 'preparing', 'ready', 'collected')
     GROUP BY 1 HAVING SUM((li->>'quantity')::int) >= 2
     ORDER BY SUM((li->>'quantity')::int) DESC LIMIT $2`,
    [vendorId, limit]
  )
  return rows.map((row) => row.id)
}

/** Waiting-group counts for every vendor in one query, for wait-time chips. */
export async function getWaitingCounts(): Promise<Map<string, number>> {
  const { rows } = await pool.query<{ vendor_id: string; waiting: string }>(
    `SELECT vendor_id, count(*) AS waiting FROM orders
     WHERE status IN ('paid', 'preparing') GROUP BY vendor_id`
  )
  return new Map(rows.map((row) => [row.vendor_id, Number(row.waiting)]))
}

export interface MenuItemPatch {
  name?: string
  description?: string
  price_pence?: number
  category?: string
  available?: boolean
}

export async function updateMenuItem(
  vendorId: string,
  itemId: string,
  patch: MenuItemPatch
): Promise<MenuItem | null> {
  const { rows } = await pool.query<MenuItem>(
    `UPDATE menu_items SET
       name = COALESCE($3, name),
       description = COALESCE($4, description),
       price_pence = COALESCE($5, price_pence),
       category = COALESCE($6, category),
       available = COALESCE($7, available)
     WHERE id = $2 AND vendor_id = $1 RETURNING *`,
    [
      vendorId,
      itemId,
      patch.name ?? null,
      patch.description ?? null,
      patch.price_pence ?? null,
      patch.category ?? null,
      patch.available ?? null,
    ]
  )
  return rows[0] ?? null
}

export async function addMenuItem(vendorId: string, item: NewMenuItem): Promise<MenuItem> {
  const { rows } = await pool.query<MenuItem>(
    `INSERT INTO menu_items (vendor_id, name, description, price_pence, category, available, sort)
     VALUES ($1, $2, $3, $4, $5, true,
             (SELECT COALESCE(MAX(sort), 0) + 1 FROM menu_items WHERE vendor_id = $1))
     RETURNING *`,
    [vendorId, item.name, item.description, item.price_pence, item.category]
  )
  return rows[0]
}

export async function deleteMenuItem(vendorId: string, itemId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM menu_items WHERE id = $2 AND vendor_id = $1`,
    [vendorId, itemId]
  )
  return (rowCount ?? 0) > 0
}

export interface VendorSales {
  today_orders: number
  today_pence: number
  total_orders: number
  total_pence: number
}

/** Money view: revenue counts only orders that were actually paid/served. */
export async function getVendorSales(vendorId: string): Promise<VendorSales> {
  const { rows } = await pool.query<{
    today_orders: string
    today_pence: string
    total_orders: string
    total_pence: string
  }>(
    `SELECT
       count(*) FILTER (WHERE created_at >= date_trunc('day', now())) AS today_orders,
       COALESCE(SUM(total_pence) FILTER (WHERE created_at >= date_trunc('day', now())), 0) AS today_pence,
       count(*) AS total_orders,
       COALESCE(SUM(total_pence), 0) AS total_pence
     FROM orders
     WHERE vendor_id = $1 AND status IN ('paid', 'preparing', 'ready', 'collected')`,
    [vendorId]
  )
  const row = rows[0]
  return {
    today_orders: Number(row.today_orders),
    today_pence: Number(row.today_pence),
    total_orders: Number(row.total_orders),
    total_pence: Number(row.total_pence),
  }
}

export async function listOrderHistory(vendorId: string, limit = 100): Promise<Order[]> {
  const { rows } = await pool.query<Order>(
    `SELECT * FROM orders WHERE vendor_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [vendorId, limit]
  )
  return rows
}

/** Constant-ish time compare is overkill here, but avoid trivially empty tokens. */
export function vendorTokenMatches(vendor: Vendor, token: string | null): boolean {
  return Boolean(token) && token === vendor.admin_token
}

/** Login by stall key alone: the token is unique enough to identify the vendor. */
export async function getVendorByToken(token: string): Promise<Vendor | null> {
  if (!token) return null
  const { rows } = await pool.query<Vendor>(`SELECT * FROM vendors WHERE admin_token = $1`, [token])
  return rows[0] ?? null
}

export async function setVendorOpen(vendorId: string, open: boolean): Promise<Vendor | null> {
  const { rows } = await pool.query<Vendor>(
    `UPDATE vendors SET open = $2 WHERE id = $1 RETURNING *`,
    [vendorId, open]
  )
  return rows[0] ?? null
}
