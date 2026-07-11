import { NextResponse } from 'next/server'
import { getVendorBySlug, setMenuItemAvailability, vendorTokenMatches } from '@/lib/data'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string; itemId: string }> }
) {
  const { slug, itemId } = await params
  const vendor = await getVendorBySlug(slug)
  if (!vendor || !vendorTokenMatches(vendor, new URL(req.url).searchParams.get('token'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (typeof body?.available !== 'boolean') {
    return NextResponse.json({ error: '`available` boolean is required' }, { status: 400 })
  }

  const item = await setMenuItemAvailability(vendor.id, itemId, body.available)
  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }
  return NextResponse.json({ item })
}
