export interface Vendor {
  id: string
  slug: string
  admin_token: string
  name: string
  emoji: string
  currency: string
  next_order_number: number
  created_at: string
}

export type OrderStatus = 'pending' | 'paid' | 'preparing' | 'ready' | 'collected' | 'cancelled'

export interface MenuItem {
  id: string
  vendor_id: string
  name: string
  description: string
  price_pence: number
  category: string
  available: boolean
  sort: number
}

export interface OrderLineItem {
  id: string
  name: string
  price_pence: number
  quantity: number
}

export interface Order {
  id: string
  vendor_id: string
  order_number: number
  customer_name: string
  items: OrderLineItem[]
  total_pence: number
  status: OrderStatus
  mollie_payment_id: string | null
  created_at: string
  updated_at: string
}
