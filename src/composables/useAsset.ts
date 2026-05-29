import { db } from '@/db/db'
import type { AssetKind } from '@/types/db'

// ─── Tile dimensions ──────────────────────────────────────────────────────────
export const TILE_W = 98
export const TILE_H = 56

// ─── SHA-256 ──────────────────────────────────────────────────────────────────

/**
 * Compute a hex-encoded SHA-256 digest of a Blob using WebCrypto.
 * Available in Chrome extension context and Node.js 18+ (Vitest/jsdom).
 */
export async function sha256hex(blob: Blob): Promise<string> {
  const buffer      = await blob.arrayBuffer()
  const hashBuffer  = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray   = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─── Asset storage ────────────────────────────────────────────────────────────

/**
 * Store a blob in the assets table, deduplicating by SHA-256 checksum.
 * Returns the asset id (existing or newly created).
 */
export async function storeOrGetAsset(
  blob:     Blob,
  kind:     AssetKind,
  width:    number | null,
  height:   number | null,
  metaJson: string | null = null,
): Promise<number> {
  const checksum = await sha256hex(blob)

  // Dedup: return existing asset id if we already have this exact blob
  const existing = await db.assets.where('checksum').equals(checksum).first()
  if (existing?.id) return existing.id

  const id = await db.assets.add({ kind, checksum, blob, width, height, meta_json: metaJson })
  return id as number
}

/**
 * Retrieve an asset blob from IndexedDB and return an Object URL.
 * IMPORTANT: caller must call URL.revokeObjectURL() when the element is
 * unmounted or the URL is no longer needed.
 */
export async function loadAssetObjectUrl(assetId: number | null): Promise<string | null> {
  if (!assetId) return null
  const asset = await db.assets.get(assetId)
  if (!asset?.blob) return null
  return URL.createObjectURL(asset.blob)
}

// ─── Canvas → WebP ────────────────────────────────────────────────────────────

/**
 * Export a canvas as a WebP Blob.
 * At 98×56 pixels, keep previews crisp rather than aggressively compressed.
 */
export function canvasToWebpBlob(
  canvas:  HTMLCanvasElement,
  quality: number = 0.98,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => { if (blob) resolve(blob); else reject(new Error('canvas.toBlob returned null')) },
      'image/webp',
      quality,
    )
  })
}
