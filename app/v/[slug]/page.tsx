import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getMenuItems, getPopularItemIds, getQueueStats, getVendorBySlug } from '@/lib/data'
import MenuBrowser from './menu-browser'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const vendor = await getVendorBySlug(slug)
  return { title: vendor ? `${vendor.name} — Order` : 'Menu' }
}

export default async function VendorMenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const vendor = await getVendorBySlug(slug)
  if (!vendor) notFound()

  const [items, queue, popularIds] = await Promise.all([
    getMenuItems(vendor.id),
    getQueueStats(vendor.id),
    getPopularItemIds(vendor.id),
  ])

  return (
    <MenuBrowser
      vendor={{
        slug: vendor.slug,
        name: vendor.name,
        emoji: vendor.emoji,
        currency: vendor.currency,
        open: vendor.open,
      }}
      items={items}
      queue={{ waiting: queue.waiting_count, nowServing: queue.now_serving }}
      popularIds={popularIds}
    />
  )
}
