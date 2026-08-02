import defaultWallpaperUrl from '../../assets/wallpaper-y-tree.webp'
import {getCachedAppSettings, loadAppSettings, loadBgArchive, loadPageBackgroundOverride} from '../data/app-settings.js'
import {loadAssetObjectUrl, loadBgAssets} from '../data/assets.js'

const DEFAULT_BACKGROUND = `url('${defaultWallpaperUrl}') center/cover no-repeat fixed`
const BACKGROUND_TRANSITION_MS = 220
const backgroundAssetUrls = new Map()
const backgroundAssetDecodes = new Map()
let activeBackgroundLayer = 'a'
let backgroundTransitionUntil = 0
let backgroundTransitionRevision = 0
let pageBackgroundRequestRevision = 0
let currentWorkspaceBackground = ''

export function sanitizeBackgroundValue(raw) {
  return (raw ?? '')
    .trim()
    .replace(/^background-image\s*:\s*/i, '')
    .replace(/^background\s*:\s*/i, '')
    .replace(/;$/, '')
    .trim()
}

export function isValidBackground(value) {
  if (!value) return true
  return CSS.supports('background', value) || CSS.supports('background-image', value)
}

function toBackgroundColorValue(raw) {
  const value = sanitizeBackgroundValue(raw)
  if (!value) return ''
  if (/^#[0-9a-fA-F]{6,8}$/.test(value)) return value
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const [, r, g, b] = value
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return ''
}

export function syncBackgroundInputs(scope, value, source = null) {
  const root = scope instanceof Element ? scope : document
  const normalizedValue = sanitizeBackgroundValue(value)
  const colorValue = toBackgroundColorValue(normalizedValue)
  const textInput = root.querySelector('[data-bg-property-input]')
  const colorInput = root.querySelector('[data-bg-color-input]')

  if (textInput && textInput !== source) textInput.value = normalizedValue
  if (colorInput && colorInput !== source) {
    colorInput.value = colorValue
    const clrField = colorInput.closest('.clr-field')
    if (clrField) clrField.style.color = colorValue || ''
  }
}

async function getBackgroundAssetUrl(assetId) {
  if (!assetId) return null
  if (!backgroundAssetUrls.has(assetId)) {
    const objectUrl = await loadAssetObjectUrl(assetId)
    if (objectUrl) backgroundAssetUrls.set(assetId, objectUrl)
  }
  return backgroundAssetUrls.get(assetId) ?? null
}

export function releaseBackgroundAssetUrl(assetId) {
  const id = Number(assetId)
  const objectUrl = backgroundAssetUrls.get(id)
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  backgroundAssetUrls.delete(id)
  backgroundAssetDecodes.delete(id)
}

async function decodeBackgroundAsset(assetId, objectUrl) {
  if (!assetId || !objectUrl || typeof Image !== 'function') return
  if (!backgroundAssetDecodes.has(assetId)) {
    const decode = (async () => {
      const image = new Image()
      image.src = objectUrl
      if (typeof image.decode === 'function') {
        await image.decode().catch(() => {})
      }
    })()
    backgroundAssetDecodes.set(assetId, decode)
  }
  await backgroundAssetDecodes.get(assetId)
}

function shouldRemoveBackground(appSettings = getCachedAppSettings()) {
  return appSettings?.background_properties === 'none' && !appSettings?.background_asset_id
}

export function hasBgSet(appSettings = getCachedAppSettings()) {
  return !shouldRemoveBackground(appSettings)
}

export async function getBgSet(appSettings = null) {
  const settings = appSettings ?? await loadAppSettings()

  if (shouldRemoveBackground(settings)) {
    return 'none'
  }

  if (settings.background_asset_id) {
    const objUrl = await getBackgroundAssetUrl(settings.background_asset_id)
    if (objUrl) {
      await decodeBackgroundAsset(settings.background_asset_id, objUrl)
      return `url('${objUrl}') center/cover no-repeat`
    }
  }

  if (settings.background_properties) {
    return settings.background_properties
  }

  return DEFAULT_BACKGROUND
}

export async function loadWorkspaceBackgroundStyle() {
  return getBgSet()
}

export async function loadBackgroundEditorData(backgroundSettings = null) {
  const [settings, bgArchive, bgAssets] = await Promise.all([
    backgroundSettings ?? loadAppSettings(),
    loadBgArchive(),
    loadBackgroundAssetsForEditor(),
  ])
  return {
    ...settings,
    background_properties: settings?.background_properties ?? '',
    background_asset_id: settings?.background_asset_id ?? null,
    bgArchive,
    bgAssets,
  }
}

export async function loadBackgroundAssetsForEditor() {
  const assets = await loadBgAssets()
  return Promise.all(assets.map(async (asset) => ({
    ...asset,
    _objectUrl: await loadAssetObjectUrl(asset.id) ?? '',
  })))
}

function setBackgroundLayer(layer, background) {
  document.body.style.setProperty(`--st-workspace-background-${layer}`, background || 'none')
}

function setWorkspaceBackground(background) {
  const nextBackground = background || 'none'
  backgroundTransitionRevision++
  activeBackgroundLayer = 'a'
  backgroundTransitionUntil = 0
  document.body.style.setProperty('--st-workspace-background', nextBackground)
  setBackgroundLayer('a', nextBackground)
  setBackgroundLayer('b', nextBackground)
  document.body.dataset.workspaceBackgroundLayer = 'a'
  currentWorkspaceBackground = nextBackground
}

export async function transitionWorkspaceBackground(background) {
  const nextBackground = background || 'none'
  const revision = ++backgroundTransitionRevision
  if (nextBackground === currentWorkspaceBackground) return
  const waitMs = Math.max(0, backgroundTransitionUntil - performance.now())
  if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs))
  if (revision !== backgroundTransitionRevision) return

  const nextLayer = activeBackgroundLayer === 'a' ? 'b' : 'a'
  setBackgroundLayer(nextLayer, nextBackground)

  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  if (revision !== backgroundTransitionRevision) return

  document.body.style.setProperty('--st-workspace-background', nextBackground)
  document.body.dataset.workspaceBackgroundLayer = nextLayer
  activeBackgroundLayer = nextLayer
  backgroundTransitionUntil = performance.now() + BACKGROUND_TRANSITION_MS
  currentWorkspaceBackground = nextBackground
}

export async function getPageBackgroundSet(pageSyncId, appSettings = null) {
  const override = await loadPageBackgroundOverride(pageSyncId)
  if (override?.background_asset_id) {
    const objectUrl = await getBackgroundAssetUrl(override.background_asset_id)
    if (objectUrl) {
      await decodeBackgroundAsset(override.background_asset_id, objectUrl)
      return `url('${objectUrl}') center/cover no-repeat`
    }
  }
  if (override?.background_properties) return getBgSet(override)
  return getBgSet(appSettings ?? getCachedAppSettings())
}

export async function applyPageWorkspaceBackground(pageSyncId, appSettings = null, {immediate = false} = {}) {
  const revision = ++pageBackgroundRequestRevision
  const background = await getPageBackgroundSet(pageSyncId, appSettings)
  if (revision !== pageBackgroundRequestRevision) return null
  if (immediate) {
    setWorkspaceBackground(background)
  } else {
    await transitionWorkspaceBackground(background)
  }
  return background
}

export function addBgSet(background) {
  pageBackgroundRequestRevision++
  setWorkspaceBackground(!background || background === 'none' ? 'none' : background)
}

export function removeBgSet() {
  pageBackgroundRequestRevision++
  setWorkspaceBackground('none')
}

export async function applyWorkspaceBackground(target, appSettings = null) {
  const root = target instanceof HTMLElement ? target : null
  const background = await getBgSet(appSettings)

  document.documentElement.style.background = ''
  document.documentElement.style.backgroundAttachment = ''
  if (background === 'none') {
    removeBgSet()
  } else {
    addBgSet(background)
  }

  if (root) {
    root.style.background = ''
    root.style.backgroundAttachment = ''
  }

  return background
}
