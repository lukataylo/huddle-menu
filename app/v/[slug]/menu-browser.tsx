'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatMoney } from '@/lib/format'
import { rememberOrder } from '@/lib/loyalty'
import type { MenuItem } from '@/lib/types'

interface VendorInfo {
  slug: string
  name: string
  emoji: string
  currency: string
}

export default function MenuBrowser({ vendor, items }: { vendor: VendorInfo; items: MenuItem[] }) {
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

  async function checkout() {
    if (!customerName.trim() || basket.length === 0 || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: vendor.slug,
          customerName: customerName.trim(),
          items: basket.map(({ item, quantity }) => ({ id: item.id, quantity })),
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
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-stone-50 text-stone-900">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/95 px-5 py-4 backdrop-blur">
        <h1 className="text-xl font-bold tracking-tight">
          <span className="mr-2">{vendor.emoji}</span>
          {vendor.name}
        </h1>
        <p className="text-sm text-stone-500">Order &amp; pay from your phone</p>
      </header>

      {view === 'menu' ? (
        <main className="flex-1 px-5 pb-36 pt-4">
          {categories.map(([category, categoryItems]) => (
            <section key={category} className="mb-6">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-amber-700">
                {category}
              </h2>
              <ul className="space-y-2">
                {categoryItems.map((item) => {
                  const quantity = quantities[item.id] ?? 0
                  return (
                    <li
                      key={item.id}
                      className={`rounded-xl border bg-white p-4 shadow-sm ${
                        item.available ? 'border-stone-200' : 'border-stone-100 opacity-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium leading-snug">{item.name}</p>
                          {item.description && (
                            <p className="mt-0.5 text-sm leading-snug text-stone-500">{item.description}</p>
                          )}
                          <p className="mt-1 text-sm font-semibold text-stone-700">
                            {formatMoney(item.price_pence, vendor.currency)}
                          </p>
                        </div>
                        {item.available ? (
                          quantity === 0 ? (
                            <button
                              onClick={() => adjust(item.id, 1)}
                              className="shrink-0 rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white active:bg-amber-700"
                            >
                              Add
                            </button>
                          ) : (
                            <div className="flex shrink-0 items-center gap-3 rounded-full border border-stone-300 bg-white px-2 py-1">
                              <button
                                onClick={() => adjust(item.id, -1)}
                                className="h-7 w-7 rounded-full text-lg font-semibold text-amber-700 active:bg-amber-50"
                                aria-label={`Remove one ${item.name}`}
                              >
                                −
                              </button>
                              <span className="min-w-4 text-center text-sm font-bold">{quantity}</span>
                              <button
                                onClick={() => adjust(item.id, 1)}
                                className="h-7 w-7 rounded-full text-lg font-semibold text-amber-700 active:bg-amber-50"
                                aria-label={`Add one ${item.name}`}
                              >
                                +
                              </button>
                            </div>
                          )
                        ) : (
                          <span className="shrink-0 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-500">
                            Sold out
                          </span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </main>
      ) : (
        <main className="flex-1 px-5 pb-36 pt-4">
          <button onClick={() => setView('menu')} className="mb-4 text-sm font-medium text-amber-700">
            ← Back to menu
          </button>
          <h2 className="mb-3 text-lg font-bold">Your order</h2>
          <ul className="space-y-2">
            {basket.map(({ item, quantity }) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-stone-500">
                    {formatMoney(item.price_pence * quantity, vendor.currency)}
                  </p>
                </div>
                <div className="flex items-center gap-3 rounded-full border border-stone-300 px-2 py-1">
                  <button
                    onClick={() => adjust(item.id, -1)}
                    className="h-7 w-7 rounded-full text-lg font-semibold text-amber-700 active:bg-amber-50"
                    aria-label={`Remove one ${item.name}`}
                  >
                    −
                  </button>
                  <span className="min-w-4 text-center text-sm font-bold">{quantity}</span>
                  <button
                    onClick={() => adjust(item.id, 1)}
                    className="h-7 w-7 rounded-full text-lg font-semibold text-amber-700 active:bg-amber-50"
                    aria-label={`Add one ${item.name}`}
                  >
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {basket.length === 0 && <p className="text-stone-500">Your basket is empty.</p>}

          <label className="mt-6 block">
            <span className="mb-1 block text-sm font-medium text-stone-700">Name for the order</span>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Sam"
              maxLength={60}
              className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-200"
            />
          </label>

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
        </main>
      )}

      {totalCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-lg border-t border-stone-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {view === 'menu' ? (
            <button
              onClick={() => setView('basket')}
              className="flex w-full items-center justify-between rounded-xl bg-amber-600 px-5 py-3.5 font-semibold text-white active:bg-amber-700"
            >
              <span>
                View basket · {totalCount} item{totalCount === 1 ? '' : 's'}
              </span>
              <span>{formatMoney(totalPence, vendor.currency)}</span>
            </button>
          ) : (
            <button
              onClick={checkout}
              disabled={submitting || !customerName.trim() || basket.length === 0}
              className="flex w-full items-center justify-between rounded-xl bg-amber-600 px-5 py-3.5 font-semibold text-white active:bg-amber-700 disabled:bg-stone-300"
            >
              <span>{submitting ? 'Starting payment…' : 'Pay now'}</span>
              <span>{formatMoney(totalPence, vendor.currency)}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
