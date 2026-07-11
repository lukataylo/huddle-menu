import crypto from 'crypto'
import { pool } from '../lib/db'

const VENDOR = {
  name: 'Borough Bao',
  slug: 'borough-bao',
  emoji: '🥟',
  currency: 'GBP',
}

const MENU_ITEMS: Array<{
  name: string
  description: string
  price_pence: number
  category: string
}> = [
  // Bao
  {
    name: 'Classic Pork Belly Bao',
    description: 'Braised pork belly, hoisin, crushed peanuts, coriander',
    price_pence: 550,
    category: 'Bao',
  },
  {
    name: 'Crispy Chicken Bao',
    description: 'Buttermilk fried chicken, sriracha mayo, pickled slaw',
    price_pence: 550,
    category: 'Bao',
  },
  {
    name: 'Shiitake Mushroom Bao (v)',
    description: 'Sticky glazed shiitake, crispy shallots',
    price_pence: 500,
    category: 'Bao',
  },
  // Sides
  {
    name: 'Prawn Crackers',
    description: 'With sweet chilli dip',
    price_pence: 250,
    category: 'Sides',
  },
  {
    name: 'Asian Slaw',
    description: 'Sesame, lime, peanut',
    price_pence: 350,
    category: 'Sides',
  },
  {
    name: 'Salt & Pepper Fries',
    description: 'Five-spice seasoning',
    price_pence: 400,
    category: 'Sides',
  },
  // Drinks
  {
    name: 'Ice Tea Lemon',
    description: '',
    price_pence: 250,
    category: 'Drinks',
  },
  {
    name: 'Sparkling Water',
    description: '',
    price_pence: 200,
    category: 'Drinks',
  },
]

async function seed() {
  if (!process.env.DATABASE_URL) {
    console.error('[seed] ERROR: DATABASE_URL is not set. Aborting.')
    process.exit(1)
  }

  const client = await pool.connect()
  try {
    console.log('[seed] Connected to database. Seeding demo vendor...')

    const newAdminToken = crypto.randomBytes(24).toString('base64url')

    const marketResult = await client.query(
      `INSERT INTO markets (slug, name) VALUES ('borough-market', 'Borough Market')
       ON CONFLICT (slug) DO UPDATE SET slug = markets.slug
       RETURNING id, slug`
    )
    const market = marketResult.rows[0]
    console.log(`[seed] Market "${market.slug}" ready`)

    const upsertResult = await client.query(
      `INSERT INTO vendors (slug, admin_token, name, emoji, currency, market_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (slug) DO UPDATE SET market_id = EXCLUDED.market_id
       RETURNING id, slug, admin_token`,
      [VENDOR.slug, newAdminToken, VENDOR.name, VENDOR.emoji, VENDOR.currency, market.id]
    )

    let vendor: { id: string; slug: string; admin_token: string }
    if (upsertResult.rows.length > 0) {
      vendor = upsertResult.rows[0]
      console.log(`[seed] Created new vendor "${vendor.slug}"`)
    } else {
      const existing = await client.query(
        `SELECT id, slug, admin_token FROM vendors WHERE slug = $1`,
        [VENDOR.slug]
      )
      vendor = existing.rows[0]
      console.log(`[seed] Vendor "${vendor.slug}" already exists, keeping existing admin_token`)
    }

    const existingItems = await client.query(
      `SELECT id FROM menu_items WHERE vendor_id = $1 LIMIT 1`,
      [vendor.id]
    )

    if (existingItems.rows.length > 0) {
      console.log('[seed] Menu items already exist for this vendor, skipping item insertion.')
    } else {
      let sort = 0
      for (const item of MENU_ITEMS) {
        await client.query(
          `INSERT INTO menu_items (vendor_id, name, description, price_pence, category, available, sort)
           VALUES ($1, $2, $3, $4, $5, true, $6)`,
          [vendor.id, item.name, item.description, item.price_pence, item.category, sort]
        )
        sort += 1
      }
      console.log(`[seed] Inserted ${MENU_ITEMS.length} menu items.`)
    }

    console.log('[seed] Done.')
    console.log(`[seed] Vendor slug:   ${vendor.slug}`)
    console.log(`[seed] Admin token:   ${vendor.admin_token}`)
    console.log(`[seed] Kitchen URL:   /v/${vendor.slug}/kitchen?token=${vendor.admin_token}`)
  } catch (err) {
    console.error('[seed] FAILED:', err)
    client.release()
    await pool.end()
    process.exit(1)
  }
  client.release()
  await pool.end()
  process.exit(0)
}

seed()
