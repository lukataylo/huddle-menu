import { NextResponse } from 'next/server'
import { getVendorArt, getVendorBySlug } from '@/lib/data'
import { stallIconPath } from '@/lib/stall-icon'

// Serves the vendor's AI-generated logo; falls back to the closest
// hand-drawn icon from /public/stalls until (or unless) art exists.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const vendor = await getVendorBySlug(slug)
  if (!vendor) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
  }
  const art = await getVendorArt(vendor.id)
  if (!art) {
    // Relative redirect: an absolute URL built from req.url points at the
    // wrong host behind proxies (broken images on deploys).
    return new NextResponse(null, {
      status: 302,
      headers: { Location: stallIconPath(vendor.emoji, vendor.name), 'Cache-Control': 'no-store' },
    })
  }
  return new NextResponse(new Uint8Array(art), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
