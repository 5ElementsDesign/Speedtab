import fallbackFaviconUrl from '@/assets/st-favicon.ico'

const EXCLUDED_FAVICON_HOSTS = new Set([
  'example.com',
  'example.net',
  'example.org',
  'feeds.feedburner.com',
])

function normalizeHostname(value: string): string {
  return value.trim().toLowerCase().replace(/^www\./, '')
}

export function shouldFetchFavicon(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const host = normalizeHostname(new URL(url).hostname)
    return host.length > 0 && !EXCLUDED_FAVICON_HOSTS.has(host)
  } catch {
    return false
  }
}

export function getFaviconUrl(url: string | null | undefined): string {
  if (!shouldFetchFavicon(url)) return fallbackFaviconUrl
  const host = normalizeHostname(new URL(url!).hostname)
  return `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`
}

export function getFallbackFaviconUrl(): string {
  return fallbackFaviconUrl
}

export function useFavicon() {
  return {
    shouldFetchFavicon,
    getFaviconUrl,
    getFallbackFaviconUrl,
  }
}
