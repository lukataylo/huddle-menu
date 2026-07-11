import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getOrder, getQueueStats, getVendorBySlug } from '@/lib/data'
import OrderTracker from './order-tracker'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Your place in the queue' }

export default async function OrderPage({
  params,
}: {
  params: Promise<{ slug: string; orderId: string }>
}) {
  const { slug, orderId } = await params
  const vendor = await getVendorBySlug(slug)
  if (!vendor) notFound()
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) notFound()
  const order = await getOrder(orderId)
  if (!order || order.vendor_id !== vendor.id) notFound()
  const queue = await getQueueStats(vendor.id, order.order_number)

  return (
    <OrderTracker
      initialQueue={queue}
      vendor={{ slug: vendor.slug, name: vendor.name, emoji: vendor.emoji, currency: vendor.currency }}
      initialOrder={{
        id: order.id,
        order_number: order.order_number,
        customer_name: order.customer_name,
        items: order.items,
        total_pence: order.total_pence,
        status: order.status,
      }}
    />
  )
}
