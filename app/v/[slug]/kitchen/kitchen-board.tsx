'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import QRCode from 'qrcode'
import { formatMoney } from '@/lib/format'
import { stallArtSrc } from '@/lib/stall-icon'
import type { MenuItem, Order, OrderStatus } from '@/lib/types'

interface VendorInfo {
  slug: string
  name: string
  emoji: string
  currency: string
}

type Tab = 'orders' | 'menu' | 'qr'
type OrderTab = 'incoming' | 'active' | 'done'

const NEXT_ACTION: Partial<Record<OrderStatus, { label: string; to: OrderStatus }>> = {
  pending: { label: 'Mark paid', to: 'paid' },
  paid: { label: 'Start preparing', to: 'preparing' },
  preparing: { label: 'Mark ready', to: 'ready' },
  ready: { label: 'Picked up', to: 'collected' },
}

const STATUS_BADGE: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: 'Awaiting payment', className: 'bg-ink/10 text-ink' },
  paid: { label: 'New', className: 'bg-ink text-white' },
  preparing: { label: 'Preparing', className: 'bg-amber-500 text-white' },
  ready: { label: 'Ready', className: 'bg-green-600 text-white' },
  collected: { label: 'Picked up', className: 'bg-ink/10 text-midnight/60' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
}

const ORDER_TABS: Record<OrderTab, { label: string; statuses: OrderStatus[] }> = {
  incoming: { label: 'Incoming', statuses: ['paid', 'pending'] },
  active: { label: 'Active', statuses: ['preparing', 'ready'] },
  done: { label: 'Done', statuses: ['collected', 'cancelled'] },
}

export default function KitchenBoard({
  vendor,
  token,
  initialMenuItems,
}: {
  vendor: VendorInfo
  token: string
  initialMenuItems: MenuItem[]
}) {
  const [tab, setTab] = useState<Tab>('orders')
  const [orderTab, setOrderTab] = useState<OrderTab>('incoming')
  const [orders, setOrders] = useState<Order[]>([])
  const [menuItems, setMenuItems] = useState(initialMenuItems)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [menuUrl, setMenuUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  const apiBase = `/api/vendor/${vendor.slug}`

  const refreshOrders = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/orders?token=${encodeURIComponent(token)}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Failed to load orders')
      const data = await res.json()
      setOrders(data.orders)
      setError(null)
    } catch {
      setError('Could not refresh orders — retrying…')
    }
  }, [apiBase, token])

  useEffect(() => {
    const initial = setTimeout(refreshOrders, 0)
    const interval = setInterval(refreshOrders, 5000)
    return () => {
      clearTimeout(initial)
      clearInterval(interval)
    }
  }, [refreshOrders])

  useEffect(() => {
    const url = `${window.location.origin}/v/${vendor.slug}`
    QRCode.toDataURL(url, { width: 480, margin: 2, color: { dark: '#1b32a4', light: '#fbf8ef' } })
      .then((dataUrl) => {
        setMenuUrl(url)
        setQrDataUrl(dataUrl)
      })
      .catch(() => setMenuUrl(url))
  }, [vendor.slug])

  async function moveOrder(orderId: string, to: OrderStatus) {
    const res = await fetch(`${apiBase}/orders/${orderId}?token=${encodeURIComponent(token)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: to }),
    })
    if (res.ok) {
      const { order } = await res.json()
      setOrders((prev) => prev.map((o) => (o.id === order.id ? order : o)))
    } else {
      refreshOrders()
    }
  }

  async function toggleItem(item: MenuItem) {
    const res = await fetch(`${apiBase}/menu/${item.id}?token=${encodeURIComponent(token)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available: !item.available }),
    })
    if (res.ok) {
      const { item: updated } = await res.json()
      setMenuItems((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
    }
  }

  const tabCounts: Record<OrderTab, number> = {
    incoming: orders.filter((o) => ORDER_TABS.incoming.statuses.includes(o.status)).length,
    active: orders.filter((o) => ORDER_TABS.active.statuses.includes(o.status)).length,
    done: orders.filter((o) => ORDER_TABS.done.statuses.includes(o.status)).length,
  }
  const visibleOrders = orders.filter((o) => ORDER_TABS[orderTab].statuses.includes(o.status))

  return (
    <div className="min-h-dvh bg-paper text-midnight">
      <header className="sticky top-0 z-10 border-b-2 border-line bg-card px-5 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <h1 className="flex items-center gap-2 font-display text-2xl leading-none text-ink">
            <Image
              src={stallArtSrc(vendor.slug)}
              alt=""
              width={40}
              height={40}
              unoptimized
              className="h-10 w-10 shrink-0 object-contain"
            />
            {vendor.name.toUpperCase()}
          </h1>
          <nav className="flex gap-1 rounded-xl border-2 border-line bg-paper p-1 text-sm font-bold">
            {(['orders', 'menu', 'qr'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1.5 capitalize ${
                  tab === t ? 'bg-ink text-white' : 'text-ink'
                }`}
              >
                {t === 'qr' ? 'QR code' : t}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-6">
        {error && (
          <p className="mb-4 rounded-xl border-2 border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        {tab === 'orders' && (
          <>
            <div className="mb-5 flex gap-2">
              {(Object.keys(ORDER_TABS) as OrderTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setOrderTab(t)}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold ${
                    orderTab === t ? 'bg-ink text-white' : 'border-2 border-line bg-card text-ink'
                  }`}
                >
                  {ORDER_TABS[t].label}
                  <span
                    className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs ${
                      orderTab === t ? 'bg-white text-ink' : 'bg-ink text-white'
                    }`}
                  >
                    {tabCounts[t]}
                  </span>
                </button>
              ))}
            </div>

            {visibleOrders.length === 0 ? (
              <p className="mt-10 text-center font-medium text-midnight/50">
                No {ORDER_TABS[orderTab].label.toLowerCase()} orders right now.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleOrders.map((order) => {
                  const action = NEXT_ACTION[order.status]
                  const badge = STATUS_BADGE[order.status]
                  return (
                    <div key={order.id} className="rounded-2xl border-2 border-line bg-card p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-extrabold ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                          <p className="mt-1.5 text-xl font-extrabold text-ink">
                            Order #{order.order_number}
                          </p>
                        </div>
                        <p className="text-lg font-extrabold">
                          {formatMoney(order.total_pence, vendor.currency)}
                        </p>
                      </div>
                      <ul className="mt-2 space-y-0.5 text-sm font-medium text-midnight/80">
                        {order.items.map((item) => (
                          <li key={item.id}>
                            {item.quantity} × {item.name}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-sm font-bold text-midnight/60">
                        👤 {order.customer_name}
                      </p>
                      <div className="mt-3 flex gap-2">
                        {action && (
                          <button
                            onClick={() => moveOrder(order.id, action.to)}
                            className="flex-1 rounded-xl bg-ink px-3 py-2.5 text-sm font-extrabold text-white active:bg-ink-deep"
                          >
                            {action.label}
                          </button>
                        )}
                        {['pending', 'paid'].includes(order.status) && (
                          <button
                            onClick={() => moveOrder(order.id, 'cancelled')}
                            className="rounded-xl border-2 border-line px-3 py-2.5 text-sm font-bold text-midnight/60 active:bg-paper"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {tab === 'menu' && (
          <div className="mx-auto max-w-xl space-y-2">
            <p className="mb-4 text-sm font-medium text-midnight/60">
              Toggle items off when you sell out — they show as unavailable on the customer menu
              immediately.
            </p>
            {menuItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-2xl border-2 border-line bg-card p-4"
              >
                <div>
                  <p className={`font-extrabold ${item.available ? '' : 'text-midnight/40 line-through'}`}>
                    {item.name}
                  </p>
                  <p className="text-sm font-medium text-midnight/60">
                    {item.category} · {formatMoney(item.price_pence, vendor.currency)}
                  </p>
                </div>
                <button
                  onClick={() => toggleItem(item)}
                  role="switch"
                  aria-checked={item.available}
                  className={`relative h-7 w-12 rounded-full transition-colors ${
                    item.available ? 'bg-green-500' : 'bg-ink/20'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                      item.available ? 'left-[calc(100%-1.625rem)]' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'qr' && (
          <div className="mx-auto max-w-md rounded-3xl border-2 border-ink bg-card p-8 text-center">
            <h2 className="font-display text-3xl text-ink">SCAN TO ORDER</h2>
            <p className="mt-1 text-sm font-medium text-midnight/60">
              Print this and stick it on your stall. It opens your menu at{' '}
              <span className="font-mono text-xs">{menuUrl}</span>
            </p>
            {qrDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt={`QR code linking to the ${vendor.name} menu`}
                className="mx-auto mt-4 w-64 rounded-xl"
              />
            )}
            <button
              onClick={() => window.print()}
              className="mt-4 rounded-xl bg-ink px-5 py-2.5 text-sm font-extrabold text-white"
            >
              Print
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
