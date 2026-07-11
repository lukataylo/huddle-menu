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

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
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
            {
              type: 'text',
              text: "This is a food vendor's menu. Extract every menu item you can read: name, description (empty string if none printed), price in pence (e.g. £5.50 → 550), and the menu section it belongs to. Keep the original wording and item order.",
            },
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
