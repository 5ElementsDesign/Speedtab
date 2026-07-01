self.onmessage = function (event) {
  const msg = event.data
  if (!msg || msg.type !== 'run') return

  try {
    const result = runDeepCleanupCheck(msg.inputData)
    self.postMessage({
      taskId: msg.taskId,
      status: 'success',
      payload: result,
    })
  } catch (error) {
    self.postMessage({
      taskId: msg.taskId,
      status: 'error',
      payload: error instanceof Error ? error.message : String(error),
    })
  }
}

function runDeepCleanupCheck(snapshot) {
  const NOTE_IMAGE_TOKEN_RE = /{{asset:image:(\d+)}}/g

  function parseJson(value) {
    if (!value) return null
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }

  function getAppBackgroundAssetId(key, valueJson) {
    const parsed = parseJson(valueJson)
    if (key === 'background_asset_id' && typeof parsed === 'number') return parsed
    return typeof parsed?.background_asset_id === 'number' ? parsed.background_asset_id : null
  }

  function normalizeHostname(value) {
    return String(value || '').trim().toLowerCase().replace(/^www\./, '')
  }

  function getHostnameCandidates(hostname) {
    const normalized = normalizeHostname(hostname)
    if (!normalized) return []
    const parts = normalized.split('.').filter(Boolean)
    const candidates = [normalized]
    if (parts.length >= 3) candidates.push(parts.slice(1).join('.'))
    return Array.from(new Set(candidates))
  }

  function getHostnameCandidatesForUrl(url) {
    if (!url) return []
    try {
      const host = normalizeHostname(new URL(url).hostname)
      if (!host || host.endsWith('.loc')) return []
      if (['example.com', 'example.net', 'example.org', 'feeds.feedburner.com', 'localhost'].includes(host)) {
        return []
      }
      return getHostnameCandidates(host)
    } catch {
      return []
    }
  }

  function extractLinkNoteUrls(content) {
    return String(content || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => {
        if (line === '[hr]' || line.toLowerCase() === '<hr>') return []
        try {
          const url = new URL(line)
          if (url.protocol === 'http:' || url.protocol === 'https:') return [url.toString()]
        } catch {}
        return []
      })
  }

  function extractNoteImageAssetIds(content) {
    const ids = new Set()
    for (const match of String(content || '').matchAll(NOTE_IMAGE_TOKEN_RE)) {
      const assetId = Number(match[1])
      if (Number.isInteger(assetId) && assetId > 0) ids.add(assetId)
    }
    return [...ids]
  }

  function collectReferencedAssetIds() {
    const referencedAssetIds = new Set()

    for (const tab of snapshot.tabs) {
      if (tab.favicon_asset_id != null) referencedAssetIds.add(tab.favicon_asset_id)
      if (tab.preview_asset_id != null) referencedAssetIds.add(tab.preview_asset_id)
    }

    const referencedHosts = new Set()

    for (const tab of snapshot.tabs) {
      for (const host of getHostnameCandidatesForUrl(tab.url)) referencedHosts.add(host)
    }

    for (const note of snapshot.notes) {
      if (note.type === 'links') {
        for (const url of extractLinkNoteUrls(note.content)) {
          for (const host of getHostnameCandidatesForUrl(url)) referencedHosts.add(host)
        }
      }
      if (note.type === 'html') {
        for (const assetId of extractNoteImageAssetIds(note.content)) {
          referencedAssetIds.add(assetId)
        }
      }
    }

    for (const source of snapshot.feedSources) {
      for (const host of getHostnameCandidatesForUrl(source.site_url || source.feed_url)) referencedHosts.add(host)
    }

    for (const item of snapshot.feedItems) {
      for (const host of getHostnameCandidatesForUrl(item.url)) referencedHosts.add(host)
    }

    for (const page of snapshot.pages) {
      const parsed = parseJson(page.config_json)
      if (typeof parsed?.background_asset_id === 'number') {
        referencedAssetIds.add(parsed.background_asset_id)
      }
    }

    for (const setting of snapshot.appSettings) {
      const assetId = getAppBackgroundAssetId(setting.key, setting.value_json)
      if (assetId != null) referencedAssetIds.add(assetId)
    }

    for (const asset of snapshot.assets) {
      if (asset.kind !== 'favicon' || asset.id == null) continue
      const parsed = parseJson(asset.meta_json)
      const hostnames = Array.isArray(parsed?.hostnames)
        ? parsed.hostnames.map(normalizeHostname)
        : typeof parsed?.hostname === 'string'
          ? [normalizeHostname(parsed.hostname)]
          : []
      if (hostnames.some((hostname) => referencedHosts.has(hostname))) {
        referencedAssetIds.add(asset.id)
      }
    }

    return referencedAssetIds
  }

  const pageIds = new Set(snapshot.pages.map((row) => row.id).filter((id) => typeof id === 'number'))
  const orphanModules = snapshot.modules.filter((row) => !pageIds.has(row.page_id))

  const moduleIds = new Set(snapshot.modules.map((row) => row.id).filter((id) => typeof id === 'number'))
  const orphanCollections = snapshot.collections.filter((row) => !moduleIds.has(row.module_id))

  const collectionIds = new Set(snapshot.collections.map((row) => row.id).filter((id) => typeof id === 'number'))
  const orphanTabs = snapshot.tabs.filter((row) => !collectionIds.has(row.collection_id))
  const orphanNotes = snapshot.notes.filter((row) => !collectionIds.has(row.collection_id))
  const orphanFeedSources = snapshot.feedSources.filter((row) => !collectionIds.has(row.collection_id))
  const orphanSavedFeedItems = snapshot.savedFeedItems.filter((row) => !collectionIds.has(row.collection_id))

  const sourceIds = new Set(snapshot.feedSources.map((row) => row.id).filter((id) => typeof id === 'number'))
  const orphanFeedItems = snapshot.feedItems.filter((row) => !sourceIds.has(row.feed_source_id))

  const referencedAssetIds = collectReferencedAssetIds()
  const unusedAssets = snapshot.assets.filter((row) => row.id != null && !referencedAssetIds.has(row.id))

  return {
    modules: orphanModules.length,
    collections: orphanCollections.length,
    tabs: orphanTabs.length,
    notes: orphanNotes.length,
    feedSources: orphanFeedSources.length,
    feedItems: orphanFeedItems.length,
    savedFeedItems: orphanSavedFeedItems.length,
    unusedAssets: unusedAssets.length,
    total: (
      orphanModules.length +
      orphanCollections.length +
      orphanTabs.length +
      orphanNotes.length +
      orphanFeedSources.length +
      orphanFeedItems.length +
      orphanSavedFeedItems.length +
      unusedAssets.length
    ),
  }
}
