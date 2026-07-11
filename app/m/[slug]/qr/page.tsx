import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getMarketBySlug } from '@/lib/data'
import MarketQr from './market-qr'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const market = await getMarketBySlug(slug)
  return { title: market ? `${market.name} — market QR` : 'Market not found' }
}

export default async function MarketQrPage({ params }: Props) {
  const { slug } = await params
  const market = await getMarketBySlug(slug)
  if (!market) notFound()
  return <MarketQr slug={market.slug} name={market.name} />
}
