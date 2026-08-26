import {saveAppSetting} from '../data/app-settings.js'
import {convertImageBlobToWebp, storeOrGetAsset} from '../data/assets.js'
import {applyWorkspaceBackground, isValidBackground} from '../utils/workspace-background.js'

const WALLPAPER_META_ATTRIBUTES = {
  source_title: 'data-source-title',
  source_origin: 'data-source-origin',
  source_created: 'data-source-created',
  source_category: 'data-source-category',
  source_mood: 'data-source-mood',
}

function readWallpaperSource(target) {
  const item = target.closest?.('[data-wp-item]')
  const image = item?.querySelector?.('img[data-source-url]')
  const rawUrl = image?.getAttribute('data-source-url')?.trim()
  if (!rawUrl) return null

  try {
    const url = new URL(rawUrl, window.location.href)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    return {image, url: url.href}
  } catch {
    return null
  }
}

function getWallpaperMetadata(image, sourceUrl) {
  const metadata = {source_url: sourceUrl}
  Object.entries(WALLPAPER_META_ATTRIBUTES).forEach(([key, attribute]) => {
    const value = image.getAttribute(attribute)?.trim()
    if (value) metadata[key] = value
  })
  return metadata
}

export const userActions = {
  goToHref(target) {
    try {
      const url = new URL(target.dataset.href)
      if (url.protocol === 'http:' || url.protocol === 'https:') window.open(url.href, '_blank', 'noopener,noreferrer')
    } catch {}
  },

  async usrCaptureCssAsBg(target) {
    const background = target.dataset.bgColor?.trim()
    if (!background || !isValidBackground(background)) return

    await saveAppSetting('background_asset_id', null)
    await saveAppSetting('background_properties', background)
    await applyWorkspaceBackground()
  },

  async usrCaptureImageAsWallpaper(target) {
    const source = readWallpaperSource(target)
    if (!source) return

    let response
    try {
      response = await fetch(source.url)
    } catch {
      return
    }
    if (!response.ok) return

    const sourceBlob = await response.blob()
    if (!sourceBlob.size) return

    const {blob, width, height} = await convertImageBlobToWebp(sourceBlob)
    if (!blob?.size || !width || !height) return

    const metadata = getWallpaperMetadata(source.image, source.url)
    const assetId = await storeOrGetAsset(blob, 'background', width, height, JSON.stringify(metadata))
    await saveAppSetting('background_asset_id', assetId)
    await saveAppSetting('background_properties', null)
    await applyWorkspaceBackground()
  },
}
