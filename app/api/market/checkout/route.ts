import { NextResponse } from 'next/server'
import { createOrder, getMarketBySlug, setOrderPaymentId, updateOrderStatus } from '@/lib/data'
import { pool } from '@/lib/db'
import { toMollieAmount } from '@/lib/format'
import { getBaseUrl, getMollieClient, isMollieConfigured } from '@/lib/mollie'
import type { MenuItem, Order, OrderLineItem, Vendor } from '@/lib/types'

const MAX_LINE_ITEMS = 50
const MAX_QUANTITY = 20

// One basket across every stall: creates one order per vendor, all covered
// by a single Mollie payment.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  // Name is optional — the order number is the real claim ticket.
  const customerName =
    (typeof body?.customerName === 'string' ? body.customerName.trim().slice(0, 60) : '') || 'Guest'
  const marketSlug = typeof body?.marketSlug === 'string' ? body.marketSlug : null
  const rawItems = Array.isArray(body?.items) ? body.items : []

  if (rawItems.length === 0 || rawItems.length > MAX_LINE_ITEMS) {
    return NextResponse.json({ error: 'At least one item is required' }, { status: 400 })
  }

  const requested = new Map<string, number>()
  for (const raw of rawItems) {
    const id = typeof raw?.id === 'string' ? raw.id : null
    const quantity = Number.isInteger(raw?.quantity) ? (raw.quantity as number) : 0
    if (!id || quantity < 1 || quantity > MAX_QUANTITY) {
      return NextResponse.json({ error: 'Each item needs an id and quantity 1-20' }, { status: 400 })
    }
    requested.set(id, (requested.get(id) ?? 0) + quantity)
  }

  const { rows: menuItems } = await pool.query<MenuItem>(
    `SELECT * FROM menu_items WHERE available = true AND id = ANY($1)`,
    [[...requested.keys()]]
  )
  if (menuItems.length !== requested.size) {
    return NextResponse.json(
      { error: 'Some items are no longer available. Please refresh the menu.' },
      { status: 409 }
    )
  }

  const { rows: vendors } = await pool.query<Vendor>(`SELECT * FROM vendors WHERE id = ANY($1)`, [
    [...new Set(menuItems.map((item) => item.vendor_id))],
  ])
  // A market-scoped basket may only contain that market's stalls.
  if (marketSlug) {
    const market = await getMarketBySlug(marketSlug)
    if (!market || vendors.some((vendor) => vendor.market_id !== market.id)) {
      return NextResponse.json(
        { error: 'Some items are not from this market. Please refresh the menu.' },
        { status: 400 }
      )
    }
  }
  const currencies = new Set(vendors.map((v) => v.currency))
  if (currencies.size > 1) {
    return NextResponse.json(
      { error: 'These stalls use different currencies and cannot share one payment.' },
      { status: 400 }
    )
  }
  const currency = vendors[0].currency

  const initialStatus = isMollieConfigured() ? 'pending' : 'paid'
  const orders: Order[] = []
  for (const vendor of vendors) {
    const lineItems: OrderLineItem[] = menuItems
      .filter((item) => item.vendor_id === vendor.id)
      .map((item) => ({
        id: item.id,
        name: item.name,
        price_pence: item.price_pence,
        quantity: requested.get(item.id)!,
      }))
    orders.push(await createOrder(vendor, customerName, lineItems, initialStatus))
  }

  const orderIds = orders.map((order) => order.id)
  const orderSummaries = orders.map((order) => ({
    id: order.id,
    slug: vendors.find((vendor) => vendor.id === order.vendor_id)!.slug,
  }))
  if (!isMollieConfigured()) {
    return NextResponse.json({ orderIds, orders: orderSummaries, checkoutUrl: null })
  }

  const totalPence = orders.reduce((sum, order) => sum + order.total_pence, 0)
  const baseUrl = getBaseUrl(req)
  try {
    const payment = await getMollieClient().payments.create({
      amount: { currency, value: toMollieAmount(totalPence) },
      description: `Huddle Market order for ${customerName}`,
      redirectUrl: `${baseUrl}/track?ids=${orderIds.join(',')}`,
      webhookUrl: `${baseUrl}/api/mollie/webhook`,
      metadata: { orderIds },
    })
    await Promise.all(orderIds.map((id) => setOrderPaymentId(id, payment.id)))
    return NextResponse.json({ orderIds, orders: orderSummaries, checkoutUrl: payment.getCheckoutUrl() })
  } catch (err) {
    console.error('[market checkout] Mollie payment creation failed:', err)
    await Promise.all(orderIds.map((id) => updateOrderStatus(id, 'cancelled')))
    return NextResponse.json(
      { error: 'Payment could not be started. Please try again.' },
      { status: 502 }
    )
  }
}
