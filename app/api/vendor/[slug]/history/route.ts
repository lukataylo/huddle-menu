import { NextResponse } from 'next/server'
import { getVendorBySlug, getVendorSales, listOrderHistory, vendorTokenMatches } from '@/lib/data'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const vendor = await getVendorBySlug(slug)
  if (!vendor || !vendorTokenMatches(vendor, new URL(req.url).searchParams.get('token'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const [sales, orders] = await Promise.all([
    getVendorSales(vendor.id),
    listOrderHistory(vendor.id),
  ])
  return NextResponse.json({ sales, orders })
}
