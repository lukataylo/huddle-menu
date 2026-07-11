import { NextResponse } from 'next/server'
import { getVendorByToken } from '@/lib/data'

// "Login" for stall owners: the stall key (admin token) is the credential.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  if (!token || token.length < 16) {
    return NextResponse.json({ error: 'Paste your stall key' }, { status: 400 })
  }
  const vendor = await getVendorByToken(token)
  if (!vendor) {
    return NextResponse.json({ error: 'No stall matches that key' }, { status: 401 })
  }
  return NextResponse.json({
    slug: vendor.slug,
    name: vendor.name,
    kitchenPath: `/v/${vendor.slug}/kitchen?token=${encodeURIComponent(vendor.admin_token)}`,
  })
}
