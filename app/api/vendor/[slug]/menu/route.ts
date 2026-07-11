import { NextResponse } from 'next/server'
import { addMenuItem, getVendorBySlug, vendorTokenMatches } from '@/lib/data'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const vendor = await getVendorBySlug(slug)
  if (!vendor || !vendorTokenMatches(vendor, new URL(req.url).searchParams.get('token'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : ''
  const pricePence = Number.isInteger(body?.price_pence) ? (body.price_pence as number) : NaN
  if (!name || !(pricePence >= 0 && pricePence <= 100_000_00)) {
    return NextResponse.json(
      { error: 'A name and a non-negative price are required' },
      { status: 400 }
    )
  }

  const item = await addMenuItem(vendor.id, {
    name,
    description: typeof body?.description === 'string' ? body.description.trim().slice(0, 300) : '',
    price_pence: pricePence,
    category:
      typeof body?.category === 'string' && body.category.trim()
        ? body.category.trim().slice(0, 60)
        : 'Menu',
  })
  return NextResponse.json({ item })
}
