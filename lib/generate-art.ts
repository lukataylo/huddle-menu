import { setVendorArt } from './data'
import type { Vendor } from './types'

// Matches the hand-drawn icon set in /public/stalls: cobalt marker doodles
// on the app's cream paper colour (gpt-image-2 can't do transparency).
const STYLE = [
  'Hand-drawn street food stall illustration in a naive doodle style,',
  'drawn with a thick cobalt blue marker (#1e3fae) as the only colour,',
  'loose confident single-weight strokes, slightly wobbly hand-drawn lines,',
  'flat, no shading, no gradients, no text, no letters, no border,',
  'a single centred subject filling most of the frame,',
  'on a completely plain, flat, solid warm cream paper background, exact hex #f5f1e6, edge to edge,',
  'in the style of a charming market chalkboard sketch.',
].join(' ')

function artKey(): string | undefined {
  return process.env.OPENAI_KEY ?? process.env.OPENAI_API_KEY
}

export function isArtConfigured(): boolean {
  return Boolean(artKey())
}

/**
 * Generates a stall logo with gpt-image-2 and stores it in vendor_art.
 * Fire-and-forget: failures are logged, never surfaced to the vendor.
 */
export async function generateAndSaveStallArt(vendor: Vendor): Promise<void> {
  if (!isArtConfigured()) return
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${artKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-2',
        prompt: `${STYLE} The subject: a signature dish or icon for a food stall called "${vendor.name}" (stall type: ${vendor.emoji}).`,
        size: '1024x1024',
        quality: 'medium',
        output_format: 'png',
      }),
    })
    if (!res.ok) {
      console.error(`[stall-art] generation failed for ${vendor.slug}:`, res.status, await res.text())
      return
    }
    const data = (await res.json()) as { data?: Array<{ b64_json?: string }> }
    const b64 = data.data?.[0]?.b64_json
    if (!b64) {
      console.error(`[stall-art] no image returned for ${vendor.slug}`)
      return
    }
    await setVendorArt(vendor.id, Buffer.from(b64, 'base64'))
    console.log(`[stall-art] saved art for ${vendor.slug}`)
  } catch (err) {
    console.error(`[stall-art] error for ${vendor.slug}:`, err)
  }
}
