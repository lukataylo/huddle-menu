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

export function stallIconPath(emoji: string, name: string): string {
  const haystack = `${emoji} ${name}`
  for (const [pattern, icon] of RULES) {
    if (pattern.test(haystack)) return `/stalls/${icon}.png`
  }
  return '/stalls/noodle.png'
}
