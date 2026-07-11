import crypto from 'crypto'
import { pool } from './db'
import type { MenuItem, Order, OrderLineItem, OrderStatus, Vendor } from './types'

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

export async function listVendorsWithMenus(): Promise<VendorWithMenu[]> {
  const vendors = await listVendors()
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
  items: NewMenuItem[]
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
        `INSERT INTO vendors (slug, admin_token, name, emoji, currency)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (slug) DO NOTHING RETURNING *`,
        [slug, adminToken, name, emoji, currency]
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

/** Constant-ish time compare is overkill here, but avoid trivially empty tokens. */
export function vendorTokenMatches(vendor: Vendor, token: string | null): boolean {
  return Boolean(token) && token === vendor.admin_token
}
