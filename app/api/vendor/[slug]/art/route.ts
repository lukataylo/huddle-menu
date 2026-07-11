import { NextResponse } from 'next/server'
import { getVendorArt, getVendorBySlug } from '@/lib/data'
import { stallIconPath } from '@/lib/stall-icon'

// Serves the vendor's AI-generated logo; falls back to the closest
// hand-drawn icon from /public/stalls until (or unless) art exists.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const vendor = await getVendorBySlug(slug)
  if (!vendor) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
  }
  const art = await getVendorArt(vendor.id)
  if (!art) {
    return NextResponse.redirect(new URL(stallIconPath(vendor.emoji, vendor.name), req.url), 302)
  }
  return new NextResponse(new Uint8Array(art), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
