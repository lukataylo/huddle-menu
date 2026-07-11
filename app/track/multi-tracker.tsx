'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { formatMoney } from '@/lib/format'
import { stallIconPath } from '@/lib/stall-icon'
import { rememberOrder } from '@/lib/loyalty'
import { useNotificationPermission, useReadyBuzzer } from '@/lib/use-ready-buzzer'
import BottomNav from '../bottom-nav'
import type { OrderLineItem, OrderStatus } from '@/lib/types'

interface TrackedOrder {
  id: string
  order_number: number
  customer_name: string
  items: OrderLineItem[]
  total_pence: number
  status: OrderStatus
  vendor: { slug: string; name: string; emoji: string; currency: string }
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Awaiting payment…',
  paid: 'In the queue',
  preparing: 'Being prepared 🔥',
  ready: 'Ready — collect now! 🎉',
  collected: 'Collected 😋',
  cancelled: 'Cancelled',
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: 'bg-ink/10 text-midnight/70',
  paid: 'bg-blue-100 text-blue-800',
  preparing: 'bg-ink/10 text-ink',
  ready: 'bg-green-500 text-white',
  collected: 'bg-ink/10 text-midnight/60',
  cancelled: 'bg-red-100 text-red-700',
}

const DONE: OrderStatus[] = ['collected', 'cancelled']

export default function MultiTracker({ orderIds }: { orderIds: string[] }) {
  const [orders, setOrders] = useState<TrackedOrder[]>([])
  const { permission, request } = useNotificationPermission()

  const refresh = useCallback(async () => {
    const results = await Promise.all(
      orderIds.map(async (id) => {
        try {
          const res = await fetch(`/api/orders/${id}`, { cache: 'no-store' })
          return res.ok ? ((await res.json()) as TrackedOrder) : null
        } catch {
          return null
        }
      })
    )
    setOrders(results.filter((order): order is TrackedOrder => order !== null))
  }, [orderIds])

  useEffect(() => {
    const initial = setTimeout(refresh, 0)
    const interval = setInterval(refresh, 4000)
    return () => {
      clearTimeout(initial)
      clearInterval(interval)
    }
  }, [refresh])

  useEffect(() => {
    for (const order of orders) rememberOrder(order.id, order.vendor.slug)
  }, [orders])

  const readyOrders = orders.filter((order) => order.status === 'ready')
  useReadyBuzzer(
    readyOrders.length > 0,
    readyOrders.map((order) => `${order.vendor.name} order #${order.order_number}`).join(', ')
  )

  const allDone = orders.length > 0 && orders.every((order) => DONE.includes(order.status))
  const anyActive = orders.some((order) => !DONE.includes(order.status))

  return (
    <div
      className={`mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pb-28 pt-8 text-midnight transition-colors ${
        readyOrders.length > 0 ? 'animate-pulse bg-green-50' : 'bg-paper'
      }`}
    >
      <h1 className="font-display text-4xl leading-none text-ink">YOUR ORDERS</h1>
      <p className="mt-1 text-midnight/60">
        {readyOrders.length > 0
          ? 'Food is ready — head to the counter!'
          : allDone
            ? 'All done. Enjoy!'
            : 'Keep this page open — it buzzes when your food is ready.'}
      </p>

      {anyActive && permission === 'default' && (
        <button
          onClick={request}
          className="mt-4 rounded-xl border border-ink/30 bg-paper px-4 py-3 text-sm font-medium text-ink"
        >
          🔔 Notify me when it&apos;s ready
        </button>
      )}

      <div className="mt-5 space-y-3">
        {orders.length === 0 && <p className="text-midnight/40">Loading your orders…</p>}
        {orders.map((order) => (
          <div
            key={order.id}
            className={`rounded-2xl border bg-card p-5 shadow-sm ${
              order.status === 'ready' ? 'border-green-400 ring-2 ring-green-300' : 'border-ink/20'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Image
                  src={stallIconPath(order.vendor.emoji, order.vendor.name)}
                  alt=""
                  width={56}
                  height={56}
                  className="h-14 w-14 shrink-0"
                />
                <div>
                  <p className="text-sm font-bold text-midnight/60">{order.vendor.name}</p>
                  <p className="font-display text-5xl leading-none text-ink">
                    #{order.order_number}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${STATUS_STYLES[order.status]}`}
              >
                {STATUS_LABEL[order.status]}
              </span>
            </div>
            <ul className="mt-3 space-y-0.5 text-sm text-midnight/70">
              {order.items.map((item) => (
                <li key={item.id}>
                  {item.quantity} × {item.name}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm font-semibold">
              {formatMoney(order.total_pence, order.vendor.currency)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-center gap-6 text-sm font-medium text-ink">
        <Link href="/market">← Back to market</Link>
        <Link href="/stamps">My stamps</Link>
      </div>
      <BottomNav />
    </div>
  )
}
