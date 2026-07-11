import createMollieClient, { MollieClient } from '@mollie/api-client'

let client: MollieClient | null = null

export function isMollieConfigured(): boolean {
  return Boolean(process.env.MOLLIE_API_KEY)
}

export function getMollieClient(): MollieClient {
  if (!process.env.MOLLIE_API_KEY) {
    throw new Error('MOLLIE_API_KEY is not set')
  }
  if (!client) {
    client = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY })
  }
  return client
}

/**
 * Base URL for redirect/webhook URLs. Prefers APP_URL (set in production),
 * falls back to the incoming request's origin (fine for local dev).
 */
export function getBaseUrl(req: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '')
  return new URL(req.url).origin
}
