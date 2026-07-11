'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { formatMoney } from '@/lib/format'
import { getStoredOrders } from '@/lib/loyalty'
import BottomNav from '../bottom-nav'
import type { OrderLineItem, OrderStatus } from '@/lib/types'

interface LoyaltyOrder {
  id: string
  order_number: number
  items: OrderLineItem[]
  total_pence: number
  status: OrderStatus
  created_at: string
  vendor: { slug: string; name: string; emoji: string; currency: string }
}

const STAMPS_PER_CARD = 10
// A stamp is any order that was actually paid for (not pending/cancelled).
const STAMPABLE: OrderStatus[] = ['paid', 'preparing', 'ready', 'collected']

export default function StampCard() {
  const [orders, setOrders] = useState<LoyaltyOrder[] | null>(null)

  useEffect(() => {
    const stored = getStoredOrders()
    Promise.all(
      stored.map(async ({ id }) => {
        try {
          const res = await fetch(`/api/orders/${id}`, { cache: 'no-store' })
          return res.ok ? ((await res.json()) as LoyaltyOrder) : null
        } catch {
          return null
        }
      })
    ).then((results) =>
      setOrders(
        results
          .filter((order): order is LoyaltyOrder => order !== null)
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      )
    )
  }, [])

  const stamped = (orders ?? []).filter((order) => STAMPABLE.includes(order.status))
  const byVendor = new Map<string, { vendor: LoyaltyOrder['vendor']; orders: LoyaltyOrder[] }>()
  for (const order of stamped) {
    const entry = byVendor.get(order.vendor.slug) ?? { vendor: order.vendor, orders: [] }
    entry.orders.push(order)
    byVendor.set(order.vendor.slug, entry)
  }
  const totalSpentByCurrency = new Map<string, number>()
  for (const order of stamped) {
    totalSpentByCurrency.set(
      order.vendor.currency,
      (totalSpentByCurrency.get(order.vendor.currency) ?? 0) + order.total_pence
    )
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-paper px-5 pb-28 pt-8 text-midnight">
      <h1 className="font-display text-4xl leading-none text-ink">MY STAMPS</h1>
      <p className="mt-1 text-midnight/60">
        Every order on this device earns a stamp. Fill a card, show it at the stall.
      </p>

      {orders === null && <p className="mt-8 text-midnight/40">Loading your orders…</p>}

      {orders !== null && stamped.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-ink/30 p-8 text-center">
          <Image src="/icons/heart.png" alt="" width={64} height={64} className="mx-auto h-16 w-16" />
          <p className="mt-3 font-medium">No stamps yet</p>
          <p className="mt-1 text-sm text-midnight/60">Place your first order and it&apos;ll show up here.</p>
          <Link
            href="/market"
            className="mt-4 inline-block rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white"
          >
            Browse the market
          </Link>
        </div>
      )}

      {[...byVendor.values()].map(({ vendor, orders: vendorOrders }) => {
        const count = vendorOrders.length
        const onCard = count % STAMPS_PER_CARD || (count > 0 ? STAMPS_PER_CARD : 0)
        const completedCards = Math.floor((count - onCard) / STAMPS_PER_CARD)
        return (
          <section
            key={vendor.slug}
            className="mt-6 rounded-2xl border border-ink/20 bg-card p-5 shadow-sm"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="font-bold">
                {vendor.emoji} {vendor.name}
              </h2>
              <span className="text-sm text-midnight/60">
                {count} order{count === 1 ? '' : 's'}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {Array.from({ length: STAMPS_PER_CARD }, (_, i) => (
                <div
                  key={i}
                  className={`flex aspect-square items-center justify-center rounded-full border-2 text-lg ${
                    i < onCard
                      ? 'border-ink bg-ink/10'
                      : 'border-dashed border-ink/20 text-ink/30'
                  }`}
                >
                  {i < onCard ? vendor.emoji : i + 1}
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-midnight/60">
              {onCard === STAMPS_PER_CARD
                ? '🎉 Card complete — show this at the stall!'
                : `${STAMPS_PER_CARD - onCard} more to fill this card`}
              {completedCards > 0 && ` · ${completedCards} card${completedCards === 1 ? '' : 's'} completed`}
            </p>
          </section>
        )
      })}

      {stamped.length > 0 && (
        <section className="mt-6 rounded-2xl border border-ink/20 bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-midnight/40">History</h2>
          <ul className="mt-3 divide-y divide-ink/10">
            {stamped.map((order) => (
              <li key={order.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="font-medium">
                    {order.vendor.emoji} {order.vendor.name} · #{order.order_number}
                  </p>
                  <p className="text-midnight/60">
                    {new Date(order.created_at).toLocaleDateString()} ·{' '}
                    {order.items.reduce((n, item) => n + item.quantity, 0)} items
                  </p>
                </div>
                <span className="font-semibold">
                  {formatMoney(order.total_pence, order.vendor.currency)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-ink/10 pt-3 text-right text-sm font-bold">
            Total spent:{' '}
            {[...totalSpentByCurrency.entries()]
              .map(([currency, pence]) => formatMoney(pence, currency))
              .join(' + ')}
          </p>
        </section>
      )}

      <Link href="/market" className="mt-8 text-center text-sm font-medium text-ink">
        ← Back to market
      </Link>
      <BottomNav />
    </div>
  )
}
