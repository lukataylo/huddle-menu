'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { formatMoney } from '@/lib/format'
import { stallArtSrc } from '@/lib/stall-icon'
import { rememberOrder } from '@/lib/loyalty'
import type { MenuItem } from '@/lib/types'

interface VendorInfo {
  slug: string
  name: string
  emoji: string
  currency: string
  open?: boolean
}

export default function MenuBrowser({
  vendor,
  items,
  queue,
  popularIds = [],
}: {
  vendor: VendorInfo
  items: MenuItem[]
  queue?: { waiting: number; nowServing: number | null }
  popularIds?: string[]
}) {
  const router = useRouter()
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [view, setView] = useState<'menu' | 'basket'>('menu')
  const [customerName, setCustomerName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const categories = useMemo(() => {
    const byCategory = new Map<string, MenuItem[]>()
    for (const item of items) {
      const list = byCategory.get(item.category) ?? []
      list.push(item)
      byCategory.set(item.category, list)
    }
    return [...byCategory.entries()]
  }, [items])

  const basket = useMemo(
    () =>
      items
        .filter((item) => (quantities[item.id] ?? 0) > 0)
        .map((item) => ({ item, quantity: quantities[item.id] })),
    [items, quantities]
  )
  const totalPence = basket.reduce((sum, { item, quantity }) => sum + item.price_pence * quantity, 0)
  const totalCount = basket.reduce((sum, { quantity }) => sum + quantity, 0)

  function adjust(itemId: string, delta: number) {
    setQuantities((prev) => {
      const next = Math.min(20, Math.max(0, (prev[itemId] ?? 0) + delta))
      return { ...prev, [itemId]: next }
    })
  }

  async function joinQueue(withPreOrder: boolean) {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: vendor.slug,
          customerName: customerName.trim(),
          payMethod: 'cash',
          items: withPreOrder ? basket.map(({ item, quantity }) => ({ id: item.id, quantity })) : [],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong')
      rememberOrder(data.orderId, vendor.slug)
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl)
      } else {
        router.push(`/v/${vendor.slug}/order/${data.orderId}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg md:max-w-3xl flex-col bg-paper text-midnight">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/95 px-5 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <Image
            src={stallArtSrc(vendor.slug)}
            alt=""
            width={56}
            height={56}
            unoptimized
            className="h-14 w-14 shrink-0 object-contain"
          />
          <div>
            <h1 className="font-display text-3xl leading-none text-ink">
              {vendor.name.toUpperCase()}
            </h1>
            <p className="mt-1 text-sm font-medium text-midnight/60">
              Browse the menu &amp; join the queue from your phone
            </p>
          </div>
        </div>
        {vendor.open === false && (
          <p className="mt-2 rounded-xl border-2 border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
            Closed right now — check back later.
          </p>
        )}
        {vendor.open !== false && queue && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-card px-3 py-1 text-xs font-bold text-ink">
            <span aria-hidden>🕐</span>
            {queue.waiting === 0
              ? 'No queue right now'
              : `${queue.waiting} in the queue · ~${queue.waiting * 3} min wait`}
            {queue.nowServing !== null && ` · now serving #${queue.nowServing}`}
          </p>
        )}
      </header>

      {view === 'menu' ? (
        <main className="flex-1 px-5 pb-36 pt-4">
          {categories.map(([category, categoryItems]) => (
            <section key={category} className="mb-6">
              <h2 className="mb-1 font-display text-xl uppercase tracking-widest text-ink">
                {category}
              </h2>
              <ul className="md:grid md:grid-cols-2 md:gap-x-10">
                {categoryItems.map((item) => {
                  const quantity = quantities[item.id] ?? 0
                  return (
                    <li
                      key={item.id}
                      className={`flex items-center gap-3 border-b border-line/70 py-3.5 ${
                        item.available ? '' : 'opacity-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold leading-snug">
                          {item.name}
                          {popularIds.includes(item.id) && (
                            <span className="ml-1.5 rounded-full bg-ink/10 px-2 py-0.5 align-middle text-[10px] font-extrabold uppercase tracking-wide text-ink">
                              Popular
                            </span>
                          )}
                        </p>
                        {item.description && (
                          <p className="mt-0.5 text-xs font-medium leading-snug text-midnight/60">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-bold">
                        {formatMoney(item.price_pence, vendor.currency)}
                      </span>
                      {item.available ? (
                        quantity === 0 ? (
                          <button
                            onClick={() => adjust(item.id, 1)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-lg leading-none text-white active:bg-ink-deep"
                            aria-label={`Add ${item.name}`}
                          >
                            +
                          </button>
                        ) : (
                          <div className="flex shrink-0 items-center gap-2 rounded-full border border-line-strong bg-card px-1.5 py-1">
                            <button
                              onClick={() => adjust(item.id, -1)}
                              className="flex h-6 w-6 items-center justify-center rounded-full text-base font-bold text-ink active:bg-ink/10"
                              aria-label={`Remove one ${item.name}`}
                            >
                              −
                            </button>
                            <span className="min-w-4 text-center text-sm font-bold">{quantity}</span>
                            <button
                              onClick={() => adjust(item.id, 1)}
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-base font-bold text-white active:bg-ink-deep"
                              aria-label={`Add one ${item.name}`}
                            >
                              +
                            </button>
                          </div>
                        )
                      ) : (
                        <span className="shrink-0 rounded-full bg-line/60 px-3 py-1.5 text-[11px] font-bold text-midnight/60">
                          Sold out
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </main>
      ) : (
        <main className="flex-1 px-5 pb-36 pt-4">
          <button onClick={() => setView('menu')} className="mb-4 text-sm font-medium text-ink">
            ← Back to menu
          </button>
          <h2 className="mb-3 text-lg font-bold">Your pre-order</h2>
          <p className="mb-3 text-sm text-midnight/60">
            We&apos;ll have it started so it&apos;s ready when you reach the front.
          </p>
          <ul className="space-y-2">
            {basket.map(({ item, quantity }) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card p-4 shadow-sm"
              >
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-midnight/60">
                    {formatMoney(item.price_pence * quantity, vendor.currency)}
                  </p>
                </div>
                <div className="flex items-center gap-3 rounded-full border border-line-strong px-2 py-1">
                  <button
                    onClick={() => adjust(item.id, -1)}
                    className="h-7 w-7 rounded-full text-lg font-semibold text-ink active:bg-ink/10"
                    aria-label={`Remove one ${item.name}`}
                  >
                    −
                  </button>
                  <span className="min-w-4 text-center text-sm font-bold">{quantity}</span>
                  <button
                    onClick={() => adjust(item.id, 1)}
                    className="h-7 w-7 rounded-full text-lg font-semibold text-ink active:bg-ink/10"
                    aria-label={`Add one ${item.name}`}
                  >
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {basket.length === 0 && <p className="text-midnight/60">Your basket is empty.</p>}

          <p className="mt-6 rounded-xl border border-line bg-card px-4 py-3 text-sm font-medium text-midnight/70">
            💷 Pay at the till when you collect — cash or card.
          </p>

          <label className="mt-6 block">
            <span className="mb-1 block text-sm font-medium text-midnight/80">
              Name for the queue <span className="text-midnight/50">(optional)</span>
            </span>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Sam — or leave blank"
              maxLength={60}
              className="w-full rounded-xl border border-line-strong bg-card px-4 py-3 text-base outline-none focus:border-ink focus:ring-2 focus:ring-ink/20"
            />
          </label>

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
        </main>
      )}

      {vendor.open !== false && (
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-lg md:max-w-3xl border-t border-line bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {view === 'menu' ? (
          totalCount > 0 ? (
            <button
              onClick={() => setView('basket')}
              className="flex w-full items-center gap-3 rounded-2xl bg-ink px-5 py-3.5 font-bold text-white active:bg-ink-deep"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M6 8h12l-1 12H7L6 8z" />
                <path d="M9 8V6a3 3 0 0 1 6 0v2" />
              </svg>
              <span className="flex-1 text-left">Review pre-order ({totalCount})</span>
              <span>{formatMoney(totalPence, vendor.currency)}</span>
            </button>
          ) : (
            <button
              onClick={() => joinQueue(false)}
              disabled={submitting}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-ink px-5 py-3.5 font-bold text-white active:bg-ink-deep disabled:bg-ink/20"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3.5 2" />
              </svg>
              {submitting ? 'Joining the queue…' : 'Join the queue'}
            </button>
          )
        ) : (
          <button
            onClick={() => joinQueue(true)}
            disabled={submitting || basket.length === 0}
            className="flex w-full items-center justify-between rounded-2xl bg-ink px-5 py-3.5 font-bold text-white active:bg-ink-deep disabled:bg-ink/20"
          >
            <span>{submitting ? 'Joining the queue…' : 'Join queue & pre-order'}</span>
            <span>{formatMoney(totalPence, vendor.currency)}</span>
          </button>
        )}
      </div>
      )}
    </div>
  )
}
