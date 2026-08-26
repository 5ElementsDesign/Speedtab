export const FEED_AUTO_REFRESH_INTERVALS = [1, 3, 5, 10, 15, 30, 60, 120]

export function normalizeFeedAutoRefreshInterval(value) {
  const minutes = Number(value)
  return FEED_AUTO_REFRESH_INTERVALS.includes(minutes) ? minutes : null
}

export function getFeedAutoRefreshInterval(configJson) {
  if (!configJson) return null
  try {
    const config = JSON.parse(configJson)
    return normalizeFeedAutoRefreshInterval(config?.feed_auto_refresh_interval ?? config?.feed_auto_refresh_minutes)
  } catch {
    return null
  }
}

export function withFeedAutoRefreshInterval(configJson, value) {
  let config = {}
  try {
    const parsed = JSON.parse(configJson || '{}')
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) config = parsed
  } catch {
    // Replace malformed configuration with the selected feed setting.
  }
  const interval = normalizeFeedAutoRefreshInterval(value)
  if (interval) config.feed_auto_refresh_interval = interval
  else delete config.feed_auto_refresh_interval
  delete config.feed_auto_refresh_minutes
  return Object.keys(config).length ? JSON.stringify(config) : null
}

export function getFeedAutoRefreshDelay(interval) {
  return Number(interval) * 60_000
}

export function getFeedSkipImages(configJson) {
  if (!configJson) return true
  try {
    const config = JSON.parse(configJson)
    return config?.feed_skip_images !== false
  } catch {
    return true
  }
}

export function withFeedSkipImages(configJson, skipImages) {
  let config = {}
  try {
    const parsed = JSON.parse(configJson || '{}')
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) config = parsed
  } catch {
    // Replace malformed configuration with the selected feed setting.
  }
  if (skipImages) delete config.feed_skip_images
  else config.feed_skip_images = false
  return Object.keys(config).length ? JSON.stringify(config) : null
}

export function getFeedFetchItemLimit(configJson) {
  if (!configJson) return 100
  try {
    const value = Number(JSON.parse(configJson)?.feed_fetch_item_limit)
    return Number.isInteger(value) ? Math.max(1, Math.min(100, value)) : 100
  } catch {
    return 100
  }
}

export function withFeedFetchItemLimit(configJson, value) {
  let config = {}
  try {
    const parsed = JSON.parse(configJson || '{}')
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) config = parsed
  } catch {
    // Replace malformed configuration with the selected feed setting.
  }
  const limit = Math.max(1, Math.min(100, Math.trunc(Number(value) || 100)))
  if (limit === 100) delete config.feed_fetch_item_limit
  else config.feed_fetch_item_limit = limit
  return Object.keys(config).length ? JSON.stringify(config) : null
}
