const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: '£',
  EUR: '€',
  USD: '$',
}

export function formatMoney(pence: number, currency = 'GBP'): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `
  return `${symbol}${(pence / 100).toFixed(2)}`
}

/** Mollie wants decimal string amounts like "12.50" */
export function toMollieAmount(pence: number): string {
  return (pence / 100).toFixed(2)
}
