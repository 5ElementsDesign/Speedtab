import type { FeedItem } from '@/types/db'

/**
 * Normalizes RSS/Atom XML into FeedItem objects.
 * Uses native DOMParser (available in the UI context).
 */
export function useFeed() {
  function textContentOf(entry: Element, selector: string): string | null {
    return entry.querySelector(selector)?.textContent?.trim() || null
  }

  function attributeOf(entry: Element, selector: string, attribute: string): string | null {
    return entry.querySelector(selector)?.getAttribute(attribute)?.trim() || null
  }

  function imageUrlOf(entry: Element): string | null {
    const candidates = [
      attributeOf(entry, 'media\\:content, content', 'url'),
      attributeOf(entry, 'media\\:thumbnail, thumbnail', 'url'),
      attributeOf(entry, 'enclosure[type^="image/"]', 'url'),
      attributeOf(entry, 'itunes\\:image, image', 'href'),
      attributeOf(entry, 'link[rel="enclosure"][type^="image/"]', 'href'),
    ]
    return candidates.find(Boolean) ?? null
  }

  function mediaAlreadyInContent(imageUrl: string | null, ...content: Array<string | null>): boolean {
    return !!imageUrl && content.some((value) => value?.includes(imageUrl))
  }

  function parsePublishedAt(value: string | null): number | null {
    if (!value) return null
    const timestamp = new Date(value).getTime()
    return Number.isFinite(timestamp) ? timestamp : null
  }

  function parseFeed(xmlText: string, sourceId: number): FeedItem[] {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlText, 'text/xml')
    const errorNode = doc.querySelector('parsererror')
    if (errorNode) {
      throw new Error('Failed to parse feed XML')
    }

    // Try Atom
    const entries = doc.querySelectorAll('entry')
    if (entries.length > 0) {
      return Array.from(entries).map(entry => parseAtomEntry(entry, sourceId))
    }

    // Try RSS
    const items = doc.querySelectorAll('item')
    if (items.length > 0) {
      return Array.from(items).map(item => parseRssItem(item, sourceId))
    }

    return []
  }

  function parseAtomEntry(entry: Element, sourceId: number): FeedItem {
    const id = textContentOf(entry, 'id')
    const title = textContentOf(entry, 'title') || 'Untitled'
    const link = attributeOf(entry, 'link[rel="alternate"]', 'href') ||
                 attributeOf(entry, 'link', 'href') ||
                 null
    const author = textContentOf(entry, 'author name')
    const published = textContentOf(entry, 'published') ||
                      textContentOf(entry, 'updated') ||
                      null
    const summary = textContentOf(entry, 'summary')
    const content = textContentOf(entry, 'content')
    const imageUrl = imageUrlOf(entry)

    const youtubeVideoId = textContentOf(entry, 'yt\\:videoId, videoId')
    const youtubeChannelId = textContentOf(entry, 'yt\\:channelId, channelId')
    const youtubeThumbnailUrl = attributeOf(entry, 'media\\:thumbnail, thumbnail', 'url')
    const youtubeDescription = textContentOf(entry, 'media\\:description, description')
    const youtubeViewCount = attributeOf(entry, 'media\\:statistics, statistics', 'views')
    const youtubeStarCount = attributeOf(entry, 'media\\:starRating, starRating', 'count')

    const payload = youtubeVideoId ? {
      kind: 'youtube',
      video_id: youtubeVideoId,
      channel_id: youtubeChannelId,
      thumbnail_url: youtubeThumbnailUrl,
      description: youtubeDescription,
      view_count: youtubeViewCount ? Number(youtubeViewCount) : null,
      star_count: youtubeStarCount ? Number(youtubeStarCount) : null,
    } : imageUrl && !mediaAlreadyInContent(imageUrl, content ?? summary) ? {kind: 'media', image_url: imageUrl} : null

    return {
      feed_source_id: sourceId,
      external_id: id,
      title,
      url: link,
      author,
      published_at: parsePublishedAt(published),
      summary,
      content,
      fetched_at: Date.now(),
      read_at: null,
      payload_json: payload ? JSON.stringify(payload) : null
    }
  }

  function parseRssItem(item: Element, sourceId: number): FeedItem {
    const guid = item.querySelector('guid')?.textContent || null
    const title = item.querySelector('title')?.textContent || 'Untitled'
    const link = item.querySelector('link')?.textContent || null
    const author = item.querySelector('dc\\:creator, creator')?.textContent || null
    const published = textContentOf(item, 'pubDate') || textContentOf(item, 'dc\\:date, date')
    const description = item.querySelector('description')?.textContent || null
    const content = item.querySelector('content\\:encoded, encoded')?.textContent || null
    const imageUrl = imageUrlOf(item)

    return {
      feed_source_id: sourceId,
      external_id: guid,
      title,
      url: link,
      author,
      published_at: parsePublishedAt(published),
      summary: description,
      content: content,
      fetched_at: Date.now(),
      read_at: null,
      payload_json: imageUrl && !mediaAlreadyInContent(imageUrl, content ?? description)
        ? JSON.stringify({kind: 'media', image_url: imageUrl})
        : null
    }
  }

  async function fetchFeed(url: string): Promise<string> {
    // Delegate to Service Worker to bypass CORS
    const response = await chrome.runtime.sendMessage({ type: 'FETCH_FEED', url })
    if (!response.ok) {
      throw new Error(response.error || 'Failed to fetch feed')
    }
    return response.xml
  }

  return {
    fetchFeed,
    parseFeed
  }
}
