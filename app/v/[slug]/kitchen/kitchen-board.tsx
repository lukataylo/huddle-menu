'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
type OrderTab = 'waiting' | 'called' | 'done'

interface ItemDraft {
  name: string
  description: string
  price: string
  category: string
}

const NEXT_ACTION: Partial<Record<OrderStatus, { label: string; to: OrderStatus }>> = {
  pending: { label: 'Confirm spot', to: 'paid' },
  paid: { label: 'Call up', to: 'ready' },
  preparing: { label: 'Call up', to: 'ready' },
  ready: { label: 'Served', to: 'collected' },
}

const STATUS_BADGE: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: 'Awaiting payment', className: 'bg-ink/10 text-ink' },
  paid: { label: 'Waiting', className: 'bg-ink text-white' },
  preparing: { label: 'Waiting', className: 'bg-ink text-white' },
  ready: { label: 'Called', className: 'bg-green-600 text-white' },
  collected: { label: 'Served', className: 'bg-ink/10 text-midnight/60' },
  cancelled: { label: 'No-show', className: 'bg-red-100 text-red-700' },
}

const ORDER_TABS: Record<OrderTab, { label: string; statuses: OrderStatus[] }> = {
  waiting: { label: 'Queue', statuses: ['paid', 'preparing', 'pending'] },
  called: { label: 'Called', statuses: ['ready'] },
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
  const [orderTab, setOrderTab] = useState<OrderTab>('waiting')
  const [orders, setOrders] = useState<Order[]>([])
  const [menuItems, setMenuItems] = useState(initialMenuItems)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [menuUrl, setMenuUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [soundOn, setSoundOn] = useState(true)
  // Menu editing: which item is being edited ('new' = adding), and its draft.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ItemDraft>({ name: '', description: '', price: '', category: 'Menu' })
  const [savingItem, setSavingItem] = useState(false)
  const knownIds = useRef<Set<string> | null>(null)
  const audioCtx = useRef<AudioContext | null>(null)
  const soundOnRef = useRef(true)
  useEffect(() => {
    soundOnRef.current = soundOn
  }, [soundOn])

  const apiBase = `/api/vendor/${vendor.slug}`

  // Two-tone counter-bell ding, synthesized so there's no asset to load.
  const ding = useCallback(() => {
    if (!soundOnRef.current) return
    try {
      audioCtx.current ??= new AudioContext()
      const ctx = audioCtx.current
      if (ctx.state === 'suspended') void ctx.resume()
      for (const [freq, at] of [
        [880, 0],
        [1318.5, 0.12],
      ] as const) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.001, ctx.currentTime + at)
        gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + at + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + 0.6)
        osc.connect(gain).connect(ctx.destination)
        osc.start(ctx.currentTime + at)
        osc.stop(ctx.currentTime + at + 0.65)
      }
    } catch {
      // audio unavailable (no user gesture yet) — stay silent
    }
  }, [])

  const refreshOrders = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/orders?token=${encodeURIComponent(token)}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Failed to load orders')
      const data = await res.json()
      const incoming = data.orders as Order[]
      // Ding when a new ticket joins the queue (not on the first load).
      if (knownIds.current) {
        const fresh = incoming.some(
          (o) =>
            !knownIds.current!.has(o.id) &&
            ['pending', 'paid', 'preparing'].includes(o.status)
        )
        if (fresh) ding()
      }
      knownIds.current = new Set(incoming.map((o) => o.id))
      setOrders(incoming)
      setError(null)
    } catch {
      setError('Could not refresh orders — retrying…')
    }
  }, [apiBase, token, ding])

  useEffect(() => {
    const initial = setTimeout(refreshOrders, 0)
    const interval = setInterval(refreshOrders, 5000)
    return () => {
      clearTimeout(initial)
      clearInterval(interval)
    }
  }, [refreshOrders])

  // Remember the admin token on this device so scanning a customer's pickup
  // QR (which opens /v/[slug]/serve/[orderId]) can complete the order.
  useEffect(() => {
    try {
      localStorage.setItem(`huddle_admin_${vendor.slug}`, token)
    } catch {
      // private browsing — the serve page will ask to use the console instead
    }
  }, [vendor.slug, token])

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

  function startEditing(item: MenuItem) {
    setDraft({
      name: item.name,
      description: item.description,
      price: (item.price_pence / 100).toFixed(2),
      category: item.category,
    })
    setEditingId(item.id)
  }

  function startAdding() {
    setDraft({ name: '', description: '', price: '', category: menuItems.at(-1)?.category ?? 'Menu' })
    setEditingId('new')
  }

  async function saveItem(target: string) {
    const pounds = parseFloat(draft.price)
    const pricePence = Number.isFinite(pounds) ? Math.round(pounds * 100) : NaN
    if (!draft.name.trim() || !(pricePence >= 0)) {
      setError('Item needs a name and a price')
      return
    }
    setSavingItem(true)
    setError(null)
    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      price_pence: pricePence,
      category: draft.category.trim() || 'Menu',
    }
    const res =
      target === 'new'
        ? await fetch(`${apiBase}/menu?token=${encodeURIComponent(token)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch(`${apiBase}/menu/${target}?token=${encodeURIComponent(token)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
    setSavingItem(false)
    if (res.ok) {
      const { item } = await res.json()
      setMenuItems((prev) =>
        target === 'new' ? [...prev, item] : prev.map((m) => (m.id === item.id ? item : m))
      )
      setEditingId(null)
    } else {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? 'Could not save the item')
    }
  }

  async function removeItem(itemId: string) {
    const res = await fetch(`${apiBase}/menu/${itemId}?token=${encodeURIComponent(token)}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      setMenuItems((prev) => prev.filter((m) => m.id !== itemId))
      setEditingId(null)
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
    waiting: orders.filter((o) => ORDER_TABS.waiting.statuses.includes(o.status)).length,
    called: orders.filter((o) => ORDER_TABS.called.statuses.includes(o.status)).length,
    done: orders.filter((o) => ORDER_TABS.done.statuses.includes(o.status)).length,
  }
  const visibleOrders = orders.filter((o) => ORDER_TABS[orderTab].statuses.includes(o.status))
  const nextWaiting = orders.find((o) => o.status === 'paid' || o.status === 'preparing')
  const nowServing = orders
    .filter((o) => o.status === 'ready' || o.status === 'collected')
    .reduce<number | null>((max, o) => (max === null || o.order_number > max ? o.order_number : max), null)

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
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSoundOn((prev) => {
                  // Toggling counts as the user gesture that unlocks audio.
                  if (!prev) setTimeout(ding, 50)
                  return !prev
                })
              }}
              aria-label={soundOn ? 'Mute new-ticket sound' : 'Unmute new-ticket sound'}
              title={soundOn ? 'New-ticket sound on' : 'New-ticket sound off'}
              className={`flex h-9 w-9 items-center justify-center rounded-xl border-2 text-base ${
                soundOn ? 'border-ink bg-paper' : 'border-line bg-paper opacity-50'
              }`}
            >
              {soundOn ? '🔔' : '🔕'}
            </button>
            <nav className="flex gap-1 rounded-xl border-2 border-line bg-paper p-1 text-sm font-bold">
              {(['orders', 'menu', 'qr'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-lg px-3 py-1.5 capitalize ${
                    tab === t ? 'bg-ink text-white' : 'text-ink'
                  }`}
                >
                  {t === 'qr' ? 'QR code' : t === 'orders' ? 'Queue' : t}
                </button>
              ))}
            </nav>
          </div>
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
            <div className="mb-5 flex items-center gap-4 rounded-2xl border-2 border-ink bg-card p-4">
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-widest text-midnight/50">
                  Now serving
                </p>
                <p className="font-display text-5xl leading-none text-ink">
                  {nowServing ? `#${nowServing}` : '—'}
                </p>
              </div>
              <button
                onClick={() => nextWaiting && moveOrder(nextWaiting.id, 'ready')}
                disabled={!nextWaiting}
                className="rounded-2xl bg-ink px-6 py-4 text-lg font-extrabold text-white active:bg-ink-deep disabled:bg-ink/20"
              >
                📣 Call next{nextWaiting ? ` (#${nextWaiting.order_number})` : ''}
              </button>
            </div>

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
                Nobody in “{ORDER_TABS[orderTab].label}” right now.
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
                            Ticket #{order.order_number}
                          </p>
                        </div>
                        {order.total_pence > 0 && (
                          <p className="text-lg font-extrabold">
                            {formatMoney(order.total_pence, vendor.currency)}
                          </p>
                        )}
                      </div>
                      {order.items.length > 0 ? (
                        <ul className="mt-2 space-y-0.5 text-sm font-medium text-midnight/80">
                          {order.items.map((item) => (
                            <li key={item.id}>
                              {item.quantity} × {item.name}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm font-medium text-midnight/50">
                          Walk-up — no pre-order
                        </p>
                      )}
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
                        {['pending', 'paid', 'preparing', 'ready'].includes(order.status) && (
                          <button
                            onClick={() => moveOrder(order.id, 'cancelled')}
                            className="rounded-xl border-2 border-line px-3 py-2.5 text-sm font-bold text-midnight/60 active:bg-paper"
                          >
                            No-show
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
              Toggle items off when you sell out, tap Edit to fix names and prices — customers see
              changes immediately.
            </p>
            {menuItems.map((item) =>
              editingId === item.id ? (
                <ItemEditor
                  key={item.id}
                  draft={draft}
                  setDraft={setDraft}
                  saving={savingItem}
                  onSave={() => saveItem(item.id)}
                  onCancel={() => setEditingId(null)}
                  onDelete={() => removeItem(item.id)}
                />
              ) : (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border-2 border-line bg-card p-4"
                >
                  <div className="min-w-0">
                    <p className={`font-extrabold ${item.available ? '' : 'text-midnight/40 line-through'}`}>
                      {item.name}
                    </p>
                    <p className="text-sm font-medium text-midnight/60">
                      {item.category} · {formatMoney(item.price_pence, vendor.currency)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      onClick={() => startEditing(item)}
                      className="rounded-lg border-2 border-line px-3 py-1.5 text-sm font-bold text-ink"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleItem(item)}
                      role="switch"
                      aria-checked={item.available}
                      aria-label={`${item.name} available`}
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
                </div>
              )
            )}
            {editingId === 'new' ? (
              <ItemEditor
                draft={draft}
                setDraft={setDraft}
                saving={savingItem}
                onSave={() => saveItem('new')}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <button
                onClick={startAdding}
                className="w-full rounded-2xl border-2 border-dashed border-line-strong bg-card p-4 text-sm font-bold text-ink"
              >
                + Add item
              </button>
            )}
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

function ItemEditor({
  draft,
  setDraft,
  saving,
  onSave,
  onCancel,
  onDelete,
}: {
  draft: ItemDraft
  setDraft: (draft: ItemDraft) => void
  saving: boolean
  onSave: () => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const input =
    'w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm outline-none focus:border-ink'
  return (
    <div className="space-y-2 rounded-2xl border-2 border-ink bg-card p-4">
      <div className="flex gap-2">
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="Item name"
          maxLength={120}
          className={`${input} flex-1 font-bold`}
        />
        <div className="flex w-24 items-center rounded-lg border border-line-strong bg-paper px-2">
          <span className="text-sm text-midnight/40">£</span>
          <input
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            placeholder="0.00"
            inputMode="decimal"
            aria-label="Price"
            className="w-full bg-transparent px-1 py-2 text-sm outline-none"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <input
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          placeholder="Description (optional)"
          maxLength={300}
          className={`${input} flex-1`}
        />
        <input
          value={draft.category}
          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          placeholder="Category"
          maxLength={60}
          aria-label="Category"
          className={`${input} w-28`}
        />
      </div>
      <div className="flex items-center justify-between pt-1">
        {onDelete ? (
          <button onClick={onDelete} className="text-sm font-bold text-red-600">
            Delete
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button onClick={onCancel} className="rounded-lg px-3 py-1.5 text-sm font-bold text-midnight/60">
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-ink px-4 py-1.5 text-sm font-bold text-white disabled:bg-ink/30"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
