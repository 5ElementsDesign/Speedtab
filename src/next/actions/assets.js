import {deleteAssetById, openAssetBrowser, refreshAssetBrowserFaviconSet, selectAsset} from '../features/assets/browser.js'

export const assetActions = {
  async openAssetBrowser() {
    await openAssetBrowser()
  },

  async selectAssetBrowserAsset(target) {
    await selectAsset(target?.dataset?.assetId)
  },

  async refreshAssetBrowserFavicons() {
    await refreshAssetBrowserFaviconSet()
  },

  async deleteAssetBrowserAsset(target) {
    await deleteAssetById(target?.dataset?.assetId)
  },
}
