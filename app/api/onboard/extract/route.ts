import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const ALLOWED_MEDIA_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
] as const
type AllowedMediaType = (typeof ALLOWED_MEDIA_TYPES)[number]

// ~5MB of image/PDF, base64-encoded
const MAX_BASE64_LENGTH = 7_000_000

const MENU_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Item name as printed on the menu' },
          description: {
            type: 'string',
            description: 'Item description if printed, else empty string',
          },
          price_pence: {
            type: 'integer',
            description: 'Price in pence/cents, e.g. £5.50 → 550. 0 if unreadable.',
          },
          category: {
            type: 'string',
            description: "Menu section heading, e.g. 'Mains', 'Sides', 'Drinks'. Use 'Menu' if none.",
          },
        },
        required: ['name', 'description', 'price_pence', 'category'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
} as const

const EXTRACT_PROMPT =
  "This is a food vendor's menu. Extract every menu item you can actually read in the image: name, description (empty string if none printed), price in pence (e.g. £5.50 → 550), and the menu section it belongs to. Keep the original wording and item order. Only include items genuinely visible in the image — if there is no readable menu, return an empty items array. Never invent items."

// Fallback extractor: OpenAI vision with the same JSON schema (images only).
async function extractWithOpenAI(
  apiKey: string,
  image: string,
  mediaType: AllowedMediaType
): Promise<{ items: unknown } | { error: string; status: number }> {
  if (mediaType === 'application/pdf') {
    return { error: 'PDF import is unavailable right now — take a photo of the menu instead.', status: 503 }
  }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 8000,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'menu', strict: true, schema: MENU_SCHEMA },
      },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mediaType};base64,${image}` } },
            { type: 'text', text: EXTRACT_PROMPT },
          ],
        },
      ],
    }),
  })
  if (!res.ok) {
    console.error('[onboard extract] OpenAI request failed:', res.status, await res.text())
    return { error: 'Could not read the menu photo. Try a clearer photo, or add items manually.', status: 502 }
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  try {
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '')
    return { items: parsed.items }
  } catch {
    return { error: 'Could not read the menu photo. Try a clearer photo, or add items manually.', status: 502 }
  }
}

export async function POST(req: Request) {
  const openaiKey = process.env.OPENAI_KEY ?? process.env.OPENAI_API_KEY
  if (!process.env.ANTHROPIC_API_KEY && !openaiKey) {
    return NextResponse.json(
      { error: 'AI menu extraction is not configured. Add your items manually instead.' },
      { status: 503 }
    )
  }

  const body = await req.json().catch(() => null)
  const image = typeof body?.image === 'string' ? body.image : ''
  const mediaType = body?.mediaType as AllowedMediaType

  if (!image || image.length > MAX_BASE64_LENGTH || !ALLOWED_MEDIA_TYPES.includes(mediaType)) {
    return NextResponse.json(
      { error: 'Please upload a JPEG, PNG, WebP photo or PDF under 5MB.' },
      { status: 400 }
    )
  }

  // Anthropic preferred (handles PDFs too); OpenAI vision as fallback.
  if (!process.env.ANTHROPIC_API_KEY && openaiKey) {
    const result = await extractWithOpenAI(openaiKey, image, mediaType)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(result)
  }

  const menuBlock: Anthropic.ContentBlockParam =
    mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: image } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } }

  const client = new Anthropic()
  let response: Anthropic.Message
  try {
    response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 16000,
      output_config: { format: { type: 'json_schema', schema: MENU_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            menuBlock,
            { type: 'text', text: EXTRACT_PROMPT },
          ],
        },
      ],
    })
  } catch (err) {
    console.error('[onboard extract] Anthropic request failed:', err)
    return NextResponse.json(
      { error: 'Could not read the menu photo. Try a clearer photo, or add items manually.' },
      { status: 502 }
    )
  }

  if (response.stop_reason === 'refusal') {
    return NextResponse.json(
      { error: 'The photo could not be processed. Try a different photo, or add items manually.' },
      { status: 422 }
    )
  }

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  )
  try {
    const parsed = JSON.parse(textBlock?.text ?? '')
    return NextResponse.json({ items: parsed.items })
  } catch {
    console.error('[onboard extract] Could not parse model output')
    return NextResponse.json(
      { error: 'Could not read the menu photo. Try a clearer photo, or add items manually.' },
      { status: 502 }
    )
  }
}
