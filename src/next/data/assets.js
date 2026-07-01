import {db} from '../../db/db.ts'

export const TILE_W = 106
export const TILE_H = 60

export async function sha256hex(blob) {
  const buffer     = await blob.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function storeOrGetAsset(blob, kind, width, height, metaJson = null) {
  const checksum = await sha256hex(blob)
  const existing = await db.assets.where('checksum').equals(checksum).first()
  if (existing?.id != null) return existing.id
  return await db.assets.add({kind, checksum, blob, width, height, meta_json: metaJson})
}

export async function loadAssetObjectUrl(assetId) {
  if (!assetId) return null
  const asset = await db.assets.get(assetId)
  if (!asset?.blob) return null
  return URL.createObjectURL(asset.blob)
}

export async function loadAssetById(assetId) {
  if (!assetId) return null
  return db.assets.get(assetId)
}

export async function loadAssetsByKinds(kinds = []) {
  if (!kinds.length) return []
  return db.assets.where('kind').anyOf(kinds).toArray()
}

export async function loadBgAssets() {
  return db.assets.where('kind').equals('background').toArray()
}

export async function deleteBgAsset(id) {
  await db.assets.delete(Number(id))
}

export async function normalizeImageBlob(blob, maxDimension = 2560) {
  if (typeof createImageBitmap !== 'function') return {blob, width: null, height: null}
  try {
    const bitmap = await createImageBitmap(blob)
    const {width, height} = bitmap
    if (width <= maxDimension && height <= maxDimension) {
      bitmap.close()
      return {blob, width, height}
    }
    const scale = Math.min(maxDimension / width, maxDimension / height)
    const tw = Math.max(1, Math.round(width * scale))
    const th = Math.max(1, Math.round(height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = tw
    canvas.height = th
    const ctx = canvas.getContext('2d')
    if (!ctx) { bitmap.close(); return {blob, width, height} }
    ctx.drawImage(bitmap, 0, 0, tw, th)
    bitmap.close()
    const normalized = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.9))
    return {blob: normalized ?? blob, width: tw, height: th}
  } catch {
    return {blob, width: null, height: null}
  }
}

export function canvasToWebpBlob(canvas, quality = 0.97) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('canvas.toBlob returned null'))
    }, 'image/webp', quality)
  })
}
