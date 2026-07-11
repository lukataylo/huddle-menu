import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getMenuItems, getVendorBySlug, vendorTokenMatches } from '@/lib/data'
import KitchenBoard from './kitchen-board'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Kitchen' }

export default async function KitchenPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { slug } = await params
  const { token } = await searchParams
  const vendor = await getVendorBySlug(slug)
  if (!vendor) notFound()

  if (!vendorTokenMatches(vendor, token ?? null)) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-4xl">🔒</p>
        <h1 className="mt-3 text-xl font-bold">Kitchen access denied</h1>
        <p className="mt-2 text-sm text-stone-500">
          This page needs the vendor admin link. Check the URL you were given includes the correct{' '}
          <code className="rounded bg-stone-100 px-1">?token=</code>.
        </p>
      </div>
    )
  }

  const menuItems = await getMenuItems(vendor.id)

  return (
    <KitchenBoard
      vendor={{ slug: vendor.slug, name: vendor.name, emoji: vendor.emoji, currency: vendor.currency }}
      token={token!}
      initialMenuItems={menuItems}
    />
  )
}
