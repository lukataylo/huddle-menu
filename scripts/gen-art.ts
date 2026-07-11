import { pool } from '../lib/db'
import { generateAndSaveStallArt, isArtConfigured } from '../lib/generate-art'
import type { Vendor } from '../lib/types'

// Backfills AI stall art for every vendor that doesn't have any yet.
async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('[gen-art] ERROR: DATABASE_URL is not set. Aborting.')
    process.exit(1)
  }
  if (!isArtConfigured()) {
    console.error('[gen-art] ERROR: OPENAI_API_KEY is not set. Aborting.')
    process.exit(1)
  }

  const { rows: vendors } = await pool.query<Vendor>(
    `SELECT v.* FROM vendors v
     LEFT JOIN vendor_art a ON a.vendor_id = v.id
     WHERE a.vendor_id IS NULL ORDER BY v.created_at`
  )
  console.log(`[gen-art] ${vendors.length} vendor(s) missing art`)
  for (const vendor of vendors) {
    console.log(`[gen-art] generating for ${vendor.slug}...`)
    await generateAndSaveStallArt(vendor)
  }
  await pool.end()
  console.log('[gen-art] done')
}

main()
