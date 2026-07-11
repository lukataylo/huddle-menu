import type { Metadata } from 'next'
import { listMarkets } from '@/lib/data'
import OnboardWizard from './onboard-wizard'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Get your stall online — Huddle Menu' }

export default async function StartPage() {
  const markets = await listMarkets().catch(() => [])
  return (
    <OnboardWizard
      markets={markets.map((market) => ({ id: market.id, name: market.name }))}
    />
  )
}
