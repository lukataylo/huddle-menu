import { NextResponse } from 'next/server'
import { getOrderWithVendor, getQueueStats } from '@/lib/data'

// The order id is an unguessable uuid, so exposing the order's own
// details to whoever holds it is the intended access model.
export async function GET(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  const order = await getOrderWithVendor(orderId)
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  const queue = await getQueueStats(order.vendor_id, order.order_number)
  return NextResponse.json({
    queue,
    id: order.id,
    order_number: order.order_number,
    customer_name: order.customer_name,
    items: order.items,
    total_pence: order.total_pence,
    status: order.status,
    // Pending with no Mollie payment attached means the customer chose cash.
    awaiting_cash: order.status === 'pending' && !order.mollie_payment_id,
    created_at: order.created_at,
    vendor: {
      slug: order.vendor_slug,
      name: order.vendor_name,
      emoji: order.vendor_emoji,
      currency: order.vendor_currency,
    },
  })
}
