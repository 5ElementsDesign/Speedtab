import 'fake-indexeddb/auto'

import { db } from '@/db/db'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/composables/useAsset', () => ({
  sha256hex: async (blob: Blob) => `hash-${blob.size}`,
}))

import { ensureFaviconAssetIdForUrl, getFallbackFaviconUrl, refreshStaleFavicons, shouldFetchFavicon } from './useFavicon'

function fakePng(bytes: number[]) {
  return new Blob([new Uint8Array(bytes)], { type: 'image/png' })
}

describe('useFavicon', () => {
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL
  const originalFetch = globalThis.fetch
  const originalCreateImageBitmap = globalThis.createImageBitmap

  beforeEach(async () => {
    URL.createObjectURL = vi.fn(() => 'blob:test-favicon')
    URL.revokeObjectURL = vi.fn()
    globalThis.fetch = vi.fn()
    globalThis.createImageBitmap = undefined as never

    await db.open()
    await db.assets.clear()
  })

  afterEach(async () => {
    await db.delete()
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    globalThis.fetch = originalFetch
    globalThis.createImageBitmap = originalCreateImageBitmap
  })

  it('reuses one favicon asset when two hosts return the same blob', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      blob: async () => fakePng([1, 2, 3, 4]),
    } as Response)

    const firstAssetId = await ensureFaviconAssetIdForUrl('https://alpha.example.test')
    const secondAssetId = await ensureFaviconAssetIdForUrl('https://beta.example.test')

    expect(firstAssetId).toBeTruthy()
    expect(secondAssetId).toBe(firstAssetId)

    const assets = await db.assets.where('kind').equals('favicon').toArray()
    expect(assets).toHaveLength(1)
    expect(JSON.parse(assets[0].meta_json ?? '{}').hostnames.sort()).toEqual([
      'alpha.example.test',
      'beta.example.test',
    ])
  })

  it('does not persist the parent hostname when a subdomain favicon exists directly', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/gemini.google.com.ico')) {
        return {
          ok: true,
          blob: async () => fakePng([5, 5, 5]),
        } as Response
      }
      if (url.includes('/google.com.ico')) {
        return {
          ok: true,
          blob: async () => fakePng([9, 9, 9, 9]),
        } as Response
      }
      return { ok: false } as Response
    })

    const geminiAssetId = await ensureFaviconAssetIdForUrl('https://gemini.google.com/')
    expect(geminiAssetId).toBeTruthy()

    const assetsAfterGemini = await db.assets.where('kind').equals('favicon').toArray()
    expect(assetsAfterGemini).toHaveLength(1)
    expect(JSON.parse(assetsAfterGemini[0].meta_json ?? '{}').hostnames).toEqual(['gemini.google.com'])

    const googleAssetId = await ensureFaviconAssetIdForUrl('https://google.com/')
    expect(googleAssetId).toBeTruthy()
    expect(googleAssetId).not.toBe(geminiAssetId)

    const assets = await db.assets.where('kind').equals('favicon').toArray()
    expect(assets).toHaveLength(2)
    expect(assets.map((asset) => JSON.parse(asset.meta_json ?? '{}').hostnames).sort()).toEqual([
      ['gemini.google.com'],
      ['google.com'],
    ])
  })

  it('still fetches the exact subdomain favicon when a fresh parent-domain fallback already exists', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/gemini.google.com.ico')) {
        return {
          ok: true,
          blob: async () => fakePng([5, 5, 5]),
        } as Response
      }
      if (url.includes('/google.com.ico')) {
        return {
          ok: true,
          blob: async () => fakePng([9, 9, 9, 9]),
        } as Response
      }
      return { ok: false } as Response
    })

    const googleAssetId = await ensureFaviconAssetIdForUrl('https://google.com/')
    expect(googleAssetId).toBeTruthy()

    const geminiAssetId = await ensureFaviconAssetIdForUrl('https://gemini.google.com/')
    expect(geminiAssetId).toBeTruthy()
    expect(geminiAssetId).not.toBe(googleAssetId)

    const assets = await db.assets.where('kind').equals('favicon').toArray()
    expect(assets).toHaveLength(2)
    expect(assets.map((asset) => JSON.parse(asset.meta_json ?? '{}').hostnames).sort()).toEqual([
      ['gemini.google.com'],
      ['google.com'],
    ])
    expect(vi.mocked(globalThis.fetch).mock.calls.map((call) => String(call[0]))).toEqual(
      expect.arrayContaining([expect.stringContaining('/gemini.google.com.ico')]),
    )
  })

  it('refreshes a stale favicon asset in place', async () => {
    const assetId = await db.assets.add({
      kind: 'favicon',
      checksum: 'old-checksum',
      blob: fakePng([1, 1, 1]),
      width: 32,
      height: 32,
      meta_json: JSON.stringify({
        hostnames: ['refresh.example.test'],
        fetched_at: Date.now() - (91 * 24 * 60 * 60 * 1000),
      }),
    }) as number

    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      blob: async () => fakePng([2, 2, 2, 2]),
    } as Response)

    const refreshed = await refreshStaleFavicons()

    expect(refreshed).toBe(1)

    const assets = await db.assets.where('kind').equals('favicon').toArray()
    expect(assets).toHaveLength(1)
    expect(assets[0].id).toBe(assetId)
    expect(assets[0].checksum).not.toBe('old-checksum')
    expect(JSON.parse(assets[0].meta_json ?? '{}').hostnames).toContain('refresh.example.test')
  })

  it('falls back from a subdomain hostname to the parent domain favicon', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/rss.cnn.com.ico')) {
        return { ok: false } as Response
      }
      if (url.includes('/cnn.com.ico')) {
        return {
          ok: true,
          blob: async () => fakePng([7, 7, 7, 7]),
        } as Response
      }
      return { ok: false } as Response
    })

    const assetId = await ensureFaviconAssetIdForUrl('https://rss.cnn.com/rss/edition.rss')

    expect(assetId).toBeTruthy()
    expect(vi.mocked(globalThis.fetch).mock.calls.map((call) => String(call[0]))).toEqual([
      expect.stringContaining('/rss.cnn.com.ico'),
      expect.stringContaining('/cnn.com.ico'),
    ])

    const assets = await db.assets.where('kind').equals('favicon').toArray()
    expect(assets).toHaveLength(1)
    expect(JSON.parse(assets[0].meta_json ?? '{}').hostnames.sort()).toEqual([
      'cnn.com',
      'rss.cnn.com',
    ])
  })

  it('skips excluded hosts and invalid urls', () => {
    expect(shouldFetchFavicon('https://example.com')).toBe(false)
    expect(shouldFetchFavicon('http://localhost:3000')).toBe(false)
    expect(shouldFetchFavicon('https://app.dev.loc/dashboard')).toBe(false)
    expect(shouldFetchFavicon('not-a-url')).toBe(false)
    expect(shouldFetchFavicon('https://real.example.test')).toBe(true)
    expect(getFallbackFaviconUrl()).toBeTruthy()
  })
})
