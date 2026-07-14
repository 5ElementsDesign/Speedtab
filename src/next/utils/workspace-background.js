import defaultWallpaperUrl from '../../assets/wallpaper-y-tree.webp'
import {loadAppSettings} from '../data/app-settings.js'
import {loadAssetObjectUrl} from '../data/assets.js'

export async function loadWorkspaceBackgroundStyle() {
  const appSettings = await loadAppSettings()

  if (appSettings.background_asset_id) {
    const objUrl = await loadAssetObjectUrl(appSettings.background_asset_id)
    if (objUrl) return `url('${objUrl}') center/cover no-repeat`
  }

  if (appSettings.background_properties) {
    return appSettings.background_properties
  }

  return `url('${defaultWallpaperUrl}') center/cover no-repeat`
}

export async function applyWorkspaceBackground(target) {
  const root = target instanceof HTMLElement ? target : null
  const background = await loadWorkspaceBackgroundStyle()

  document.documentElement.style.background = background
  document.body.style.background = background
  document.body.style.backgroundAttachment = 'fixed'

  if (root) {
    root.style.background = background
    root.style.backgroundAttachment = 'fixed'
  }

  return background
}
