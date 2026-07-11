import type { Metadata } from 'next'
import { listVendorsWithMenus } from '@/lib/data'
import MarketBrowser from './market-browser'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Huddle Market — Order from every stall' }

export default async function MarketPage() {
  const stalls = await listVendorsWithMenus()

  return (
    <MarketBrowser
      stalls={stalls.map(({ vendor, items }) => ({
        vendor: {
          slug: vendor.slug,
          name: vendor.name,
          emoji: vendor.emoji,
          currency: vendor.currency,
        },
        items,
      }))}
    />
  )
}
