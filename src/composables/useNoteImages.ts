import { db as defaultDb, type SpeedtabDB } from '@/db/db'
import { sanitizeHtml } from '@/composables/useSanitize'

const NOTE_IMAGE_TOKEN_RE = /{{asset:image:(\d+)}}/g

export function makeNoteImageToken(assetId: number): string {
  return `{{asset:image:${assetId}}}`
}

export function extractNoteImageAssetIds(content: string | null | undefined): number[] {
  if (!content) return []
  const ids = new Set<number>()
  for (const match of content.matchAll(NOTE_IMAGE_TOKEN_RE)) {
    const assetId = Number(match[1])
    if (Number.isInteger(assetId) && assetId > 0) ids.add(assetId)
  }
  return [...ids]
}

export function remapNoteImageTokens(
  content: string,
  remap: (assetId: number) => number | null | undefined,
): string {
  return content.replace(NOTE_IMAGE_TOKEN_RE, (_match, assetIdRaw: string) => {
    const assetId = Number(assetIdRaw)
    const remapped = remap(assetId)
    return remapped != null ? makeNoteImageToken(remapped) : ''
  })
}

export async function renderNoteHtmlWithAssets(
  content: string,
  database: SpeedtabDB = defaultDb,
): Promise<{ html: string; revoke: () => void }> {
  const sanitized = sanitizeHtml(content)
  const assetIds = extractNoteImageAssetIds(sanitized)

  if (!assetIds.length) {
    return { html: sanitized, revoke: () => {} }
  }

  const urlByAssetId = new Map<number, string>()
  const objectUrls: string[] = []

  for (const assetId of assetIds) {
    const asset = await database.assets.get(assetId)
    if (!asset?.blob) continue
    const objectUrl = URL.createObjectURL(asset.blob)
    urlByAssetId.set(assetId, objectUrl)
    objectUrls.push(objectUrl)
  }

  const html = sanitized.replace(NOTE_IMAGE_TOKEN_RE, (_match, assetIdRaw: string) => {
    const assetId = Number(assetIdRaw)
    const objectUrl = urlByAssetId.get(assetId)
    if (!objectUrl) {
      return '<span class="st-note-image-missing">[missing image]</span>'
    }
    return `<img src="${objectUrl}" alt="" class="st-note-image" loading="lazy">`
  })

  return {
    html,
    revoke: () => {
      for (const objectUrl of objectUrls) URL.revokeObjectURL(objectUrl)
    },
  }
}
