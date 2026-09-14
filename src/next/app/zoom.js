const MIN_GRID_ZOOM_FACTOR = 1.5
let zoomSyncRequest = 0

export function shouldCollapseGridForZoom(zoomFactor) {
  return zoomFactor >= MIN_GRID_ZOOM_FACTOR
}

export async function syncZoomGridLayout() {
  const request = ++zoomSyncRequest
  try {
    const tab = await chrome.tabs.getCurrent()
    if (!tab?.id) return false
    const zoomFactor = await chrome.tabs.getZoom(tab.id)
    const isZoomedIn = shouldCollapseGridForZoom(zoomFactor)
    if (request === zoomSyncRequest) document.body.classList.toggle('app-is-zooming-in', isZoomedIn)
    return isZoomedIn
  } catch {
    return false
  }
}
