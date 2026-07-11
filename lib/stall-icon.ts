// Maps a vendor's emoji + name to the closest hand-drawn stall icon in /public/stalls.

const RULES: Array<[RegExp, string]> = [
  [/☕|🍵|coffee|brew|espresso|cafe/iu, 'coffee'],
  [/🍕|pizza/iu, 'pizza'],
  [/🍔|burger|grill/iu, 'burger'],
  [/🌮|🌯|🥙|taco|burrito|kebab|wrap/iu, 'taco'],
  [/🍜|🥟|🍛|🥘|noodle|bao|ramen|wok|curry|asian/iu, 'noodle'],
  [/🍰|🍩|🍦|🧁|dessert|cake|donut|doughnut|sweet|ice cream|gelato/iu, 'dessert'],
  [/🧀|cheese|raclette/iu, 'cheese'],
  [/🥗|🥕|🍎|veg|salad|fruit|greens/iu, 'fruitveg'],
  [/🐟|🦀|🦞|🍣|fish|seafood|oyster|sushi/iu, 'seafood'],
  [/🥪|🥖|sandwich|deli|sub|toastie/iu, 'sandwich'],
  [/🥤|🧃|🍹|juice|drink|smoothie|soda|lemonade/iu, 'drinks'],
  [/🥐|🍞|bak(e|ery)|bread|pastry|croissant/iu, 'bakery'],
]

/**
 * The vendor's display art: the AI-generated logo when it exists,
 * otherwise the route 302s to the closest hand-drawn /public/stalls icon.
 */
export function stallArtSrc(slug: string): string {
  return `/api/vendor/${slug}/art`
}

/** The hand-drawn stall-type asset bank in /public/stalls. */
export const STALL_TYPES = [
  { key: 'noodle', label: 'Noodles & Asian' },
  { key: 'burger', label: 'Burgers & Grill' },
  { key: 'pizza', label: 'Pizza' },
  { key: 'taco', label: 'Tacos & Wraps' },
  { key: 'sandwich', label: 'Sandwiches' },
  { key: 'seafood', label: 'Seafood' },
  { key: 'bakery', label: 'Bakery' },
  { key: 'dessert', label: 'Desserts' },
  { key: 'coffee', label: 'Coffee' },
  { key: 'drinks', label: 'Drinks' },
  { key: 'cheese', label: 'Cheese & Deli' },
  { key: 'fruitveg', label: 'Fruit & Veg' },
] as const

export function stallIconPath(emoji: string, name: string): string {
  // New vendors store a stall-type key directly; legacy vendors stored an emoji.
  if (STALL_TYPES.some((type) => type.key === emoji)) return `/stalls/${emoji}.png`
  const haystack = `${emoji} ${name}`
  for (const [pattern, icon] of RULES) {
    if (pattern.test(haystack)) return `/stalls/${icon}.png`
  }
  return '/stalls/noodle.png'
}
