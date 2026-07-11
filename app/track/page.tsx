import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import MultiTracker from './multi-tracker'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Your orders' }

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>
}) {
  const { ids } = await searchParams
  const orderIds = (ids ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
    .slice(0, 20)
  if (orderIds.length === 0) notFound()

  return <MultiTracker orderIds={orderIds} />
}
