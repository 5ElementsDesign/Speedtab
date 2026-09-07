import {saveAppSetting} from '../data/app-settings.js'
import {syncPictureInPicture} from './picture-in-picture.js'
import {convertImageBlobToWebp, storeOrGetAsset} from '../data/assets.js'
import {applyDocumentTheme} from '../utils/document-theme.js'
import {applyWorkspaceBackground, getBackgroundValue, isValidBackground} from '../utils/workspace-background.js'

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

export function syncWallspeedActiveWallpaper() {
  const wallspeed = document.querySelector('[data-st-wallspeed]')
  const currentWallpaper = wallspeed?.dataset.currentWallpaper?.trim()
  const style = document.getElementById('highlight-active-wallpaper')
  if (!wallspeed || !currentWallpaper) {
    style?.remove()
    return
  }

  const activeStyle = style ?? document.head.appendChild(document.createElement('style'))
  activeStyle.id = 'highlight-active-wallpaper'
  const selector = `#app [data-st-wallpaper-id="${CSS.escape(currentWallpaper)}"]`
  activeStyle.textContent = `${selector} { box-shadow: 0 0 8px 5px #41b1fd !important; border-color: #41b1fd !important; } ${selector} [data-click="usrCaptureCssAsBg"], ${selector} [data-click="usrCaptureImageAsWallpaper"] { pointer-events: none !important; opacity: .6 !important; background: #333 !important; }`
}

function syncWallspeedBackgroundValue() {
  const wallspeed = document.querySelector('[data-st-wallspeed]')
  if (!wallspeed) return
  wallspeed.setAttribute('data-current-wallpaper', getBackgroundValue())
  syncWallspeedActiveWallpaper()
}

function getCssWallpaperValue(target) {
  const color = target.dataset.bgColor?.trim()
  const image = target.dataset.bgImage?.trim()
  const size = target.dataset.bgSize?.trim()
  if (!image) return color
  return `${color ? `${color} ` : ''}${image}${size ? ` 0 0 / ${size}` : ''}`
}

export const userActions = {
  goToHref(target) {
    try {
      const url = new URL(target.dataset.href)
      if (url.protocol === 'mailto:') {
        window.location.href = url.href
        return
      }
      if (url.protocol === 'http:' || url.protocol === 'https:') window.open(url.href, '_blank', 'noopener,noreferrer')
    } catch {}
  },

  async usrCaptureCssAsBg(target) {
    const background = getCssWallpaperValue(target)
    if (!background || !isValidBackground(background)) return

    await saveAppSetting('background_asset_id', null)
    await saveAppSetting('background_source_url', null)
    await saveAppSetting('background_properties', background)
    await applyWorkspaceBackground()
    syncWallspeedBackgroundValue()
  },

  async usrResetWallpaper() {
    await saveAppSetting('background_asset_id', null)
    await saveAppSetting('background_source_url', null)
    await saveAppSetting('background_properties', null)
    await saveAppSetting('ui_theme', 'dark')
    applyDocumentTheme('dark')
    await applyWorkspaceBackground()
    syncWallspeedBackgroundValue()
  },

  async usrCaptureImageAsWallpaper(target) {
    target?.classList?.add('yai-loading')
    try {
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

      const assetId = await storeOrGetAsset(blob, 'background', width, height)
      await saveAppSetting('background_asset_id', assetId)
      await saveAppSetting('background_source_url', source.url)
      await saveAppSetting('background_properties', null)
      await applyWorkspaceBackground()
      syncWallspeedBackgroundValue()
    } finally {
      target?.classList?.remove('yai-loading')
      syncPictureInPicture()
    }
  },
}
