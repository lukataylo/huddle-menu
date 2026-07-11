import { NextResponse } from 'next/server'
import { createOrder, getVendorBySlug, setOrderPaymentId, updateOrderStatus } from '@/lib/data'
import { pool } from '@/lib/db'
import { toMollieAmount } from '@/lib/format'
import { getBaseUrl, getMollieClient, isMollieConfigured } from '@/lib/mollie'
import { createStripeCheckout, isStripeConfigured } from '@/lib/stripe'
import type { MenuItem, OrderLineItem } from '@/lib/types'

const MAX_LINE_ITEMS = 50
const MAX_QUANTITY = 20

interface CreateOrderBody {
  slug?: unknown
  customerName?: unknown
  items?: unknown
}

export async function POST(req: Request) {
  let body: CreateOrderBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const slug = typeof body.slug === 'string' ? body.slug : ''
  // Name is optional — the order number is the real claim ticket.
  const customerName =
    (typeof body.customerName === 'string' ? body.customerName.trim().slice(0, 60) : '') || 'Guest'
  const payMethod = (body as { payMethod?: unknown }).payMethod === 'cash' ? 'cash' : 'card'
  const rawItems = Array.isArray(body.items) ? body.items : []

  if (!slug || rawItems.length === 0 || rawItems.length > MAX_LINE_ITEMS) {
    return NextResponse.json(
      { error: 'slug and at least one item are required' },
      { status: 400 }
    )
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

  const vendor = await getVendorBySlug(slug)
  if (!vendor) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
  }

  // Re-price everything server-side against currently-available items.
  const { rows: menuItems } = await pool.query<MenuItem>(
    `SELECT * FROM menu_items WHERE vendor_id = $1 AND available = true AND id = ANY($2)`,
    [vendor.id, [...requested.keys()]]
  )
  if (menuItems.length !== requested.size) {
    return NextResponse.json(
      { error: 'Some items are no longer available. Please refresh the menu.' },
      { status: 409 }
    )
  }

  const lineItems: OrderLineItem[] = menuItems.map((item) => ({
    id: item.id,
    name: item.name,
    price_pence: item.price_pence,
    quantity: requested.get(item.id)!,
  }))

  // Cash orders stay pending until the stall taps "Mark paid" on the kitchen
  // screen. Without any payment provider configured (local dev), card orders
  // are created already paid. Card: Stripe when configured, else Mollie.
  const onlineConfigured = isStripeConfigured() || isMollieConfigured()
  const initialStatus = payMethod === 'cash' ? 'pending' : onlineConfigured ? 'pending' : 'paid'
  const order = await createOrder(vendor, customerName, lineItems, initialStatus)

  if (payMethod === 'cash' || !onlineConfigured) {
    return NextResponse.json({ orderId: order.id, checkoutUrl: null })
  }

  const baseUrl = getBaseUrl(req)
  if (isStripeConfigured()) {
    try {
      const { sessionId, url } = await createStripeCheckout({
        orderIds: [order.id],
        lineItems,
        currency: vendor.currency,
        description: `${vendor.name} order #${order.order_number}`,
        nextPath: `/v/${vendor.slug}/order/${order.id}`,
        cancelPath: `/v/${vendor.slug}`,
        baseUrl,
      })
      await setOrderPaymentId(order.id, sessionId)
      return NextResponse.json({ orderId: order.id, checkoutUrl: url })
    } catch (err) {
      console.error('[orders] Stripe checkout creation failed:', err)
      await updateOrderStatus(order.id, 'cancelled')
      return NextResponse.json(
        { error: 'Payment could not be started. Please try again.' },
        { status: 502 }
      )
    }
  }
  try {
    const payment = await getMollieClient().payments.create({
      amount: { currency: vendor.currency, value: toMollieAmount(order.total_pence) },
      description: `${vendor.name} order #${order.order_number}`,
      redirectUrl: `${baseUrl}/v/${vendor.slug}/order/${order.id}`,
      webhookUrl: `${baseUrl}/api/mollie/webhook`,
      metadata: { orderId: order.id },
    })
    await setOrderPaymentId(order.id, payment.id)
    return NextResponse.json({ orderId: order.id, checkoutUrl: payment.getCheckoutUrl() })
  } catch (err) {
    console.error('[orders] Mollie payment creation failed:', err)
    await updateOrderStatus(order.id, 'cancelled')
    return NextResponse.json({ error: 'Payment could not be started. Please try again.' }, { status: 502 })
  }
}
