import { db as defaultDb, type SpeedtabDB } from '@/db/db'
import { sanitizeHtml } from '@/composables/useSanitize'

const NOTE_IMAGE_TOKEN_RE = /{{asset:image:(\d+)}}/g
const NOTE_IMAGE_EXCLUDED_TAGS = new Set(['PRE', 'CODE', 'KBD', 'SAMP'])
const noteImageUrlCache = new Map<number, { objectUrl: string; refs: number; checksum: string | null }>()

export function makeNoteImageToken(assetId: number): string {
  return `{{asset:image:${assetId}}}`
}

function collectAssetIdsFromText(text: string, ids: Set<number>) {
  for (const match of text.matchAll(NOTE_IMAGE_TOKEN_RE)) {
    const assetId = Number(match[1])
    if (Number.isInteger(assetId) && assetId > 0) ids.add(assetId)
  }
}

function isExcludedTextNode(node: Node): boolean {
  let current: Node | null = node.parentNode
  while (current) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const tagName = (current as Element).tagName
      if (NOTE_IMAGE_EXCLUDED_TAGS.has(tagName)) return true
    }
    current = current.parentNode
  }
  return false
}

export function extractNoteImageAssetIds(content: string | null | undefined): number[] {
  if (!content) return []

  if (typeof document !== 'undefined') {
    const template = document.createElement('template')
    template.innerHTML = content
    const ids = new Set<number>()
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node) {
      if (!isExcludedTextNode(node)) {
        collectAssetIdsFromText(node.textContent ?? '', ids)
      }
      node = walker.nextNode()
    }
    return [...ids]
  }

  const ids = new Set<number>()
  collectAssetIdsFromText(content, ids)
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
  const usedAssetIds: number[] = []

  for (const assetId of assetIds) {
    const asset = await database.assets.get(assetId)
    if (!asset?.blob) continue
    const cached = noteImageUrlCache.get(assetId)
    if (cached && cached.checksum === asset.checksum) {
      cached.refs += 1
      urlByAssetId.set(assetId, cached.objectUrl)
      usedAssetIds.push(assetId)
      continue
    }

    if (cached) {
      URL.revokeObjectURL(cached.objectUrl)
      noteImageUrlCache.delete(assetId)
    }

    const objectUrl = URL.createObjectURL(asset.blob)
    noteImageUrlCache.set(assetId, {
      objectUrl,
      refs: 1,
      checksum: asset.checksum ?? null,
    })
    urlByAssetId.set(assetId, objectUrl)
    usedAssetIds.push(assetId)
  }

  if (typeof document === 'undefined') {
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
        for (const assetId of usedAssetIds) {
          const cached = noteImageUrlCache.get(assetId)
          if (!cached) continue
          cached.refs -= 1
          if (cached.refs <= 0) {
            URL.revokeObjectURL(cached.objectUrl)
            noteImageUrlCache.delete(assetId)
          }
        }
      },
    }
  }

  const template = document.createElement('template')
  template.innerHTML = sanitized
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let current = walker.nextNode()
  while (current) {
    if (!isExcludedTextNode(current) && NOTE_IMAGE_TOKEN_RE.test(current.textContent ?? '')) {
      textNodes.push(current as Text)
    }
    NOTE_IMAGE_TOKEN_RE.lastIndex = 0
    current = walker.nextNode()
  }

  for (const textNode of textNodes) {
    const text = textNode.textContent ?? ''
    const fragment = document.createDocumentFragment()
    let lastIndex = 0
    NOTE_IMAGE_TOKEN_RE.lastIndex = 0
    for (const match of text.matchAll(NOTE_IMAGE_TOKEN_RE)) {
      const [raw, assetIdRaw] = match
      const matchIndex = match.index ?? 0
      if (matchIndex > lastIndex) {
        fragment.append(document.createTextNode(text.slice(lastIndex, matchIndex)))
      }
      const assetId = Number(assetIdRaw)
      const objectUrl = urlByAssetId.get(assetId)
      if (!objectUrl) {
        const missing = document.createElement('span')
        missing.className = 'st-note-image-missing'
        missing.textContent = '[missing image]'
        fragment.append(missing)
      } else {
        const image = document.createElement('img')
        image.src = objectUrl
        image.alt = ''
        image.className = 'st-note-image'
        image.loading = 'lazy'
        fragment.append(image)
      }
      lastIndex = matchIndex + raw.length
    }
    if (lastIndex < text.length) {
      fragment.append(document.createTextNode(text.slice(lastIndex)))
    }
    textNode.replaceWith(fragment)
  }

  return {
    html: template.innerHTML,
    revoke: () => {
      for (const assetId of usedAssetIds) {
        const cached = noteImageUrlCache.get(assetId)
        if (!cached) continue
        cached.refs -= 1
        if (cached.refs <= 0) {
          URL.revokeObjectURL(cached.objectUrl)
          noteImageUrlCache.delete(assetId)
        }
      }
    },
  }
}
