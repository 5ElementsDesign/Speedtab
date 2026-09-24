import {loadAssetObjectUrl, loadAssetsByKinds, storeOrGetAsset} from '../../data/assets.js'
import {ensureFaviconAssetIdForUrl, initFavicons, normalizeStoredFaviconBlob} from '../../utils/favicon.js'
import {getFeedFaviconSourceUrl} from './feed-form.js'

function revokeObjectUrl(url) {
  if (url) URL.revokeObjectURL(url)
}

export async function hydrateFeedSelectedFavicon(state) {
  revokeObjectUrl(state.selectedFaviconAssetUrl)
  state.selectedFaviconAssetUrl = await loadAssetObjectUrl(state.selectedFaviconAssetId)
}

export async function hydrateFeedFaviconAssets(state) {
  state.faviconAssets.forEach((asset) => revokeObjectUrl(asset.objectUrl))
  state.faviconAssets = (await loadAssetsByKinds(['favicon']))
    .filter((asset) => asset.id != null)
    .map((asset) => ({...asset, objectUrl: URL.createObjectURL(asset.blob)}))
}

export async function ensureFeedFaviconAsset(state) {
  if (!state?.selectedFaviconAssetId) {
    const sourceUrl = getFeedFaviconSourceUrl(state)
    if (sourceUrl) state.selectedFaviconAssetId = await ensureFaviconAssetIdForUrl(sourceUrl)
  }
  await hydrateFeedSelectedFavicon(state)
  return state.selectedFaviconAssetId
}

export async function uploadFeedFaviconAsset(state, file) {
  const normalized = await normalizeStoredFaviconBlob(file)
  state.selectedFaviconAssetId = await storeOrGetAsset(normalized.blob, 'favicon', normalized.width, normalized.height)
  state.isFaviconPickerOpen = false
  await hydrateFeedSelectedFavicon(state)
}

export async function selectFeedFaviconAssetById(state, assetId) {
  state.selectedFaviconAssetId = Number(assetId)
  state.isFaviconPickerOpen = false
  await hydrateFeedSelectedFavicon(state)
}

export function initFeedFormFavicons(container) {
  if (container instanceof HTMLElement) initFavicons(container)
}
