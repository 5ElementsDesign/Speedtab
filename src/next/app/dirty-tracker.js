import {markExportDirty} from '../../composables/useExportState.ts'
import {
  REMOTE_AUTO_SYNC_PUSH_DEBOUNCE_MS,
  requestRemoteAutoSyncDirty,
} from '../../composables/remoteAutoSyncProtocol.ts'
import {db} from '../../db/db.ts'

let trackingInstalled = false
let dirtyFlushTimer = null

const TRACKED_TABLES = [
  db.pages,
  db.modules,
  db.collections,
  db.tabs,
  db.notes,
  db.feed_sources,
  db.saved_feed_items,
  db.assets,
]

function scheduleWorkspaceDirty() {
  if (dirtyFlushTimer != null) {
    clearTimeout(dirtyFlushTimer)
  }

  dirtyFlushTimer = globalThis.setTimeout(() => {
    dirtyFlushTimer = null
    void markExportDirty('workspace:update')
    void requestRemoteAutoSyncDirty()
  }, Math.min(REMOTE_AUTO_SYNC_PUSH_DEBOUNCE_MS, 1000))
}

function installHooks(table) {
  table.hook('creating', () => {
    scheduleWorkspaceDirty()
  })
  table.hook('updating', () => {
    scheduleWorkspaceDirty()
  })
  table.hook('deleting', () => {
    scheduleWorkspaceDirty()
  })
}

export function installWorkspaceDirtyTracking() {
  if (trackingInstalled) return
  TRACKED_TABLES.forEach(installHooks)
  trackingInstalled = true
}
