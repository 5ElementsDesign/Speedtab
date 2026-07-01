import Dexie, { type Table, type DexieOptions } from 'dexie'
import type {
  Page,
  Module,
  Collection,
  Tab,
  Note,
  FeedSource,
  FeedItem,
  SavedFeedItem,
  Asset,
  AppSetting,
  CaptureInboxItem,
  BgArchiveItem,
  NextUiConfig,
} from '@/types/db'

const SYNC_METADATA_PENDING_KEY = 'pending_sync_metadata_migration'
const SYNC_METADATA_BATCH_SIZE = 150
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// ─── Database class ────────────────────────────────────────────────────────────

/**
 * SpeedtabDB – the single Dexie database for the entire extension.
 *
 * Schema design notes:
 *  - Only columns that are actually queried are indexed. Extra fields live on
 *    the object but cost no index space.
 *  - &slug on pages enforces a UNIQUE constraint via Dexie's & prefix.
 *  - &checksum on assets deduplicates uploaded WebP blobs.
 *  - feed_items has no full-text index at the Dexie layer; Phase 5 will
 *    implement client-side full-text via a lightweight search index if needed.
 *
 * The `options` parameter is intentionally exposed so unit tests can inject
 * `fake-indexeddb` without touching the global scope:
 *
 *   import { indexedDB, IDBKeyRange } from 'fake-indexeddb'
 *   const db = new SpeedtabDB({ indexedDB, IDBKeyRange })
 */
export class SpeedtabDB extends Dexie {
  pages!:        Table<Page>
  modules!:      Table<Module>
  collections!:  Table<Collection>
  tabs!:         Table<Tab>
  notes!:        Table<Note>
  feed_sources!: Table<FeedSource>
  feed_items!:   Table<FeedItem>
  saved_feed_items!: Table<SavedFeedItem>
  assets!:       Table<Asset>
  app_settings!: Table<AppSetting, string>
  capture_inbox!: Table<CaptureInboxItem>
  bg_archive!:   Table<BgArchiveItem>
  next_ui_config!: Table<NextUiConfig>

  constructor(options?: DexieOptions) {
    super('speedtab', options)

    this.version(1).stores({
      // pages: unique slug for hash navigation, indexed is_home for home lookup
      pages:        '++id, &slug, sort_order, is_home',

      // modules: query by page, type-filter, and sort order
      modules:      '++id, page_id, type, sort_order',

      // collections: query by owning module
      collections:  '++id, module_id, sort_order',

      // tabs: query by collection, url used for dedup checks
      tabs:         '++id, collection_id, url, sort_order',

      // notes: query by collection, type for filtering by note kind
      notes:        '++id, collection_id, type, sort_order',

      // feed_sources: query by collection, schedule refresh by last_fetched_at
      feed_sources: '++id, collection_id, sort_order, last_fetched_at',

      // feed_items: query by source, prune by fetched_at, sort by published_at
      feed_items:   '++id, feed_source_id, fetched_at, published_at',

      // assets: unique checksum prevents storing the same blob twice
      assets:       '++id, &checksum, kind',
    })

    this.version(2).stores({
      pages:            '++id, &slug, sort_order, is_home',
      modules:          '++id, page_id, type, sort_order',
      collections:      '++id, module_id, sort_order',
      tabs:             '++id, collection_id, url, sort_order',
      notes:            '++id, collection_id, type, sort_order',
      feed_sources:     '++id, collection_id, sort_order, last_fetched_at',
      feed_items:       '++id, feed_source_id, fetched_at, published_at',
      saved_feed_items: '++id, collection_id, saved_at, sort_order',
      assets:           '++id, &checksum, kind',
    })

    this.version(3).stores({
      pages:            '++id, &slug, sort_order, is_home',
      modules:          '++id, page_id, type, sort_order',
      collections:      '++id, module_id, sort_order',
      tabs:             '++id, collection_id, url, sort_order',
      notes:            '++id, collection_id, type, sort_order',
      feed_sources:     '++id, collection_id, sort_order, last_fetched_at',
      feed_items:       '++id, feed_source_id, fetched_at, published_at, [feed_source_id+external_id]',
      saved_feed_items: '++id, collection_id, saved_at, sort_order',
      assets:           '++id, &checksum, kind',
    })

    this.version(4).stores({
      pages:            '++id, &slug, sort_order, is_home',
      modules:          '++id, page_id, type, sort_order',
      collections:      '++id, module_id, sort_order',
      tabs:             '++id, collection_id, url, sort_order',
      notes:            '++id, collection_id, type, sort_order',
      feed_sources:     '++id, collection_id, sort_order, last_fetched_at',
      feed_items:       '++id, feed_source_id, fetched_at, published_at, [feed_source_id+external_id]',
      saved_feed_items: '++id, collection_id, saved_at, sort_order',
      assets:           '++id, &checksum, kind',
      app_settings:     '&key, updated_at',
    })

    this.version(5).stores({
      pages:            '++id, &slug, &sync_id, sort_order, is_home, updated_at, deleted_at',
      modules:          '++id, &sync_id, page_id, type, sort_order, updated_at, deleted_at',
      collections:      '++id, &sync_id, module_id, sort_order, updated_at, deleted_at',
      tabs:             '++id, &sync_id, collection_id, url, sort_order, updated_at, deleted_at',
      notes:            '++id, &sync_id, collection_id, type, sort_order, updated_at, deleted_at',
      feed_sources:     '++id, &sync_id, collection_id, sort_order, last_fetched_at, updated_at, deleted_at',
      feed_items:       '++id, feed_source_id, fetched_at, published_at, [feed_source_id+external_id]',
      saved_feed_items: '++id, &sync_id, collection_id, saved_at, sort_order, updated_at, deleted_at',
      assets:           '++id, &checksum, kind',
      app_settings:     '&key, updated_at',
    }).upgrade(async (tx) => {
      await tx.table('app_settings').put({
        key: SYNC_METADATA_PENDING_KEY,
        value_json: 'true',
        updated_at: Date.now(),
      } satisfies AppSetting)
    })

    this.version(6).stores({
      pages:            '++id, &slug, &sync_id, sort_order, is_home, updated_at, deleted_at',
      modules:          '++id, &sync_id, page_id, type, sort_order, updated_at, deleted_at',
      collections:      '++id, &sync_id, module_id, sort_order, updated_at, deleted_at',
      tabs:             '++id, &sync_id, collection_id, url, sort_order, updated_at, deleted_at',
      notes:            '++id, &sync_id, collection_id, type, sort_order, updated_at, deleted_at',
      feed_sources:     '++id, &sync_id, collection_id, sort_order, last_fetched_at, updated_at, deleted_at',
      feed_items:       '++id, feed_source_id, fetched_at, published_at, [feed_source_id+external_id]',
      saved_feed_items: '++id, &sync_id, collection_id, saved_at, sort_order, updated_at, deleted_at',
      assets:           '++id, &checksum, kind',
      app_settings:     '&key, updated_at',
      capture_inbox:    '++id, &external_hash, kind, created_at',
    })

    this.version(7).stores({
      pages:            '++id, &slug, &sync_id, sort_order, is_home, updated_at, deleted_at',
      modules:          '++id, &sync_id, page_id, type, sort_order, updated_at, deleted_at',
      collections:      '++id, &sync_id, module_id, sort_order, updated_at, deleted_at',
      tabs:             '++id, &sync_id, collection_id, url, sort_order, updated_at, deleted_at',
      notes:            '++id, &sync_id, collection_id, type, sort_order, updated_at, deleted_at',
      feed_sources:     '++id, &sync_id, collection_id, sort_order, last_fetched_at, updated_at, deleted_at',
      feed_items:       '++id, feed_source_id, fetched_at, published_at, [feed_source_id+external_id]',
      saved_feed_items: '++id, &sync_id, collection_id, saved_at, sort_order, updated_at, deleted_at',
      assets:           '++id, &checksum, kind',
      app_settings:     '&key, updated_at',
      capture_inbox:    '++id, &external_hash, kind, created_at',
      bg_archive:       '++id, created_at',
    })

    this.version(8).stores({
      pages:            '++id, &slug, &sync_id, sort_order, is_home, updated_at, deleted_at',
      modules:          '++id, &sync_id, page_id, type, sort_order, updated_at, deleted_at',
      collections:      '++id, &sync_id, module_id, sort_order, updated_at, deleted_at',
      tabs:             '++id, &sync_id, collection_id, url, sort_order, updated_at, deleted_at',
      notes:            '++id, &sync_id, collection_id, type, sort_order, updated_at, deleted_at',
      feed_sources:     '++id, &sync_id, collection_id, sort_order, last_fetched_at, updated_at, deleted_at',
      feed_items:       '++id, feed_source_id, fetched_at, published_at, [feed_source_id+external_id]',
      saved_feed_items: '++id, &sync_id, collection_id, saved_at, sort_order, updated_at, deleted_at',
      assets:           '++id, &checksum, kind',
      app_settings:     '&key, updated_at',
      capture_inbox:    '++id, &external_hash, kind, created_at',
      bg_archive:       '++id, created_at',
      next_ui_config:   '++id, [workspace_id+entity_sync_id], entity_type, entity_subtype, device_id, updated_at',
    })

    // Dedup any next_ui_config records that share the same [workspace_id+entity_sync_id].
    // The unique index is NOT added here — Dexie creates indexes before the upgrade handler
    // runs, so a unique constraint would fail if duplicates exist. The upsertUiConfig
    // function prevents future duplicates via a transaction instead.
    this.version(9).stores({}).upgrade(async (tx) => {
      const all = await tx.table('next_ui_config').toArray()
      const seen = new Map<string, typeof all[number]>()
      const toDelete: number[] = []
      for (const row of all) {
        const key = `${row.workspace_id}::${row.entity_sync_id}`
        const existing = seen.get(key)
        if (!existing) {
          seen.set(key, row)
        } else if (row.updated_at > existing.updated_at) {
          toDelete.push(existing.id)
          seen.set(key, row)
        } else {
          toDelete.push(row.id)
        }
      }
      if (toDelete.length) await tx.table('next_ui_config').bulkDelete(toDelete)
    })
  }
}

// ─── Application singleton ─────────────────────────────────────────────────────
// Components and composables import this. Tests create their own instances.
export const db = new SpeedtabDB()

db.on('versionchange', (event) => {
  console.warn(
    '[speedtab:db] Another extension context requested a database reset or schema change. Closing this connection; reload the page if needed.',
    {
      oldVersion: event.oldVersion,
      newVersion: event.newVersion,
    },
  )
  db.close()
})

db.on('blocked', (event) => {
  console.warn(
    '[speedtab:db] Database reset or upgrade is blocked by another open Speedtab context.',
    {
      oldVersion: event.oldVersion,
      newVersion: event.newVersion,
    },
  )
})

type PortableTableName =
  | 'pages'
  | 'modules'
  | 'collections'
  | 'tabs'
  | 'notes'
  | 'feed_sources'
  | 'saved_feed_items'

const PORTABLE_TABLES: PortableTableName[] = [
  'pages',
  'modules',
  'collections',
  'tabs',
  'notes',
  'feed_sources',
  'saved_feed_items',
]

function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

function createSyncMetadata(now = Date.now()) {
  return {
    sync_id: crypto.randomUUID(),
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }
}

export function makeCreateMetadata(now = Date.now()) {
  return createSyncMetadata(now)
}

export function makeUpdatedAtPatch(now = Date.now()) {
  return { updated_at: now }
}

export function isActiveRecord(record: { deleted_at?: number | null } | null | undefined): boolean {
  return record?.deleted_at == null
}

async function backfillPortableTable(database: SpeedtabDB, tableName: PortableTableName): Promise<void> {
  const table = database.table(tableName)
  const seenSyncIds = new Set<string>()
  let lastId = 0

  for (;;) {
    const batch = await table
      .orderBy('id')
      .filter((row: Record<string, unknown>) => typeof row.id === 'number' && row.id > lastId)
      .limit(SYNC_METADATA_BATCH_SIZE)
      .toArray() as Array<Record<string, unknown>>

    if (!batch.length) break

    const now = Date.now()
    const changedRows: Array<Record<string, unknown>> = []

    for (const row of batch) {
      lastId = row.id as number
      let changed = false

      if (!isValidUuid(row.sync_id) || seenSyncIds.has(row.sync_id)) {
        row.sync_id = crypto.randomUUID()
        changed = true
      }
      seenSyncIds.add(row.sync_id as string)

      if (typeof row.created_at !== 'number') {
        row.created_at = now
        changed = true
      }

      if (typeof row.updated_at !== 'number') {
        row.updated_at = now
        changed = true
      }

      if (!('deleted_at' in row) || (row.deleted_at !== null && typeof row.deleted_at !== 'number')) {
        row.deleted_at = null
        changed = true
      }

      if (changed) changedRows.push(row)
    }

    if (changedRows.length) {
      await database.transaction('rw', table, async () => {
        await table.bulkPut(changedRows)
      })
    }

    if (batch.length === SYNC_METADATA_BATCH_SIZE) {
      await Promise.resolve()
    }
  }
}

export async function ensureSyncMetadataMigration(database: SpeedtabDB = db, options?: { force?: boolean }): Promise<void> {
  await database.open()
  const pending = await database.app_settings.get(SYNC_METADATA_PENDING_KEY)
  const shouldRun = options?.force === true || pending?.value_json === 'true'
  if (!shouldRun) return

  for (const tableName of PORTABLE_TABLES) {
    await backfillPortableTable(database, tableName)
  }

  if (pending?.value_json === 'true') {
    await database.app_settings.put({
      key: SYNC_METADATA_PENDING_KEY,
      value_json: 'false',
      updated_at: Date.now(),
    })
  }
}
