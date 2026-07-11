import { NextResponse, after } from 'next/server'
import {
  createOrGetMarket,
  createVendorWithMenu,
  getMarketById,
  type NewMenuItem,
} from '@/lib/data'
import { generateAndSaveStallArt } from '@/lib/generate-art'
import type { Market } from '@/lib/types'

const MAX_ITEMS = 100

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : ''
  const emoji = typeof body?.emoji === 'string' && body.emoji ? body.emoji.slice(0, 8) : '🍽️'
  const currency = typeof body?.currency === 'string' ? body.currency : 'GBP'
  const marketId = typeof body?.marketId === 'string' ? body.marketId : null
  const marketName =
    typeof body?.marketName === 'string' ? body.marketName.trim().slice(0, 80) : ''
  const rawItems = Array.isArray(body?.items) ? body.items : []

  if (!name || rawItems.length === 0 || rawItems.length > MAX_ITEMS) {
    return NextResponse.json(
      { error: 'A stall name and at least one menu item are required' },
      { status: 400 }
    )
  }

  const items: NewMenuItem[] = []
  for (const raw of rawItems) {
    const itemName = typeof raw?.name === 'string' ? raw.name.trim().slice(0, 120) : ''
    const pricePence = Number.isInteger(raw?.price_pence) ? (raw.price_pence as number) : NaN
    if (!itemName || !(pricePence >= 0 && pricePence <= 100_000_00)) {
      return NextResponse.json(
        { error: 'Each item needs a name and a non-negative price' },
        { status: 400 }
      )
    }
    items.push({
      name: itemName,
      description: typeof raw?.description === 'string' ? raw.description.trim().slice(0, 300) : '',
      price_pence: pricePence,
      category: typeof raw?.category === 'string' && raw.category.trim()
        ? raw.category.trim().slice(0, 60)
        : 'Menu',
    })
  }

  // Stalls can join an existing market, create one on the spot, or stay independent.
  let market: Market | null = null
  if (marketId) {
    market = await getMarketById(marketId)
    if (!market) {
      return NextResponse.json({ error: 'That market no longer exists' }, { status: 400 })
    }
  } else if (marketName) {
    market = await createOrGetMarket(marketName)
  }

  const vendor = await createVendorWithMenu(name, emoji, currency, items, market?.id ?? null)
  // Draw the stall's hand-drawn logo after the response is sent.
  after(() => generateAndSaveStallArt(vendor))
  return NextResponse.json({
    slug: vendor.slug,
    adminToken: vendor.admin_token,
    menuPath: `/v/${vendor.slug}`,
    kitchenPath: `/v/${vendor.slug}/kitchen?token=${encodeURIComponent(vendor.admin_token)}`,
    marketName: market?.name ?? null,
    marketPath: market ? `/m/${market.slug}` : null,
  })
}
