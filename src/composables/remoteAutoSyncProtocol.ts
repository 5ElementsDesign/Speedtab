export const REMOTE_AUTO_SYNC_REFRESH_MESSAGE = 'REMOTE_AUTO_SYNC_REFRESH'
export const REMOTE_AUTO_SYNC_MARK_DIRTY_MESSAGE = 'REMOTE_AUTO_SYNC_MARK_DIRTY'
export const REMOTE_AUTO_SYNC_CHECK_ALARM = 'speedtab-remote-auto-sync-check'
export const REMOTE_AUTO_SYNC_PUSH_ALARM = 'speedtab-remote-auto-sync-push'
export const REMOTE_AUTO_SYNC_PUSH_DEBOUNCE_MS = 15_000

async function sendRemoteAutoSyncMessage(type: string) {
  if (!chrome?.runtime?.sendMessage) return
  try {
    await chrome.runtime.sendMessage({type})
  } catch {
    // Ignore if the background is not reachable yet.
  }
}

export function requestRemoteAutoSyncRefresh() {
  return sendRemoteAutoSyncMessage(REMOTE_AUTO_SYNC_REFRESH_MESSAGE)
}

export function requestRemoteAutoSyncDirty() {
  return sendRemoteAutoSyncMessage(REMOTE_AUTO_SYNC_MARK_DIRTY_MESSAGE)
}
