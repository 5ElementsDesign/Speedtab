import defaultWallpaperUrl from '../../assets/wallpaper-y-tree.webp'
import {getCachedAppSettings, loadAppSettings} from '../data/app-settings.js'
import {loadAssetObjectUrl} from '../data/assets.js'

const DEFAULT_BACKGROUND = `url('${defaultWallpaperUrl}') center/cover no-repeat fixed`

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
    const objUrl = await loadAssetObjectUrl(settings.background_asset_id)
    if (objUrl) return `url('${objUrl}') center/cover no-repeat`
  }

  if (settings.background_properties) {
    return settings.background_properties
  }

  return DEFAULT_BACKGROUND
}

export async function loadWorkspaceBackgroundStyle() {
  return getBgSet()
}

export function addBgSet(background) {
  if (!background || background === 'none') {
    document.body.style.setProperty('--st-workspace-background', 'none')
    return
  }

  document.body.style.setProperty('--st-workspace-background', background)
}

export function removeBgSet() {
  document.body.style.setProperty('--st-workspace-background', 'none')
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
