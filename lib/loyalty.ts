// Device-local order history — the loyalty system is account-free, so
// "the customer" is this browser's localStorage.

export interface StoredOrder {
  id: string
  slug: string
  at: string // ISO timestamp
}

const KEY = 'huddle_orders'

export function getStoredOrders(): StoredOrder[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function rememberOrder(id: string, slug: string): void {
  if (typeof window === 'undefined') return
  const orders = getStoredOrders()
  if (orders.some((order) => order.id === id)) return
  orders.push({ id, slug, at: new Date().toISOString() })
  try {
    window.localStorage.setItem(KEY, JSON.stringify(orders.slice(-200)))
  } catch {
    // storage full or blocked — loyalty is best-effort
  }
}
