export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function findMetaContent(html, attribute, value) {
  const escapedValue = escapeRegex(value)
  const patterns = [
    new RegExp(`<meta\\b[^>]*\\b${attribute}\\s*=\\s*(["'])${escapedValue}\\1[^>]*\\bcontent\\s*=\\s*(["'])([\\s\\S]*?)\\2[^>]*>`, 'i'),
    new RegExp(`<meta\\b[^>]*\\bcontent\\s*=\\s*(["'])([\\s\\S]*?)\\1[^>]*\\b${attribute}\\s*=\\s*(["'])${escapedValue}\\3[^>]*>`, 'i'),
    new RegExp(`<meta\\b[^>]*\\b${attribute}\\s*=\\s*(?:["']${escapedValue}["']|${escapedValue})[^>]*\\bcontent\\s*=\\s*(["'])([\\s\\S]*?)\\1[^>]*>`, 'i'),
    new RegExp(`<meta\\b[^>]*\\bcontent\\s*=\\s*(["'])([\\s\\S]*?)\\1[^>]*\\b${attribute}\\s*=\\s*(?:["']${escapedValue}["']|${escapedValue})[^>]*>`, 'i'),
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    const content = match?.[3] ?? match?.[2] ?? null
    if (content?.trim()) return content.replace(/\s+/g, ' ').trim()
  }

  return null
}

export function extractDescription(html) {
  return findMetaContent(html, 'name', 'description')
    || findMetaContent(html, 'property', 'og:description')
    || findMetaContent(html, 'name', 'twitter:description')
    || findMetaContent(html, 'itemprop', 'description')
}
