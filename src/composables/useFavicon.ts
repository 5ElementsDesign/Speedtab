import fallbackFaviconUrl from '@/assets/st-favicon.ico'
import { db } from '@/db/db'
import { sha256hex } from '@/composables/useAsset'
import { ref } from 'vue'

const EXCLUDED_FAVICON_HOSTS = new Set([
  'example.com',
  'example.net',
  'example.org',
  'feeds.feedburner.com',
  'localhost',
])

const FAVICON_TTL_MS = 90 * 24 * 60 * 60 * 1000
const MAX_FAVICON_DIMENSION = 48
const faviconVersion = ref(0)
const objectUrlByHost = new Map<string, string>()
const pendingByHost = new Map<string, Promise<void>>()
const aliasByHost = new Map<string, string>()

export type FaviconMeta = {
  hostnames: string[]
  fetched_at: number
}

export function normalizeFaviconHostname(value: string): string {
  return value.trim().toLowerCase().replace(/^www\./, '')
}

export function parseFaviconMeta(value: string | null | undefined): FaviconMeta | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    if (typeof parsed?.fetched_at !== 'number') return null
    const hostnames = Array.isArray(parsed?.hostnames)
      ? parsed.hostnames.filter((entry: unknown): entry is string => typeof entry === 'string').map(normalizeFaviconHostname)
      : typeof parsed?.hostname === 'string'
        ? [normalizeFaviconHostname(parsed.hostname)]
        : []
    if (!hostnames.length) return null
    return {
      hostnames: Array.from(new Set(hostnames)),
      fetched_at: parsed.fetched_at,
    }
  } catch {
    return null
  }
}

function makeFaviconMeta(hostnames: string[]): string {
  return JSON.stringify({
    hostnames: Array.from(new Set(hostnames.map(normalizeFaviconHostname))).filter(Boolean),
    fetched_at: Date.now(),
  } satisfies FaviconMeta)
}

function touchFaviconVersion() {
  faviconVersion.value += 1
}

function revokeHostObjectUrl(hostname: string) {
  const existing = objectUrlByHost.get(hostname)
  if (existing) {
    URL.revokeObjectURL(existing)
    objectUrlByHost.delete(hostname)
  }
}

async function findFaviconAssetByHostname(hostname: string) {
  const faviconAssets = await db.assets.where('kind').equals('favicon').toArray()
  return faviconAssets.find((asset) => parseFaviconMeta(asset.meta_json)?.hostnames.includes(hostname)) ?? null
}

async function setCachedObjectUrlForHost(hostname: string, blob: Blob | null | undefined) {
  if (!blob) return
  revokeHostObjectUrl(hostname)
  objectUrlByHost.set(hostname, URL.createObjectURL(blob))
  touchFaviconVersion()
}

function getHostnameCandidates(hostname: string): string[] {
  const normalized = normalizeFaviconHostname(hostname)
  const parts = normalized.split('.').filter(Boolean)
  const candidates = [normalized]
  if (parts.length >= 3) {
    candidates.push(parts.slice(1).join('.'))
  }
  return Array.from(new Set(candidates))
}

function isExcludedFaviconHost(hostname: string): boolean {
  return EXCLUDED_FAVICON_HOSTS.has(hostname) || hostname.endsWith('.loc')
}

export function getFaviconHostnameCandidatesForUrl(url: string | null | undefined): string[] {
  if (!url) return []
  try {
    const host = normalizeFaviconHostname(new URL(url).hostname)
    if (!host || isExcludedFaviconHost(host)) return []
    return getHostnameCandidates(host)
  } catch {
    return []
  }
}

async function fetchRemoteFaviconBlob(hostname: string): Promise<Blob | null> {
  for (const candidate of getHostnameCandidates(hostname)) {
    const response = await fetch(`https://icons.duckduckgo.com/ip3/${encodeURIComponent(candidate)}.ico`)
    if (!response.ok) continue
    const blob = await response.blob()
    if (blob.size > 0) {
      aliasByHost.set(hostname, candidate)
      return blob
    }
  }
  return null
}

async function normalizeFaviconBlob(blob: Blob): Promise<{ blob: Blob; width: number | null; height: number | null }> {
  if (typeof createImageBitmap !== 'function') {
    return { blob, width: null, height: null }
  }

  try {
    const bitmap = await createImageBitmap(blob)
    const { width, height } = bitmap

    if (width <= MAX_FAVICON_DIMENSION && height <= MAX_FAVICON_DIMENSION) {
      bitmap.close()
      return { blob, width, height }
    }

    const scale = Math.min(MAX_FAVICON_DIMENSION / width, MAX_FAVICON_DIMENSION / height)
    const targetWidth = Math.max(1, Math.round(width * scale))
    const targetHeight = Math.max(1, Math.round(height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return { blob, width, height }
    }

    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight)
    bitmap.close()

    const normalizedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((nextBlob) => resolve(nextBlob), 'image/png')
    })

    return {
      blob: normalizedBlob ?? blob,
      width: targetWidth,
      height: targetHeight,
    }
  } catch {
    return { blob, width: null, height: null }
  }
}

async function updateAssetHostnames(assetId: number, hostnames: string[]) {
  await db.assets.update(assetId, {
    meta_json: makeFaviconMeta(hostnames),
  })
}

async function moveHostnameBetweenAssets(fromAssetId: number, toAssetId: number, hostname: string) {
  const [fromAsset, toAsset] = await Promise.all([
    db.assets.get(fromAssetId),
    db.assets.get(toAssetId),
  ])
  if (!toAsset) return

  const fromMeta = parseFaviconMeta(fromAsset?.meta_json)
  const toMeta = parseFaviconMeta(toAsset.meta_json)
  const toHostnames = Array.from(new Set([...(toMeta?.hostnames ?? []), hostname]))
  await updateAssetHostnames(toAssetId, toHostnames)

  if (!fromAsset) return
  const remainingHostnames = (fromMeta?.hostnames ?? []).filter((entry) => entry !== hostname)
  if (!remainingHostnames.length) {
    await db.assets.delete(fromAssetId)
    revokeHostObjectUrl(hostname)
    return
  }

  await updateAssetHostnames(fromAssetId, remainingHostnames)
}

async function refreshFaviconForHost(hostname: string) {
  const remoteBlob = await fetchRemoteFaviconBlob(hostname)
  if (!remoteBlob) return

  const normalized = await normalizeFaviconBlob(remoteBlob)
  const faviconBlob = normalized.blob

  const checksum = await sha256hex(faviconBlob)
  const [existingForHost, existingForChecksum] = await Promise.all([
    findFaviconAssetByHostname(hostname),
    db.assets.where('checksum').equals(checksum).first(),
  ])

  if (existingForChecksum?.id != null && existingForChecksum.id !== existingForHost?.id) {
    await moveHostnameBetweenAssets(existingForHost?.id ?? -1, existingForChecksum.id, hostname)
    await setCachedObjectUrlForHost(hostname, existingForChecksum.blob)
    return
  }

  const hostnameAliases = getHostnameCandidates(hostname)

  if (existingForHost?.id != null) {
    const hostnames = Array.from(new Set([...(parseFaviconMeta(existingForHost.meta_json)?.hostnames ?? []), ...hostnameAliases]))
    await db.assets.update(existingForHost.id, {
      checksum,
      blob: faviconBlob,
      width: normalized.width,
      height: normalized.height,
      meta_json: makeFaviconMeta(hostnames),
    })
  } else if (existingForChecksum?.id != null) {
    const hostnames = parseFaviconMeta(existingForChecksum.meta_json)?.hostnames ?? []
    await db.assets.update(existingForChecksum.id, {
      width: normalized.width,
      height: normalized.height,
      meta_json: makeFaviconMeta([...hostnames, ...hostnameAliases]),
    })
  } else {
    await db.assets.add({
      kind: 'favicon',
      checksum,
      blob: faviconBlob,
      width: normalized.width,
      height: normalized.height,
      meta_json: makeFaviconMeta(hostnameAliases),
    })
  }

  await setCachedObjectUrlForHost(hostname, faviconBlob)
}

function isFresh(meta: FaviconMeta | null) {
  return !!meta && (Date.now() - meta.fetched_at) < FAVICON_TTL_MS
}

function getHostnameFromUrl(url: string | null | undefined): string | null {
  return getFaviconHostnameCandidatesForUrl(url)[0] ?? null
}

async function ensureFaviconForHost(hostname: string) {
  const pending = pendingByHost.get(hostname)
  if (pending) return pending

  const run = (async () => {
    const existing = await findFaviconAssetByHostname(hostname)
    const meta = parseFaviconMeta(existing?.meta_json)

    if (existing?.blob) {
      await setCachedObjectUrlForHost(hostname, existing.blob)
      if (isFresh(meta)) return
    }

    await refreshFaviconForHost(hostname)
  })().finally(() => {
    pendingByHost.delete(hostname)
  })

  pendingByHost.set(hostname, run)
  return run
}

export async function ensureFaviconAssetIdForUrl(url: string | null | undefined): Promise<number | null> {
  const hostname = getHostnameFromUrl(url)
  if (!hostname) return null

  await ensureFaviconForHost(hostname)
  const asset = await findFaviconAssetByHostname(hostname)
  return asset?.id ?? null
}

export async function refreshStaleFavicons(): Promise<number> {
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
      // Keep stale favicon blob in place on refresh failure so references stay intact.
    }
  }

  return refreshed
}

export function shouldFetchFavicon(url: string | null | undefined): boolean {
  return getHostnameFromUrl(url) !== null
}

export function getFaviconUrl(url: string | null | undefined): string {
  faviconVersion.value
  const hostname = getHostnameFromUrl(url)
  if (!hostname) return fallbackFaviconUrl

  const alias = aliasByHost.get(hostname)
  const cached = objectUrlByHost.get(hostname) ?? (alias ? objectUrlByHost.get(alias) : undefined)
  if (cached) return cached

  void ensureFaviconForHost(hostname)
  return fallbackFaviconUrl
}

export function getFallbackFaviconUrl(): string {
  return fallbackFaviconUrl
}

export function useFavicon() {
  return {
    shouldFetchFavicon,
    getFaviconUrl,
    getFallbackFaviconUrl,
    ensureFaviconForHost,
    ensureFaviconAssetIdForUrl,
    refreshStaleFavicons,
  }
}
