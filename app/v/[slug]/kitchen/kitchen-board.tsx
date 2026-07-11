'use client'

import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { formatMoney } from '@/lib/format'
import type { MenuItem, Order, OrderStatus } from '@/lib/types'

interface VendorInfo {
  slug: string
  name: string
  emoji: string
  currency: string
}

type Tab = 'orders' | 'menu' | 'qr'

const NEXT_ACTION: Partial<Record<OrderStatus, { label: string; to: OrderStatus }>> = {
  pending: { label: 'Mark paid', to: 'paid' },
  paid: { label: 'Start preparing', to: 'preparing' },
  preparing: { label: 'Mark ready', to: 'ready' },
  ready: { label: 'Collected', to: 'collected' },
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: 'bg-stone-100 text-stone-600',
  paid: 'bg-blue-100 text-blue-800',
  preparing: 'bg-amber-100 text-amber-800',
  ready: 'bg-green-100 text-green-800',
  collected: 'bg-stone-100 text-stone-500',
  cancelled: 'bg-red-100 text-red-700',
}

const BOARD_GROUPS: Array<{ title: string; statuses: OrderStatus[] }> = [
  { title: 'New', statuses: ['paid'] },
  { title: 'Preparing', statuses: ['preparing'] },
  { title: 'Ready', statuses: ['ready'] },
  { title: 'Awaiting payment', statuses: ['pending'] },
  { title: 'Done (last 2h)', statuses: ['collected', 'cancelled'] },
]

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
    QRCode.toDataURL(url, { width: 480, margin: 2 })
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

  return (
    <div className="min-h-dvh bg-stone-100 text-stone-900">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white px-5 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <h1 className="text-lg font-bold">
            {vendor.emoji} {vendor.name} <span className="font-normal text-stone-400">· Kitchen</span>
          </h1>
          <nav className="flex gap-1 rounded-lg bg-stone-100 p-1 text-sm font-medium">
            {(['orders', 'menu', 'qr'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1.5 capitalize ${
                  tab === t ? 'bg-white shadow-sm' : 'text-stone-500'
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
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {tab === 'orders' && (
          <div className="space-y-8">
            {BOARD_GROUPS.map(({ title, statuses }) => {
              const group = orders.filter((o) => statuses.includes(o.status))
              if (group.length === 0 && (title === 'Awaiting payment' || title === 'Done (last 2h)'))
                return null
              return (
                <section key={title}>
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-stone-500">
                    {title} {group.length > 0 && <span className="text-stone-400">({group.length})</span>}
                  </h2>
                  {group.length === 0 ? (
                    <p className="text-sm text-stone-400">No orders here right now.</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {group.map((order) => {
                        const action = NEXT_ACTION[order.status]
                        return (
                          <div
                            key={order.id}
                            className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-2xl font-black text-stone-800">#{order.order_number}</p>
                                <p className="text-sm font-medium text-stone-600">{order.customer_name}</p>
                              </div>
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[order.status]}`}
                              >
                                {order.status}
                              </span>
                            </div>
                            <ul className="mt-3 space-y-0.5 text-sm text-stone-700">
                              {order.items.map((item) => (
                                <li key={item.id}>
                                  <span className="font-semibold">{item.quantity}×</span> {item.name}
                                </li>
                              ))}
                            </ul>
                            <p className="mt-2 text-sm font-semibold">
                              {formatMoney(order.total_pence, vendor.currency)}
                            </p>
                            <div className="mt-3 flex gap-2">
                              {action && (
                                <button
                                  onClick={() => moveOrder(order.id, action.to)}
                                  className="flex-1 rounded-lg bg-stone-900 px-3 py-2 text-sm font-semibold text-white active:bg-stone-700"
                                >
                                  {action.label}
                                </button>
                              )}
                              {['pending', 'paid'].includes(order.status) && (
                                <button
                                  onClick={() => moveOrder(order.id, 'cancelled')}
                                  className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 active:bg-stone-100"
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
                </section>
              )
            })}
          </div>
        )}

        {tab === 'menu' && (
          <div className="mx-auto max-w-xl space-y-2">
            <p className="mb-4 text-sm text-stone-500">
              Toggle items off when you sell out — they show as unavailable on the customer menu
              immediately.
            </p>
            {menuItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-4"
              >
                <div>
                  <p className={`font-medium ${item.available ? '' : 'text-stone-400 line-through'}`}>
                    {item.name}
                  </p>
                  <p className="text-sm text-stone-500">
                    {item.category} · {formatMoney(item.price_pence, vendor.currency)}
                  </p>
                </div>
                <button
                  onClick={() => toggleItem(item)}
                  role="switch"
                  aria-checked={item.available}
                  className={`relative h-7 w-12 rounded-full transition-colors ${
                    item.available ? 'bg-green-500' : 'bg-stone-300'
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
          <div className="mx-auto max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center">
            <h2 className="text-lg font-bold">Scan to order</h2>
            <p className="mt-1 text-sm text-stone-500">
              Print this and stick it on your stall. It opens your menu at{' '}
              <span className="font-mono text-xs">{menuUrl}</span>
            </p>
            {qrDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt={`QR code linking to the ${vendor.name} menu`} className="mx-auto mt-4 w-64" />
            )}
            <button
              onClick={() => window.print()}
              className="mt-4 rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Print
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
