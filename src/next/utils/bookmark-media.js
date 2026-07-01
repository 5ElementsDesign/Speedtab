import {loadAssetObjectUrl} from '../data/assets.js'
import {loadFaviconImg} from './favicon.js'
import fallbackFaviconUrl from '@/assets/st-favicon.ico'

const assetUrlById = new Map()

function isHiddenByTabState(element) {
  return !!element?.closest?.('[aria-hidden="true"], [inert]')
}

function shouldForceFavicon(img) {
  return !!img?.closest?.('[data-yai-tabs][data-bookmarks-force-favicon]')
}

function isQuicklinksMode(img) {
  return !!img?.closest?.('[data-module-sub-type="quicklinks"], [data-yai-tabs][data-bookmarks-quicklinks]')
}

function getModeDimensions(img, mode) {
  if (mode === 'preview') {
    return isQuicklinksMode(img)
      ? {width: 48, height: 48}
      : {width: 106, height: 60}
  }

  return isQuicklinksMode(img)
    ? {width: 32, height: 32}
    : {width: 36, height: 36}
}

async function ensureAssetUrl(assetId) {
  if (!assetId) return null
  if (assetUrlById.has(assetId)) return assetUrlById.get(assetId)
  const url = await loadAssetObjectUrl(assetId)
  if (url) assetUrlById.set(assetId, url)
  return url
}

function applyMode(img, mode) {
  const {width, height} = getModeDimensions(img, mode)
  img.dataset.mediaKind = mode
  img.width = width
  img.height = height
  if (mode === 'preview') {
    img.style.width = '100%'
    img.style.height = '100%'
    img.style.objectFit = 'cover'
    return
  }

  img.style.width = `${width}px`
  img.style.height = `${height}px`
  img.style.objectFit = 'contain'
}

function syncPreviewDataset(img) {
  const originalPreviewAssetId = img.dataset.previewAssetIdOriginal || ''
  if (!originalPreviewAssetId) {
    delete img.dataset.previewAssetId
    return
  }

  if (shouldForceFavicon(img)) {
    delete img.dataset.previewAssetId
    return
  }

  img.dataset.previewAssetId = originalPreviewAssetId
}

export function getVisibleBookmarkMediaScope(container) {
  if (!(container instanceof Element)) return container ?? null

  const tabsRoot = container.matches?.('[data-yai-tabs]')
    ? container
    : container.querySelector?.('[data-yai-tabs]')

  if (!(tabsRoot instanceof Element)) return container

  const contentRoot = tabsRoot.querySelector(':scope > [data-content]')
  if (!(contentRoot instanceof Element)) return container

  const visiblePanel = contentRoot.querySelector(':scope > [data-tab]:not([aria-hidden="true"]):not([inert])')
  if (visiblePanel instanceof Element) return visiblePanel

  const activeTrigger = tabsRoot.querySelector(':scope > [data-controller] [data-open].active')
    || tabsRoot.querySelector(':scope > [data-controller] [data-inview-default]')
    || tabsRoot.querySelector(':scope > [data-controller] [data-default]')

  const activeId = activeTrigger?.getAttribute?.('data-open')
  if (activeId) {
    const activePanel = contentRoot.querySelector(`:scope > [data-tab="${CSS.escape(activeId)}"]`)
    if (activePanel instanceof Element) return activePanel
  }

  return container
}

function getDesiredMediaKind(img) {
  syncPreviewDataset(img)
  const previewAssetId = Number(img.dataset.previewAssetId || '')
  if (!shouldForceFavicon(img) && previewAssetId) return 'preview'
  return 'favicon'
}

export async function loadBookmarkMediaImg(img, {force = false} = {}) {
  if (!(img instanceof HTMLImageElement)) return
  if (!force && isHiddenByTabState(img)) return
  const desiredKind = getDesiredMediaKind(img)
  if (!force && img.src && img.dataset.mediaKind === desiredKind) {
    applyMode(img, desiredKind)
    return
  }

  const previewAssetId = Number(img.dataset.previewAssetId || '')
  const faviconAssetId = Number(img.dataset.faviconAssetId || '')
  const faviconUrl = img.dataset.faviconUrl || ''
  const forceFavicon = shouldForceFavicon(img)

  if (!forceFavicon && previewAssetId) {
    const previewUrl = await ensureAssetUrl(previewAssetId)
    if (previewUrl && img.isConnected) {
      applyMode(img, 'preview')
      img.src = previewUrl
      return
    }
  }

  if (faviconAssetId) {
    const faviconAssetUrl = await ensureAssetUrl(faviconAssetId)
    if (faviconAssetUrl && img.isConnected) {
      applyMode(img, 'favicon')
      img.src = faviconAssetUrl
      return
    }
  }

  if (faviconUrl) {
    applyMode(img, 'favicon')
    img.removeAttribute('src')
    loadFaviconImg(img)
    if (!img.getAttribute('src')) img.src = fallbackFaviconUrl
    return
  }

  applyMode(img, 'favicon')
  img.src = fallbackFaviconUrl
}

export function initBookmarkMedia(container, options = {}) {
  container.querySelectorAll('img[data-bookmark-media]').forEach((img) => {
    void loadBookmarkMediaImg(img, options)
  })
}
