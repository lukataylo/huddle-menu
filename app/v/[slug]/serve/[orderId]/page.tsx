import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getVendorBySlug } from '@/lib/data'
import ServeClient from './serve-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Serve ticket' }

export default async function ServePage({
  params,
}: {
  params: Promise<{ slug: string; orderId: string }>
}) {
  const { slug, orderId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) notFound()
  const vendor = await getVendorBySlug(slug)
  if (!vendor) notFound()
  return <ServeClient slug={slug} orderId={orderId} />
}
