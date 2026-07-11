import { NextResponse } from 'next/server'
import {
  deleteMenuItem,
  getVendorBySlug,
  updateMenuItem,
  vendorTokenMatches,
  type MenuItemPatch,
} from '@/lib/data'

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
  const patch: MenuItemPatch = {}
  if (typeof body?.available === 'boolean') patch.available = body.available
  if (typeof body?.name === 'string' && body.name.trim()) patch.name = body.name.trim().slice(0, 120)
  if (typeof body?.description === 'string') patch.description = body.description.trim().slice(0, 300)
  if (typeof body?.category === 'string' && body.category.trim())
    patch.category = body.category.trim().slice(0, 60)
  if (Number.isInteger(body?.price_pence) && body.price_pence >= 0 && body.price_pence <= 100_000_00)
    patch.price_pence = body.price_pence

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const item = await updateMenuItem(vendor.id, itemId, patch)
  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }
  return NextResponse.json({ item })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ slug: string; itemId: string }> }
) {
  const { slug, itemId } = await params
  const vendor = await getVendorBySlug(slug)
  if (!vendor || !vendorTokenMatches(vendor, new URL(req.url).searchParams.get('token'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const deleted = await deleteMenuItem(vendor.id, itemId)
  if (!deleted) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
