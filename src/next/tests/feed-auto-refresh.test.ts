import {describe, expect, it} from 'vitest'
import {FEED_AUTO_REFRESH_INTERVALS, getFeedAutoRefreshInterval, getFeedFetchItemLimit, getFeedSkipImages, normalizeFeedAutoRefreshInterval, withFeedAutoRefreshInterval, withFeedFetchItemLimit, withFeedSkipImages} from '../features/modules/feed-auto-refresh.js'

describe('feed auto-refresh settings', () => {
  it('accepts only the supported minute intervals', () => {
    expect(FEED_AUTO_REFRESH_INTERVALS).toEqual([1, 3, 5, 10, 15, 30, 60, 120])
    expect(normalizeFeedAutoRefreshInterval('15')).toBe(15)
    expect(normalizeFeedAutoRefreshInterval(2)).toBeNull()
  })

  it('preserves unrelated tab configuration when saving an interval', () => {
    const config = withFeedAutoRefreshInterval('{"display":"compact"}', 10)
    expect(config).toBe('{"display":"compact","feed_auto_refresh_interval":10}')
    expect(getFeedAutoRefreshInterval(config)).toBe(10)
  })

  it('removes only the auto-refresh setting when switched off', () => {
    expect(withFeedAutoRefreshInterval('{"display":"compact","feed_auto_refresh_interval":10}', '')).toBe('{"display":"compact"}')
    expect(withFeedAutoRefreshInterval('{"feed_auto_refresh_interval":10}', '')).toBeNull()
  })

  it('skips feed images by default without storing a redundant setting', () => {
    expect(getFeedSkipImages(null)).toBe(true)
    expect(withFeedSkipImages('{"display":"compact"}', true)).toBe('{"display":"compact"}')
    expect(withFeedSkipImages('{"display":"compact"}', false)).toBe('{"display":"compact","feed_skip_images":false}')
    expect(getFeedSkipImages('{"feed_skip_images":false}')).toBe(false)
  })

  it('limits fetched feed items to a module-wide value between one and 100', () => {
    expect(getFeedFetchItemLimit(null)).toBe(100)
    expect(withFeedFetchItemLimit('{"display":"compact"}', 20)).toBe('{"display":"compact","feed_fetch_item_limit":20}')
    expect(getFeedFetchItemLimit('{"feed_fetch_item_limit":500}')).toBe(100)
  })
})
