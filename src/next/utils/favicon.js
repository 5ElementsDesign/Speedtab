import {db, makeUpdatedAtPatch} from '../../db/db.ts'
import {sha256hex} from '../data/assets.js'

// CRITICAL PATH:
// This resolver is intentionally simple because more "advanced" variants
// reintroduced subdomain/favicon regressions.
// Before changing this file, read:
// src/lib/yai/docs/SPEEDTAB.CRITICAL-PATHS.md

const EXCLUDED_HOSTS = new Set(['example.com', 'example.net', 'example.org', 'feeds.feedburner.com', 'localhost'])
const FAVICON_TTL_MS            = 90 * 24 * 60 * 60 * 1000
const FAVICON_RETRY_COOLDOWN_MS =  5 * 60 * 1000
const MAX_FAVICON_DIMENSION     = 48
const FAVICON_ALPHA_THRESHOLD   = 32
const FAVICON_DARK_LUMINANCE    = 110
const FAVICON_LIGHT_LUMINANCE   = 215
const FAVICON_LOW_COLOR_SPREAD  = 28
const FAVICON_MIN_TRANSPARENCY  = 0.1
const FAVICON_WHITE_BG_RADIUS   = 4

// In-memory caches
const objectUrlByHost        = new Map() // hostname → blob: URL
const pendingByHost          = new Map() // hostname → Promise (deduplicates concurrent reqs)
const lastFetchAttemptByHost = new Map()
const aliasByHost            = new Map() // subdomain → parent hostname
const listenersByHost        = new Map() // hostname → Set<HTMLImageElement>

function isHiddenByTabState(element) {
  return !!element?.closest?.('[aria-hidden="true"], [inert]')
}

// ─── Hostname helpers ─────────────────────────────────────────────────────────

export function normalizeFaviconHostname(value) {
  return String(value).trim().toLowerCase().replace(/^www\./, '')
}

function isExcludedHost(hostname) {
  return EXCLUDED_HOSTS.has(hostname) || hostname.endsWith('.loc')
}

function getHostnameCandidates(hostname) {
  const normalized = normalizeFaviconHostname(hostname)
  const parts = normalized.split('.').filter(Boolean)
  const candidates = [normalized]
  if (parts.length >= 3) candidates.push(parts.slice(1).join('.'))
  return [...new Set(candidates)]
}

export function getFaviconHostnameCandidatesForUrl(url) {
  const hostname = getHostnameFromUrl(url)
  return hostname ? getHostnameCandidates(hostname) : []
}

function getHostnameFromUrl(url) {
  if (!url) return null
  try {
    const host = normalizeFaviconHostname(new URL(url).hostname)
    if (!host || isExcludedHost(host)) return null
    return host
  } catch { return null }
}

// ─── Meta JSON ────────────────────────────────────────────────────────────────

export function parseFaviconMeta(value) {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    if (typeof parsed?.fetched_at !== 'number') return null
    const hostnames = Array.isArray(parsed?.hostnames)
      ? parsed.hostnames.filter(h => typeof h === 'string').map(normalizeFaviconHostname)
      : typeof parsed?.hostname === 'string'
        ? [normalizeFaviconHostname(parsed.hostname)]
        : []
    if (!hostnames.length) return null
    return {hostnames: [...new Set(hostnames)], fetched_at: parsed.fetched_at}
  } catch { return null }
}

function makeFaviconMeta(hostnames) {
  return JSON.stringify({
    hostnames: [...new Set(hostnames.map(normalizeFaviconHostname))].filter(Boolean),
    fetched_at: Date.now(),
  })
}

function isFresh(meta) {
  return !!meta && (Date.now() - meta.fetched_at) < FAVICON_TTL_MS
}

// ─── IndexedDB ───────────────────────────────────────────────────────────────

async function findFaviconByHostname(hostname) {
  const all = await db.assets.where('kind').equals('favicon').toArray()
  return all.find(a => parseFaviconMeta(a.meta_json)?.hostnames.includes(hostname)) ?? null
}

async function findFaviconFallback(hostname) {
  const all = await db.assets.where('kind').equals('favicon').toArray()
  for (const candidate of getHostnameCandidates(hostname)) {
    if (candidate === hostname) continue
    const asset = all.find(a => parseFaviconMeta(a.meta_json)?.hostnames.includes(candidate)) ?? null
    if (asset) return {asset, candidate}
  }
  return null
}

async function updateAssetHostnames(assetId, hostnames) {
  await db.assets.update(assetId, {meta_json: makeFaviconMeta(hostnames)})
}

// ─── Object URL management ───────────────────────────────────────────────────

function revokeHostObjectUrl(hostname) {
  const existing = objectUrlByHost.get(hostname)
  if (existing) { URL.revokeObjectURL(existing); objectUrlByHost.delete(hostname) }
}

function setObjectUrlForHost(hostname, blob) {
  if (!blob) return
  revokeHostObjectUrl(hostname)
  const url = URL.createObjectURL(blob)
  objectUrlByHost.set(hostname, url)
  notifyListeners(hostname, url)
}

// ─── DOM listener system ─────────────────────────────────────────────────────

function notifyListeners(hostname, url) {
  const listeners = listenersByHost.get(hostname)
  if (!listeners) return
  for (const img of listeners) {
    if (img.isConnected) img.src = url
  }
  listenersByHost.delete(hostname)
}

function registerListener(hostname, img) {
  if (!listenersByHost.has(hostname)) listenersByHost.set(hostname, new Set())
  listenersByHost.get(hostname).add(img)
}

// ─── Fetch & normalize ───────────────────────────────────────────────────────

async function fetchRemoteFaviconBlob(hostname) {
  for (const candidate of getHostnameCandidates(hostname)) {
    try {
      const response = await fetch(`https://icons.duckduckgo.com/ip3/${encodeURIComponent(candidate)}.ico`)
      if (!response.ok) continue
      const blob = await response.blob()
      if (blob.size > 0) return {blob, resolvedHostname: candidate}
    } catch {}
  }
  return null
}

function analyzeFaviconPixels(ctx, width, height) {
  try {
    const {data} = ctx.getImageData(0, 0, width, height)
    let visiblePixels = 0
    let transparentPixels = 0
    let luminanceTotal = 0
    let channelSpreadTotal = 0

    for (let index = 0; index < data.length; index += 4) {
      const r = data[index]
      const g = data[index + 1]
      const b = data[index + 2]
      const a = data[index + 3]

      if (a < FAVICON_ALPHA_THRESHOLD) {
        transparentPixels += 1
        continue
      }

      visiblePixels += 1
      luminanceTotal += (0.2126 * r) + (0.7152 * g) + (0.0722 * b)
      channelSpreadTotal += Math.max(r, g, b) - Math.min(r, g, b)
    }

    const totalPixels = width * height
    if (!visiblePixels || !totalPixels) return null

    const transparencyRatio = transparentPixels / totalPixels
    const averageLuminance = luminanceTotal / visiblePixels
    const averageChannelSpread = channelSpreadTotal / visiblePixels

    return {
      transparencyRatio,
      averageLuminance,
      averageChannelSpread,
    }
  } catch {
    return null
  }
}

function getFaviconBackgroundFixColor(ctx, width, height, mode = 'dark-only') {
  const analysis = analyzeFaviconPixels(ctx, width, height)
  if (!analysis) return null

  const {transparencyRatio, averageLuminance, averageChannelSpread} = analysis
  if (transparencyRatio < FAVICON_MIN_TRANSPARENCY || averageChannelSpread > FAVICON_LOW_COLOR_SPREAD) {
    return null
  }

  if (averageLuminance <= FAVICON_DARK_LUMINANCE) return '#ffffff'
  if (mode === 'auto' && averageLuminance >= FAVICON_LIGHT_LUMINANCE) return '#000000'
  return null
}

async function canvasToPngBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/png')
  })
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2))
  ctx.beginPath()
  ctx.moveTo(x + safeRadius, y)
  ctx.lineTo(x + width - safeRadius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
  ctx.lineTo(x + width, y + height - safeRadius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height)
  ctx.lineTo(x + safeRadius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
  ctx.lineTo(x, y + safeRadius)
  ctx.quadraticCurveTo(x, y, x + safeRadius, y)
  ctx.closePath()
}

export async function normalizeStoredFaviconBlob(blob, options = {}) {
  const {backgroundMode = 'dark-only'} = options
  if (typeof createImageBitmap !== 'function') return {blob, width: null, height: null}
  try {
    const bitmap = await createImageBitmap(blob)
    const {width, height} = bitmap
    const scale = Math.min(MAX_FAVICON_DIMENSION / width, MAX_FAVICON_DIMENSION / height)
    const tw = Math.max(1, Math.round(width * scale))
    const th = Math.max(1, Math.round(height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = MAX_FAVICON_DIMENSION
    canvas.height = MAX_FAVICON_DIMENSION
    const ctx = canvas.getContext('2d')
    if (!ctx) { bitmap.close(); return {blob, width, height} }
    const offsetX = Math.round((MAX_FAVICON_DIMENSION - tw) / 2)
    const offsetY = Math.round((MAX_FAVICON_DIMENSION - th) / 2)
    ctx.clearRect(0, 0, MAX_FAVICON_DIMENSION, MAX_FAVICON_DIMENSION)
    ctx.drawImage(bitmap, offsetX, offsetY, tw, th)
    bitmap.close()

    const backgroundColor = getFaviconBackgroundFixColor(
      ctx,
      MAX_FAVICON_DIMENSION,
      MAX_FAVICON_DIMENSION,
      backgroundMode,
    )

    if (backgroundColor) {
      const flattenedCanvas = document.createElement('canvas')
      flattenedCanvas.width = MAX_FAVICON_DIMENSION
      flattenedCanvas.height = MAX_FAVICON_DIMENSION
      const flattenedCtx = flattenedCanvas.getContext('2d')
      if (flattenedCtx) {
        drawRoundedRect(flattenedCtx, 0, 0, MAX_FAVICON_DIMENSION, MAX_FAVICON_DIMENSION, FAVICON_WHITE_BG_RADIUS)
        flattenedCtx.fillStyle = backgroundColor
        flattenedCtx.fill()
        flattenedCtx.drawImage(canvas, 0, 0)
        const flattenedBlob = await canvasToPngBlob(flattenedCanvas)
        return {blob: flattenedBlob ?? blob, width: MAX_FAVICON_DIMENSION, height: MAX_FAVICON_DIMENSION}
      }
    }

    const normalized = await canvasToPngBlob(canvas)
    if (normalized) {
      return {blob: normalized, width: MAX_FAVICON_DIMENSION, height: MAX_FAVICON_DIMENSION}
    }
    return {blob, width: MAX_FAVICON_DIMENSION, height: MAX_FAVICON_DIMENSION}
  } catch { return {blob, width: null, height: null} }
}

export async function fixFaviconAssetBackground(assetId) {
  const id = Number(assetId)
  if (!id) return false
  const asset = await db.assets.get(id)
  if (!asset?.blob || asset.kind !== 'favicon') return false

  const normalized = await normalizeStoredFaviconBlob(asset.blob, {backgroundMode: 'auto'})
  const nextBlob = normalized.blob
  const nextChecksum = await sha256hex(nextBlob)

  if (nextChecksum === asset.checksum) return false

  const hostnames = parseFaviconMeta(asset.meta_json)?.hostnames ?? []
  const existingForChecksum = await db.assets.where('checksum').equals(nextChecksum).first()

  if (existingForChecksum?.id != null && existingForChecksum.id !== id) {
    const now = Date.now()
    const mergedHostnames = [
      ...(parseFaviconMeta(existingForChecksum.meta_json)?.hostnames ?? []),
      ...hostnames,
    ]

    await db.transaction('rw', [db.assets, db.tabs], async () => {
      await db.assets.update(existingForChecksum.id, {
        meta_json: makeFaviconMeta(mergedHostnames),
      })

      const directRefs = await db.tabs.where('favicon_asset_id').equals(id).toArray()
      for (const tab of directRefs) {
        await db.tabs.update(tab.id, {
          favicon_asset_id: existingForChecksum.id,
          ...makeUpdatedAtPatch(now),
        })
      }

      await db.assets.delete(id)
    })

    for (const hostname of hostnames) {
      setObjectUrlForHost(hostname, existingForChecksum.blob)
    }

    return true
  }

  await db.assets.update(id, {
    blob: nextBlob,
    checksum: nextChecksum,
    width: normalized.width,
    height: normalized.height,
  })

  for (const hostname of hostnames) {
    setObjectUrlForHost(hostname, nextBlob)
  }

  return true
}

// ─── Refresh: fetch remote, deduplicate, store ────────────────────────────────

async function refreshFaviconForHost(hostname) {
  const remoteFavicon = await fetchRemoteFaviconBlob(hostname)
  if (!remoteFavicon) return

  const {blob: remoteBlob, resolvedHostname} = remoteFavicon
  const normalized = await normalizeStoredFaviconBlob(remoteBlob)
  const faviconBlob = normalized.blob
  const storageHostname = normalizeFaviconHostname(resolvedHostname)
  const associatedHostnames = [...new Set([normalizeFaviconHostname(hostname), storageHostname])]

  if (storageHostname !== hostname) aliasByHost.set(hostname, storageHostname)
  else aliasByHost.delete(hostname)

  const checksum = await sha256hex(faviconBlob)
  const [existingForHost, existingForChecksum] = await Promise.all([
    findFaviconByHostname(storageHostname),
    db.assets.where('checksum').equals(checksum).first(),
  ])

  // Same blob already stored under a different hostname — merge
  if (existingForChecksum?.id != null && existingForChecksum.id !== existingForHost?.id) {
    if (existingForHost?.id != null) {
      const fromMeta = parseFaviconMeta(existingForHost.meta_json)
      const remaining = (fromMeta?.hostnames ?? []).filter(h => h !== storageHostname)
      if (!remaining.length) await db.assets.delete(existingForHost.id)
      else await updateAssetHostnames(existingForHost.id, remaining)
    }
    const toMeta = parseFaviconMeta(existingForChecksum.meta_json)
    await updateAssetHostnames(existingForChecksum.id, [
      ...(toMeta?.hostnames ?? []),
      ...associatedHostnames,
    ])
    setObjectUrlForHost(hostname, existingForChecksum.blob)
    return
  }

  if (existingForHost?.id != null) {
    const hostnames = [...new Set([...(parseFaviconMeta(existingForHost.meta_json)?.hostnames ?? []), ...associatedHostnames])]
    await db.assets.update(existingForHost.id, {checksum, blob: faviconBlob, width: normalized.width, height: normalized.height, meta_json: makeFaviconMeta(hostnames)})
  } else if (existingForChecksum?.id != null) {
    const hostnames = parseFaviconMeta(existingForChecksum.meta_json)?.hostnames ?? []
    await db.assets.update(existingForChecksum.id, {meta_json: makeFaviconMeta([...hostnames, ...associatedHostnames])})
  } else {
    await db.assets.add({kind: 'favicon', checksum, blob: faviconBlob, width: normalized.width, height: normalized.height, meta_json: makeFaviconMeta(associatedHostnames)})
  }

  setObjectUrlForHost(hostname, faviconBlob)
}

// ─── Ensure: cache-first, then fetch ─────────────────────────────────────────

async function ensureFaviconForHost(hostname) {
  const pending = pendingByHost.get(hostname)
  if (pending) return pending

  const run = (async () => {
    const existing = await findFaviconByHostname(hostname)
    const meta = parseFaviconMeta(existing?.meta_json)

    if (existing?.blob) {
      aliasByHost.delete(hostname)
      setObjectUrlForHost(hostname, existing.blob)
      if (isFresh(meta)) return
    }

    const fallback = await findFaviconFallback(hostname)
    if (!existing?.blob && fallback?.asset.blob) {
      aliasByHost.set(hostname, fallback.candidate)
      setObjectUrlForHost(hostname, fallback.asset.blob)
    }

    const lastAttempt = lastFetchAttemptByHost.get(hostname)
    if (typeof lastAttempt === 'number' && (Date.now() - lastAttempt) < FAVICON_RETRY_COOLDOWN_MS) return

    lastFetchAttemptByHost.set(hostname, Date.now())
    await refreshFaviconForHost(hostname)
  })().finally(() => pendingByHost.delete(hostname))

  pendingByHost.set(hostname, run)
  return run
}

export async function refreshStaleFavicons() {
  const faviconAssets = await db.assets.where('kind').equals('favicon').toArray()
  let refreshed = 0

  for (const asset of faviconAssets) {
    const meta = parseFaviconMeta(asset.meta_json)
    if (!meta || isFresh(meta)) continue

    try {
      for (const hostname of meta.hostnames) {
        await refreshFaviconForHost(hostname)
        refreshed += 1
      }
    } catch {
      // Keep the current favicon blob in place on refresh failure so live references stay usable.
    }
  }

  return refreshed
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Wire up a single <img data-favicon-url="..."> element.
 * Sets src immediately from cache, or registers for async update once fetched.
 */
export function loadFaviconImg(img) {
  const url = img.dataset.faviconUrl
  const hostname = getHostnameFromUrl(url)
  if (!hostname) return

  const getCachedUrl = () => {
    const alias = aliasByHost.get(hostname)
    return objectUrlByHost.get(hostname) ?? (alias ? objectUrlByHost.get(alias) : null)
  }

  const cached = getCachedUrl()
  if (cached) { img.src = cached; return }

  registerListener(hostname, img)
  ensureFaviconForHost(hostname).then(() => {
    if (!img.isConnected) return
    const finalUrl = getCachedUrl()
    if (finalUrl) img.src = finalUrl
  })
}

export function initFavicons(container, options = {}) {
  const {force = false} = options
  container.querySelectorAll('img[data-favicon-url]').forEach((img) => {
    if (img.hasAttribute('data-bookmark-media')) return
    if (img.getAttribute('src')) return
    if (!force && isHiddenByTabState(img)) return
    loadFaviconImg(img)
  })
}

export async function ensureFaviconAssetIdForUrl(url) {
  const hostname = getHostnameFromUrl(url)
  if (!hostname) return null

  await ensureFaviconForHost(hostname)
  const asset = await findFaviconByHostname(hostname)
  if (asset?.id) return asset.id
  const fallback = await findFaviconFallback(hostname)
  if (fallback?.asset?.id) return fallback.asset.id
  return null
}
