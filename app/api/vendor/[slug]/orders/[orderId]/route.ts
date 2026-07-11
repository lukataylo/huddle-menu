import { NextResponse } from 'next/server'
import { getOrder, getVendorBySlug, updateOrderStatus, vendorTokenMatches } from '@/lib/data'
import type { OrderStatus } from '@/lib/types'

// Which statuses the kitchen may move an order FROM, per target status.
// 'paid' from 'pending' covers cash payments / dev mode without Mollie.
const ALLOWED_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  paid: ['pending'],
  preparing: ['paid'],
  ready: ['preparing', 'paid'],
  collected: ['ready'],
  cancelled: ['pending', 'paid', 'preparing', 'ready'],
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string; orderId: string }> }
) {
  const { slug, orderId } = await params
  const vendor = await getVendorBySlug(slug)
  if (!vendor || !vendorTokenMatches(vendor, new URL(req.url).searchParams.get('token'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const status = body?.status as OrderStatus | undefined
  const allowedFrom = status ? ALLOWED_TRANSITIONS[status] : undefined
  if (!status || !allowedFrom) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const existing = await getOrder(orderId)
  if (!existing || existing.vendor_id !== vendor.id) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const order = await updateOrderStatus(orderId, status, allowedFrom)
  if (!order) {
    return NextResponse.json(
      { error: `Order is '${existing.status}', cannot move to '${status}'` },
      { status: 409 }
    )
  }
  return NextResponse.json({ order })
}
