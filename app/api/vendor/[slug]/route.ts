import { NextResponse } from 'next/server'
import { getVendorBySlug, setVendorOpen, vendorTokenMatches } from '@/lib/data'

// Stall-level settings; currently just the live open/closed status.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const vendor = await getVendorBySlug(slug)
  if (!vendor || !vendorTokenMatches(vendor, new URL(req.url).searchParams.get('token'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  if (typeof body?.open !== 'boolean') {
    return NextResponse.json({ error: '`open` boolean is required' }, { status: 400 })
  }
  const updated = await setVendorOpen(vendor.id, body.open)
  return NextResponse.json({ open: updated?.open ?? vendor.open })
}
