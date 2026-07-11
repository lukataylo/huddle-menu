import { NextResponse } from 'next/server'
import { getVendorBySlug, listKitchenOrders, vendorTokenMatches } from '@/lib/data'

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const vendor = await getVendorBySlug(slug)
  if (!vendor || !vendorTokenMatches(vendor, new URL(req.url).searchParams.get('token'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const orders = await listKitchenOrders(vendor.id)
  return NextResponse.json({ orders })
}
