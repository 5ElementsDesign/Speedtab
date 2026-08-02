import {db, makeUpdatedAtPatch} from '../../../db/db.ts'
import {markExportDirty} from '../../../composables/useExportState.ts'
import {closeModal, openModal} from '../../components/modal.js'
import {loadAssetObjectUrl} from '../../data/assets.js'
import {createFragment, patchHost} from '../../utils/dom-patch.js'
import {escapeHtml} from '../../utils/html.js'
import {getLocale, t} from '../../utils/i18n.js'
import {fixFaviconAssetBackground, getFaviconHostnameCandidatesForUrl, parseFaviconMeta, refreshStaleFavicons} from '../../utils/favicon.js'
import {releaseBackgroundAssetUrl} from '../../utils/workspace-background.js'

const ORDERED_KINDS = ['background', 'preview', 'speed_dial', 'note_image', 'favicon']
const PREVIEW_KINDS = new Set(['preview', 'speed_dial'])
const NOTE_IMAGE_TOKEN_RE = /{{asset:image:(\d+)}}/g

const state = {
  selectedAssetId: null,
  refreshStatus: '',
  previewUrls: new Map(),
  data: null,
}

function formatAssetBrowserError(error) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error.trim()) return error
  if (error && typeof error === 'object') {
    if (typeof error.message === 'string' && error.message.trim()) return error.message
    try {
      return JSON.stringify(error)
    } catch {
      return String(error)
    }
  }
  return String(error)
}

function revokePreviewUrls() {
  for (const url of state.previewUrls.values()) {
    URL.revokeObjectURL(url)
  }
  state.previewUrls.clear()
}

function extractLinkNoteUrls(content = '') {
  return String(content)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      if (line === '[hr]' || line.toLowerCase() === '<hr>') return []
      try {
        const url = new URL(line)
        return url.protocol === 'http:' || url.protocol === 'https:' ? [url.toString()] : []
      } catch {
        return []
      }
    })
}

function remapNoteImageTokens(content, remap) {
  return String(content ?? '').replace(NOTE_IMAGE_TOKEN_RE, (_match, assetIdRaw) => {
    const nextId = remap(Number(assetIdRaw))
    return nextId != null ? `{{asset:image:${nextId}}}` : ''
  })
}

function formatByteCount(size = 0) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function formatBytes(blob) {
  return formatByteCount(blob?.size ?? 0)
}

function formatMeta(metaJson) {
  if (!metaJson) return ''
  try {
    return JSON.stringify(JSON.parse(metaJson), null, 2)
  } catch {
    return String(metaJson)
  }
}

function kindLabel(kind) {
  switch (kind) {
    case 'background': return t('assets.kindLabels.background')
    case 'preview': return t('assets.kindLabels.preview')
    case 'speed_dial': return t('assets.kindLabels.speedDial')
    case 'note_image': return t('assets.kindLabels.noteImage')
    case 'favicon': return t('assets.kindLabels.favicon')
    default: return kind
  }
}

function previewFrameClass(kind) {
  if (kind === 'favicon') return 'is-favicon'
  if (PREVIEW_KINDS.has(kind)) return 'is-preview'
  return 'is-generic'
}

function previewImageClass(kind) {
  if (kind === 'favicon') return 'is-favicon'
  if (PREVIEW_KINDS.has(kind)) return 'is-preview'
  return 'is-generic'
}

function previewSurfaceClass(kind) {
  return kind === 'favicon' ? 'is-favicon' : ''
}

async function loadAssetBrowserData() {
  const [assets, tabs, notes, pages, feedSources, feedItems, appSettings] = await Promise.all([
    db.assets.toArray(),
    db.tabs.toArray(),
    db.notes.toArray(),
    db.pages.toArray(),
    db.feed_sources.toArray(),
    db.feed_items.toArray(),
    db.app_settings.toArray(),
  ])

  revokePreviewUrls()
  for (const asset of assets) {
    if (asset?.id == null) continue
    const url = await loadAssetObjectUrl(asset.id)
    if (url) state.previewUrls.set(asset.id, url)
  }

  return {assets, tabs, notes, pages, feedSources, feedItems, appSettings}
}

function getReferenceSummary(assetId, data) {
  const counts = {
    backgrounds: 0,
    bookmarkFavicons: 0,
    bookmarkPreviews: 0,
    speedDialImages: 0,
    feedFavicons: 0,
    noteLinkFavicons: 0,
    noteImages: 0,
  }

  const selected = data.assets.find((asset) => asset.id === assetId) ?? null
  const faviconHosts = selected?.kind === 'favicon'
    ? new Set(parseFaviconMeta(selected.meta_json)?.hostnames ?? [])
    : null

  for (const page of data.pages) {
    if (!page.config_json) continue
    try {
      const parsed = JSON.parse(page.config_json)
      if (parsed.background_asset_id === assetId) counts.backgrounds += 1
    } catch {
      // Ignore malformed page config.
    }
  }

  for (const setting of data.appSettings) {
    try {
      const parsed = JSON.parse(setting.value_json ?? 'null')
      if (setting.key === 'background_asset_id' && parsed === assetId) {
        counts.backgrounds += 1
        continue
      }
      if (parsed && typeof parsed === 'object' && parsed.background_asset_id === assetId) {
        counts.backgrounds += 1
      }
    } catch {
      // Ignore malformed setting payload.
    }
  }

  for (const tab of data.tabs) {
    if (tab.favicon_asset_id === assetId) {
      counts.bookmarkFavicons += 1
    } else if (faviconHosts) {
      const candidates = getFaviconHostnameCandidatesForUrl(tab.url)
      if (candidates.some((candidate) => faviconHosts.has(candidate))) {
        counts.bookmarkFavicons += 1
      }
    }

    if (tab.preview_asset_id === assetId) {
      if (selected?.kind === 'speed_dial') counts.speedDialImages += 1
      else counts.bookmarkPreviews += 1
    }
  }

  if (faviconHosts) {
    for (const note of data.notes) {
      if (note.type !== 'links') continue
      for (const url of extractLinkNoteUrls(note.content)) {
        const candidates = getFaviconHostnameCandidatesForUrl(url)
        if (candidates.some((candidate) => faviconHosts.has(candidate))) {
          counts.noteLinkFavicons += 1
        }
      }
    }

    for (const source of data.feedSources) {
      const candidates = getFaviconHostnameCandidatesForUrl(source.site_url || source.feed_url)
      if (candidates.some((candidate) => faviconHosts.has(candidate))) {
        counts.feedFavicons += 1
      }
    }

    for (const item of data.feedItems) {
      const candidates = getFaviconHostnameCandidatesForUrl(item.url)
      if (candidates.some((candidate) => faviconHosts.has(candidate))) {
        counts.feedFavicons += 1
      }
    }
  }

  for (const note of data.notes) {
    if (note.type !== 'html') continue
    if (String(note.content ?? '').includes(`{{asset:image:${assetId}}}`)) counts.noteImages += 1
  }

  return counts
}

function renderAssetButton(asset, kind) {
  const objectUrl = state.previewUrls.get(asset.id) ?? ''
  return `
    <button
      type="button"
      data-click="selectAssetBrowserAsset"
      data-asset-id="${escapeHtml(String(asset.id))}"
      data-asset-browser-tile
      ${state.selectedAssetId === asset.id ? 'data-selected' : ''}
    >
      <div data-asset-browser-preview class="${previewFrameClass(kind)} ${previewSurfaceClass(kind)}">
        ${objectUrl ? `<img src="${escapeHtml(objectUrl)}" alt="${escapeHtml(kindLabel(kind))}" class="${previewImageClass(kind)}">` : ''}
      </div>
      ${kind !== 'favicon'
        ? `<span data-asset-browser-size>${escapeHtml(formatBytes(asset.blob))}</span>`
        : ''}
    </button>
  `
}

function renderAssetGroup(kind, items) {
  return `
    <section data-asset-browser-group>
      <div data-asset-browser-group-head>
        <h3 data-asset-browser-group-title>${escapeHtml(kindLabel(kind))}</h3>
        <div data-asset-browser-group-meta>
          ${kind === 'favicon'
            ? `<button type="button" class="st-btn" data-btn="ghost" data-click="refreshAssetBrowserFavicons">${escapeHtml(t('assets.refreshStaleFavicons'))}</button>`
            : ''}
          <span>${items.length}</span>
        </div>
      </div>
      ${kind === 'favicon'
        ? `<p data-asset-browser-help>${escapeHtml(t('assets.faviconRefreshHelp'))}</p>`
        : ''}
      ${items.length
        ? `<div data-asset-browser-grid ${kind === 'favicon' ? 'data-compact' : ''}>${items.map((asset) => renderAssetButton(asset, kind)).join('')}</div>`
        : `<p data-asset-browser-empty>${escapeHtml(t('assets.noAssetsInCategory'))}</p>`}
    </section>
  `
}

function renderAssetDetails(selectedAsset, data) {
  if (!selectedAsset?.id) {
    return `<div data-asset-browser-placeholder>${escapeHtml(t('assets.intro'))}</div>`
  }

  const objectUrl = state.previewUrls.get(selectedAsset.id) ?? ''
  const refs = getReferenceSummary(selectedAsset.id, data)
  const meta = formatMeta(selectedAsset.meta_json)

  return `
    <div data-asset-browser-details-card>
      <div data-asset-browser-details-preview class="${selectedAsset.kind === 'favicon' ? 'is-favicon' : ''}">
        ${objectUrl ? `<img src="${escapeHtml(objectUrl)}" alt="${escapeHtml(kindLabel(selectedAsset.kind))}" class="${previewImageClass(selectedAsset.kind)}">` : ''}
      </div>

      <div data-asset-browser-facts>
        <div data-asset-browser-fact><span>${escapeHtml(t('assets.kind'))}</span><strong>${escapeHtml(kindLabel(selectedAsset.kind))}</strong></div>
        <div data-asset-browser-fact><span>${escapeHtml(t('assets.id'))}</span><strong>#${escapeHtml(String(selectedAsset.id))}</strong></div>
        <div data-asset-browser-fact><span>${escapeHtml(t('assets.size'))}</span><strong>${escapeHtml(formatBytes(selectedAsset.blob))}</strong></div>
        <div data-asset-browser-fact><span>${escapeHtml(t('assets.dimensions'))}</span><strong>${selectedAsset.width && selectedAsset.height ? `${selectedAsset.width} × ${selectedAsset.height}` : escapeHtml(t('assets.unknown'))}</strong></div>
      </div>

      <div data-asset-browser-block>
        <div data-asset-browser-block-title>${escapeHtml(t('assets.checksum'))}</div>
        <code>${escapeHtml(selectedAsset.checksum ?? '')}</code>
      </div>

      <div data-asset-browser-block>
        <div data-asset-browser-block-title>${escapeHtml(t('assets.references'))}</div>
        <div data-asset-browser-ref-list>
          <div>${escapeHtml(t('assets.referenceLabels.backgrounds'))}: ${refs.backgrounds}</div>
          <div>${escapeHtml(t('assets.referenceLabels.bookmarkFavicons'))}: ${refs.bookmarkFavicons}</div>
          <div>${escapeHtml(t('assets.referenceLabels.bookmarkPreviews'))}: ${refs.bookmarkPreviews}</div>
          <div>${escapeHtml(t('assets.referenceLabels.speedDialImages'))}: ${refs.speedDialImages}</div>
          <div>${escapeHtml(t('assets.referenceLabels.feedFavicons'))}: ${refs.feedFavicons}</div>
          <div>${escapeHtml(t('assets.referenceLabels.noteLinkFavicons'))}: ${refs.noteLinkFavicons}</div>
          <div>${escapeHtml(t('assets.referenceLabels.noteImages'))}: ${refs.noteImages}</div>
        </div>
      </div>

      ${meta
        ? `<div data-asset-browser-block>
            <div data-asset-browser-block-title>${escapeHtml(t('assets.meta'))}</div>
            <pre>${escapeHtml(meta)}</pre>
          </div>`
        : ''}

      <div data-asset-browser-actions>
        <div data-asset-browser-actions-left>
          <button type="button" class="st-btn" data-btn="danger" data-click="deleteAssetBrowserAsset" data-asset-id="${escapeHtml(String(selectedAsset.id))}">
            ${escapeHtml(t('assets.deleteAsset'))}
          </button>
        </div>
        <div data-asset-browser-actions-right>
          ${selectedAsset.kind === 'favicon' ? `
            <button type="button" class="st-btn" data-btn="ghost" data-click="fixAssetBrowserFaviconBackground" data-asset-id="${escapeHtml(String(selectedAsset.id))}">
              ${escapeHtml(t('assets.fixFaviconBackground'))}
            </button>
          ` : ''}
          <button type="button" class="st-btn" data-modal-close>${escapeHtml(t('common.close'))}</button>
        </div>
      </div>
    </div>
  `
}

function renderAssetBrowserContent(data) {
  const groupedAssets = ORDERED_KINDS.map((kind) => ({
    kind,
    items: data.assets
      .filter((asset) => asset.kind === kind)
      .sort((a, b) => (b.id ?? 0) - (a.id ?? 0)),
  }))
  const totalAssetSize = data.assets.reduce((sum, asset) => sum + (asset.blob?.size ?? 0), 0)

  return `
    <div data-asset-browser>
      <div data-asset-browser-summary>
        <span>${escapeHtml(t('assets.totalSummary', {count: data.assets.length, size: formatByteCount(totalAssetSize)}))}</span>
        ${state.refreshStatus ? `<span data-asset-browser-status>${escapeHtml(state.refreshStatus)}</span>` : ''}
      </div>
      <div data-asset-browser-layout>
        <div data-asset-browser-groups>
          ${groupedAssets.map((group) => renderAssetGroup(group.kind, group.items)).join('')}
        </div>
        <aside data-asset-browser-details>
          <h3 data-asset-browser-details-title>${escapeHtml(t('assets.detailsTitle'))}</h3>
          ${renderAssetDetails(data.assets.find((asset) => asset.id === state.selectedAssetId) ?? null, data)}
        </aside>
      </div>
    </div>
  `
}

function getOpenAssetBrowserPanel() {
  return document.querySelector('[data-modal][data-modal-open] [data-modal-body]')
}

function createAssetBrowserFragment(data) {
  return createFragment(renderAssetBrowserContent(data))
}

function patchAssetBrowserDom(data) {
  const panel = getOpenAssetBrowserPanel()
  const current = panel?.querySelector?.('[data-asset-browser]')
  if (!(panel instanceof HTMLElement) || !(current instanceof HTMLElement)) return false
  return patchHost(current, renderAssetBrowserContent(data)) instanceof HTMLElement
}

async function refreshAssetBrowserDom({full = false} = {}) {
  const data = await loadAssetBrowserData()
  state.data = data

  if (!data.assets.some((asset) => asset.id === state.selectedAssetId)) {
    state.selectedAssetId = data.assets[0]?.id ?? null
  }

  const panel = getOpenAssetBrowserPanel()
  if (!panel || full) return false
  return patchAssetBrowserDom(data)
}

export async function renderAssetBrowserModal() {
  const data = await loadAssetBrowserData()
  state.data = data

  if (!data.assets.find((asset) => asset.id === state.selectedAssetId) && data.assets.length) {
    state.selectedAssetId = data.assets[0].id ?? null
  }

  openModal({
    title: t('assets.title'),
    content: renderAssetBrowserContent(data),
    panelClass: 'st-asset-browser-modal',
    panelStyle: '--st-modal-max-width: 72rem;',
    onClose: () => {
      state.selectedAssetId = null
      state.refreshStatus = ''
      state.data = null
      revokePreviewUrls()
    },
  })
}

export async function openAssetBrowser() {
  await renderAssetBrowserModal()
}

function patchAssetBrowserSelectionDom() {
  const modal = document.querySelector('[data-modal][data-modal-open]')
  const browser = modal?.querySelector?.('[data-asset-browser]')
  const details = browser?.querySelector?.('[data-asset-browser-details]')
  const data = state.data
  if (!browser || !details || !data) return false

  const selectedAsset = data.assets.find((asset) => asset.id === state.selectedAssetId) ?? null

  browser.querySelectorAll('[data-asset-browser-tile][data-selected]').forEach((tile) => {
    tile.removeAttribute('data-selected')
  })

  const selectedTile = browser.querySelector(`[data-asset-browser-tile][data-asset-id="${CSS.escape(String(state.selectedAssetId ?? ''))}"]`)
  if (selectedTile) {
    selectedTile.setAttribute('data-selected', '')
  }

  details.innerHTML = `
    <h3 data-asset-browser-details-title>${escapeHtml(t('assets.detailsTitle'))}</h3>
    ${renderAssetDetails(selectedAsset, data)}
  `

  return true
}

export async function selectAsset(assetId) {
  state.selectedAssetId = Number(assetId) || null
  if (patchAssetBrowserSelectionDom()) return
  await renderAssetBrowserModal()
}

function buildRefreshMessage(count) {
  if (count <= 0) return t('assets.noFaviconsNeeded')
  if (getLocale() === 'de') {
    return `${count} veraltete Favicons aktualisiert.`
  }
  const label = count === 1 ? 'favicon' : 'favicons'
  return `${count} stale ${label} refreshed.`
}

export async function refreshAssetBrowserFaviconSet() {
  const refreshed = await refreshStaleFavicons()
  state.refreshStatus = buildRefreshMessage(refreshed)
  if (await refreshAssetBrowserDom()) return
  await renderAssetBrowserModal()
}

export async function fixAssetBrowserFaviconBackgroundById(assetId) {
  try {
    const fixed = await fixFaviconAssetBackground(assetId)
    state.refreshStatus = fixed
      ? t('assets.fixedFaviconBackground')
      : t('assets.noFaviconFixNeeded')
  } catch (error) {
    console.error('Failed to fix favicon background', error)
    state.refreshStatus = t('assets.fixFaviconBackgroundFailed', {
      message: formatAssetBrowserError(error),
    })
  }

  if (await refreshAssetBrowserDom()) return
  await renderAssetBrowserModal()
}

export async function deleteAssetById(assetId) {
  const id = Number(assetId)
  if (!id) return
  if (!confirm(t('assets.deleteConfirm'))) return

  const now = Date.now()
  const tabs = await db.tabs.toArray()
  const notes = await db.notes.toArray()
  const pages = await db.pages.toArray()
  const appSettings = await db.app_settings.toArray()

  await db.transaction('rw', [db.assets, db.tabs, db.notes, db.pages, db.app_settings], async () => {
    for (const tab of tabs) {
      const patch = {}
      if (tab.favicon_asset_id === id) patch.favicon_asset_id = null
      if (tab.preview_asset_id === id) patch.preview_asset_id = null
      if (Object.keys(patch).length) {
        await db.tabs.update(tab.id, {...patch, ...makeUpdatedAtPatch(now)})
      }
    }

    for (const note of notes) {
      if (note.type !== 'html') continue
      const nextContent = remapNoteImageTokens(note.content, (value) => (value === id ? null : value))
      if (nextContent !== note.content) {
        await db.notes.update(note.id, {content: nextContent, ...makeUpdatedAtPatch(now)})
      }
    }

    for (const page of pages) {
      if (!page.config_json) continue
      try {
        const parsed = JSON.parse(page.config_json)
        if (parsed.background_asset_id !== id) continue
        await db.pages.update(page.id, {
          config_json: JSON.stringify({...parsed, background_asset_id: null}),
          ...makeUpdatedAtPatch(now),
        })
      } catch {
        // Ignore malformed page config.
      }
    }

    for (const setting of appSettings) {
      try {
        const parsed = JSON.parse(setting.value_json ?? 'null')
        if (setting.key === 'background_asset_id' && parsed === id) {
          await db.app_settings.update(setting.key, {
            value_json: JSON.stringify(null),
            updated_at: now,
          })
          continue
        }
        if (parsed && typeof parsed === 'object' && parsed.background_asset_id === id) {
          await db.app_settings.update(setting.key, {
            value_json: JSON.stringify({...parsed, background_asset_id: null}),
            updated_at: now,
          })
        }
      } catch {
        // Ignore malformed app setting payload.
      }
    }

    await db.assets.delete(id)
  })
  releaseBackgroundAssetUrl(id)

  await markExportDirty('assets:delete')
  state.selectedAssetId = null
  if (await refreshAssetBrowserDom()) return
  await renderAssetBrowserModal()
}

export function closeAssetBrowser() {
  closeModal()
}
