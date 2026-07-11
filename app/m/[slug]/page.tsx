import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getMarketBySlug, listVendorsWithMenus } from '@/lib/data'
import MarketBrowser from '../../market/market-browser'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const market = await getMarketBySlug(slug)
  return { title: market ? `${market.name} — order from every stall` : 'Market not found' }
}

export default async function MarketPage({ params }: Props) {
  const { slug } = await params
  const market = await getMarketBySlug(slug)
  if (!market) notFound()

  const stalls = await listVendorsWithMenus(market.id)

  return (
    <MarketBrowser
      market={{ slug: market.slug, name: market.name }}
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
