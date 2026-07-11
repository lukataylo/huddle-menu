import { NextResponse } from 'next/server'
import { listMarkets } from '@/lib/data'

export async function GET() {
  const markets = await listMarkets()
  return NextResponse.json({
    markets: markets.map((market) => ({
      id: market.id,
      slug: market.slug,
      name: market.name,
      stall_count: market.stall_count,
    })),
  })
}
