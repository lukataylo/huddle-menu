import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getMenuItems, getVendorBySlug } from '@/lib/data'
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

  const items = await getMenuItems(vendor.id)

  return (
    <MenuBrowser
      vendor={{ slug: vendor.slug, name: vendor.name, emoji: vendor.emoji, currency: vendor.currency }}
      items={items}
    />
  )
}
