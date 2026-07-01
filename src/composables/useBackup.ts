import { db as defaultDb, ensureSyncMetadataMigration, isActiveRecord, makeCreateMetadata, SpeedtabDB } from '@/db/db'
import { remapNoteImageTokens } from '@/composables/useNoteImages'
import type {
  Asset,
  AssetKind,
  BgArchiveItem,
  Collection,
  FeedItem,
  FeedSource,
  Module,
  Note,
  Page,
  SavedFeedItem,
  Tab,
} from '@/types/db'

// ─── Manifest schema ──────────────────────────────────────────────────────────

export const BACKUP_VERSION = 2
export const LEGACY_BACKUP_VERSION = 1
export const IMPORT_LOCK_KEY = 'backup_import_lock'
export const LAST_IMPORT_EXPORTED_AT_KEY = 'last_import_exported_at'
export const LAST_EXPORT_CHECKSUM_KEY = 'last_export_checksum'
const IMPORT_LOCK_TTL_MS = 5 * 60 * 1000

export interface SerializedAsset {
  original_id: number
  kind:        AssetKind
  checksum:    string
  width:       number | null
  height:      number | null
  meta_json:   string | null
  mime_type:   string
  data_base64: string
}

type WithOriginal<T> = T & { original_id: number }

export interface BackupManifestV1 {
  version:      typeof LEGACY_BACKUP_VERSION
  exported_at:  string
  pages:        WithOriginal<Page>[]
  modules:      WithOriginal<Module>[]
  collections:  WithOriginal<Collection>[]
  tabs:         WithOriginal<Tab>[]
  notes:        WithOriginal<Note>[]
  feed_sources: WithOriginal<FeedSource>[]
  feed_items:   WithOriginal<FeedItem>[]
  saved_feed_items: WithOriginal<SavedFeedItem>[]
  assets:       SerializedAsset[]
}

export type ExportedPageV2 = Omit<Page, 'id'>
export type ExportedModuleV2 = Omit<Module, 'id' | 'page_id'> & { page_sync_id: string; original_id?: number }
export type ExportedCollectionV2 = Omit<Collection, 'id' | 'module_id'> & { module_sync_id: string; original_id?: number }
export type ExportedTabV2 = Omit<Tab, 'id' | 'collection_id'> & { collection_sync_id: string; original_id?: number }
export type ExportedNoteV2 = Omit<Note, 'id' | 'collection_id'> & { collection_sync_id: string; original_id?: number }
export type ExportedFeedSourceV2 = Omit<FeedSource, 'id' | 'collection_id'> & { collection_sync_id: string; original_id?: number }
export type ExportedSavedFeedItemV2 = Omit<SavedFeedItem, 'id' | 'collection_id'> & { collection_sync_id: string; original_id?: number }

export interface BackupManifestV2 {
  version:      typeof BACKUP_VERSION
  exported_at:  string
  pages:        ExportedPageV2[]
  modules:      ExportedModuleV2[]
  collections:  ExportedCollectionV2[]
  tabs:         ExportedTabV2[]
  notes:        ExportedNoteV2[]
  feed_sources: ExportedFeedSourceV2[]
  saved_feed_items: ExportedSavedFeedItemV2[]
  assets:       SerializedAsset[]
  bg_archive?:  BgArchiveItem[]
}

export type BackupManifest = BackupManifestV1 | BackupManifestV2

type JsonLike =
  | null
  | boolean
  | number
  | string
  | JsonLike[]
  | { [key: string]: JsonLike }

const NOTE_IMAGE_TOKEN_RE = /{{asset:image:(\d+)}}/g

// ─── Blob ↔ base64 helpers ────────────────────────────────────────────────────

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

export function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

// ─── Validation ───────────────────────────────────────────────────────────────

export class BackupValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'BackupValidationError' }
}

const PORTABLE_TABLE_KEYS_V2 = [
  'pages', 'modules', 'collections', 'tabs', 'notes', 'feed_sources', 'saved_feed_items', 'assets',
] as const

const LEGACY_TABLE_KEYS_V1 = [
  'pages', 'modules', 'collections', 'tabs', 'notes', 'feed_sources', 'feed_items', 'saved_feed_items', 'assets',
] as const

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function assertArrayField(manifest: Record<string, unknown>, key: string) {
  if (!Array.isArray(manifest[key])) {
    throw new BackupValidationError(`Manifest table "${key}" must be an array`)
  }
}

function validateAssets(rows: unknown[]) {
  for (const row of rows) {
    if (!isRecord(row)) throw new BackupValidationError('Asset row must be an object')
    if (typeof row.original_id !== 'number') throw new BackupValidationError('Asset row is missing original_id')
    if (typeof row.checksum !== 'string' || !row.checksum) throw new BackupValidationError('Asset row is missing checksum')
    if (typeof row.mime_type !== 'string' || !row.mime_type) throw new BackupValidationError('Asset row is missing mime_type')
    if (typeof row.data_base64 !== 'string') throw new BackupValidationError('Asset row is missing data_base64')
  }
}

function ensureUniqueSyncIds(rows: Array<Record<string, unknown>>, table: string) {
  const seen = new Set<string>()
  for (const row of rows) {
    const syncId = row.sync_id
    if (typeof syncId !== 'string' || !UUID_RE.test(syncId)) {
      throw new BackupValidationError(`Row in "${table}" has invalid sync_id`)
    }
    if (seen.has(syncId)) {
      throw new BackupValidationError(`Duplicate sync_id in "${table}": ${syncId}`)
    }
    seen.add(syncId)
  }
}

function repairManifestV2StructuralOrphans(obj: unknown): unknown {
  if (!isRecord(obj) || obj.version !== BACKUP_VERSION) return obj

  const manifest = obj as Record<string, unknown>
  if (
    !Array.isArray(manifest.pages) ||
    !Array.isArray(manifest.modules) ||
    !Array.isArray(manifest.collections) ||
    !Array.isArray(manifest.tabs) ||
    !Array.isArray(manifest.notes) ||
    !Array.isArray(manifest.feed_sources) ||
    !Array.isArray(manifest.saved_feed_items)
  ) {
    return obj
  }

  const pages = manifest.pages.filter(isRecord)
  const pageSyncIds = new Set(
    pages
      .map((row) => row.sync_id)
      .filter((value): value is string => typeof value === 'string' && UUID_RE.test(value)),
  )

  const modules = manifest.modules.filter((row) =>
    isRecord(row) &&
    typeof row.page_sync_id === 'string' &&
    pageSyncIds.has(row.page_sync_id),
  )
  const moduleSyncIds = new Set(
    modules
      .map((row) => row.sync_id)
      .filter((value): value is string => typeof value === 'string' && UUID_RE.test(value)),
  )

  const collections = manifest.collections.filter((row) =>
    isRecord(row) &&
    typeof row.module_sync_id === 'string' &&
    moduleSyncIds.has(row.module_sync_id),
  )
  const collectionSyncIds = new Set(
    collections
      .map((row) => row.sync_id)
      .filter((value): value is string => typeof value === 'string' && UUID_RE.test(value)),
  )

  const filterCollectionChildren = (rows: unknown[]) => rows.filter((row) =>
    isRecord(row) &&
    typeof row.collection_sync_id === 'string' &&
    collectionSyncIds.has(row.collection_sync_id),
  )

  return {
    ...manifest,
    pages,
    modules,
    collections,
    tabs: filterCollectionChildren(manifest.tabs),
    notes: filterCollectionChildren(manifest.notes),
    feed_sources: filterCollectionChildren(manifest.feed_sources),
    saved_feed_items: filterCollectionChildren(manifest.saved_feed_items),
  }
}

function validateManifestV1(obj: unknown): asserts obj is BackupManifestV1 {
  const manifest = obj as Record<string, unknown>
  for (const key of LEGACY_TABLE_KEYS_V1) {
    if (key === 'saved_feed_items' && manifest[key] == null) {
      manifest[key] = []
      continue
    }
    assertArrayField(manifest, key)
  }

  for (const key of LEGACY_TABLE_KEYS_V1) {
    const arr = manifest[key] as Array<Record<string, unknown>>
    for (const row of arr) {
      if (typeof row.original_id !== 'number') {
        throw new BackupValidationError(`Row in "${key}" is missing original_id`)
      }
    }
  }

  checkFk(manifest.modules, 'page_id', manifest.pages, 'modules → pages')
  checkFk(manifest.collections, 'module_id', manifest.modules, 'collections → modules')
  checkFk(manifest.tabs, 'collection_id', manifest.collections, 'tabs → collections')
  checkFk(manifest.notes, 'collection_id', manifest.collections, 'notes → collections')
  checkFk(manifest.feed_sources, 'collection_id', manifest.collections, 'feed_sources → collections')
  checkFk(manifest.feed_items, 'feed_source_id', manifest.feed_sources, 'feed_items → feed_sources')
  checkFk(manifest.saved_feed_items, 'collection_id', manifest.collections, 'saved_feed_items → collections')
}

function validateManifestV2(obj: unknown): asserts obj is BackupManifestV2 {
  const manifest = obj as Record<string, unknown>
  for (const key of PORTABLE_TABLE_KEYS_V2) {
    if (key === 'saved_feed_items' && manifest[key] == null) {
      manifest[key] = []
      continue
    }
    assertArrayField(manifest, key)
  }

  const portableTables: Array<[string, Array<Record<string, unknown>>]> = [
    ['pages', manifest.pages as Array<Record<string, unknown>>],
    ['modules', manifest.modules as Array<Record<string, unknown>>],
    ['collections', manifest.collections as Array<Record<string, unknown>>],
    ['tabs', manifest.tabs as Array<Record<string, unknown>>],
    ['notes', manifest.notes as Array<Record<string, unknown>>],
    ['feed_sources', manifest.feed_sources as Array<Record<string, unknown>>],
    ['saved_feed_items', manifest.saved_feed_items as Array<Record<string, unknown>>],
  ]

  for (const [table, rows] of portableTables) {
    ensureUniqueSyncIds(rows, table)
    for (const row of rows) {
      if (typeof row.created_at !== 'number' || typeof row.updated_at !== 'number') {
        throw new BackupValidationError(`Row in "${table}" is missing created_at or updated_at`)
      }
    }
  }

  const childFields: Array<[string, Array<Record<string, unknown>>, string]> = [
    ['modules', manifest.modules as Array<Record<string, unknown>>, 'page_sync_id'],
    ['collections', manifest.collections as Array<Record<string, unknown>>, 'module_sync_id'],
    ['tabs', manifest.tabs as Array<Record<string, unknown>>, 'collection_sync_id'],
    ['notes', manifest.notes as Array<Record<string, unknown>>, 'collection_sync_id'],
    ['feed_sources', manifest.feed_sources as Array<Record<string, unknown>>, 'collection_sync_id'],
    ['saved_feed_items', manifest.saved_feed_items as Array<Record<string, unknown>>, 'collection_sync_id'],
  ]

  for (const [table, rows, field] of childFields) {
    for (const row of rows) {
      if (typeof row[field] !== 'string' || !UUID_RE.test(row[field] as string)) {
        throw new BackupValidationError(`Row in "${table}" is missing valid ${field}`)
      }
    }
  }

  validateAssets(manifest.assets as unknown[])
}

export function validateManifest(obj: unknown): asserts obj is BackupManifest {
  if (!isRecord(obj)) {
    throw new BackupValidationError('Manifest must be an object')
  }
  if (typeof obj.exported_at !== 'string') {
    throw new BackupValidationError('Manifest is missing exported_at')
  }

  if (obj.version === LEGACY_BACKUP_VERSION) {
    validateManifestV1(obj)
    return
  }

  if (obj.version === BACKUP_VERSION) {
    validateManifestV2(obj)
    return
  }

  throw new BackupValidationError(`Unsupported manifest version: ${String(obj.version)}`)
}

function checkFk(
  children: unknown,
  fkField: string,
  parents: unknown,
  label: string,
): void {
  const parentIds = new Set(
    (parents as Array<Record<string, unknown>>).map(p => p.original_id as number),
  )
  for (const row of children as Array<Record<string, unknown>>) {
    const fk = row[fkField] as number
    if (!parentIds.has(fk)) {
      throw new BackupValidationError(`Broken FK in ${label}: ${fkField}=${fk}`)
    }
  }
}

function throwExportIntegrityError(orphanCounts: Record<string, number>): never {
  const details = Object.entries(orphanCounts)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label}:${count}`)
    .join(', ')

  throw new BackupValidationError(
    `Export blocked: orphaned active rows detected (${details}). Run cleanup before exporting.`
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function exportAll(database: SpeedtabDB = defaultDb): Promise<BackupManifestV2> {
  await ensureSyncMetadataMigration(database, { force: true })

  const [rawPages, rawModules, rawCollections, rawTabs, rawNotes, rawFeedSources, rawSavedFeedItems, assets, bgArchive] =
    await Promise.all([
      database.pages.filter(isActiveRecord).toArray(),
      database.modules.filter(isActiveRecord).toArray(),
      database.collections.filter(isActiveRecord).toArray(),
      database.tabs.filter(isActiveRecord).toArray(),
      database.notes.filter(isActiveRecord).toArray(),
      database.feed_sources.filter(isActiveRecord).toArray(),
      database.saved_feed_items.filter(isActiveRecord).toArray(),
      database.assets.toArray(),
      database.bg_archive.orderBy('created_at').toArray(),
    ])

  const pages = rawPages.filter((row) => row.id != null)
  const pageIdSet = new Set(pages.map((row) => row.id!))
  const orphanModules = rawModules.filter((row) => row.id == null || !pageIdSet.has(row.page_id))
  const modules = rawModules.filter((row) => row.id != null && pageIdSet.has(row.page_id))
  const moduleIdSet = new Set(modules.map((row) => row.id!))

  const orphanCollections = rawCollections.filter((row) => row.id == null || !moduleIdSet.has(row.module_id))
  const collections = rawCollections.filter((row) => row.id != null && moduleIdSet.has(row.module_id))
  const collectionIdSet = new Set(collections.map((row) => row.id!))

  const orphanTabs = rawTabs.filter((row) => !collectionIdSet.has(row.collection_id))
  const tabs = rawTabs.filter((row) => collectionIdSet.has(row.collection_id))
  const orphanNotes = rawNotes.filter((row) => !collectionIdSet.has(row.collection_id))
  const notes = rawNotes.filter((row) => collectionIdSet.has(row.collection_id))
  const orphanFeedSources = rawFeedSources.filter((row) => !collectionIdSet.has(row.collection_id))
  const feedSources = rawFeedSources.filter((row) => collectionIdSet.has(row.collection_id))
  const orphanSavedFeedItems = rawSavedFeedItems.filter((row) => !collectionIdSet.has(row.collection_id))
  const savedFeedItems = rawSavedFeedItems.filter((row) => collectionIdSet.has(row.collection_id))

  if (
    orphanModules.length ||
    orphanCollections.length ||
    orphanTabs.length ||
    orphanNotes.length ||
    orphanFeedSources.length ||
    orphanSavedFeedItems.length
  ) {
    throwExportIntegrityError({
      modules: orphanModules.length,
      collections: orphanCollections.length,
      tabs: orphanTabs.length,
      notes: orphanNotes.length,
      feed_sources: orphanFeedSources.length,
      saved_feed_items: orphanSavedFeedItems.length,
    })
  }

  const pageSyncById = new Map(pages.filter((row) => row.id != null).map((row) => [row.id!, row.sync_id]))
  const moduleSyncById = new Map(modules.filter((row) => row.id != null).map((row) => [row.id!, row.sync_id]))
  const collectionSyncById = new Map(collections.filter((row) => row.id != null).map((row) => [row.id!, row.sync_id]))

  const serializedAssets: SerializedAsset[] = await Promise.all(
    assets.map(async (a) => ({
      original_id: a.id!,
      kind: a.kind,
      checksum: a.checksum,
      width: a.width,
      height: a.height,
      meta_json: a.meta_json,
      mime_type: a.blob.type || 'image/webp',
      data_base64: await blobToBase64(a.blob),
    })),
  )

  return {
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    pages: pages.map(({ id: _id, ...rest }) => rest),
    modules: modules.map(({ id: _id, page_id, ...rest }) => ({
      ...rest,
      page_sync_id: pageSyncById.get(page_id)!,
      original_id: _id,
    })),
    collections: collections.map(({ id: _id, module_id, ...rest }) => ({
      ...rest,
      module_sync_id: moduleSyncById.get(module_id)!,
      original_id: _id,
    })),
    tabs: tabs.map(({ id: _id, collection_id, ...rest }) => ({
      ...rest,
      collection_sync_id: collectionSyncById.get(collection_id)!,
      original_id: _id,
    })),
    notes: notes.map(({ id: _id, collection_id, ...rest }) => ({
      ...rest,
      collection_sync_id: collectionSyncById.get(collection_id)!,
      original_id: _id,
    })),
    feed_sources: feedSources.map(({ id: _id, collection_id, ...rest }) => ({
      ...rest,
      collection_sync_id: collectionSyncById.get(collection_id)!,
      original_id: _id,
    })),
    saved_feed_items: savedFeedItems.map(({ id: _id, collection_id, ...rest }) => ({
      ...rest,
      collection_sync_id: collectionSyncById.get(collection_id)!,
      original_id: _id,
    })),
    assets: serializedAssets,
    bg_archive: bgArchive,
  }
}

function compareScalars(a: string | number | null | undefined, b: string | number | null | undefined): number {
  const left = a ?? null
  const right = b ?? null

  if (left === right) return 0
  if (left === null) return -1
  if (right === null) return 1

  if (typeof left === 'number' && typeof right === 'number') {
    return left - right
  }

  return String(left).localeCompare(String(right))
}

function sortRows<T>(rows: T[], compare: (left: T, right: T) => number): T[] {
  return [...rows].sort(compare)
}

function sortObjectKeys(value: JsonLike): JsonLike {
  if (Array.isArray(value)) {
    return value.map((entry) => sortObjectKeys(entry))
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  const sortedEntries = Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entryValue]) => [key, sortObjectKeys(entryValue as JsonLike)] as const)

  return Object.fromEntries(sortedEntries) as JsonLike
}

function canonicalizeManifest(manifest: BackupManifest): BackupManifest {
  if (manifest.version === LEGACY_BACKUP_VERSION) {
    return {
      ...manifest,
      pages: sortRows(manifest.pages, (left, right) => compareScalars(left.original_id, right.original_id)),
      modules: sortRows(manifest.modules, (left, right) =>
        compareScalars(left.page_id, right.page_id) ||
        compareScalars(left.original_id, right.original_id)),
      collections: sortRows(manifest.collections, (left, right) =>
        compareScalars(left.module_id, right.module_id) ||
        compareScalars(left.original_id, right.original_id)),
      tabs: sortRows(manifest.tabs, (left, right) =>
        compareScalars(left.collection_id, right.collection_id) ||
        compareScalars(left.original_id, right.original_id)),
      notes: sortRows(manifest.notes, (left, right) =>
        compareScalars(left.collection_id, right.collection_id) ||
        compareScalars(left.original_id, right.original_id)),
      feed_sources: sortRows(manifest.feed_sources, (left, right) =>
        compareScalars(left.collection_id, right.collection_id) ||
        compareScalars(left.original_id, right.original_id)),
      feed_items: sortRows(manifest.feed_items, (left, right) =>
        compareScalars(left.feed_source_id, right.feed_source_id) ||
        compareScalars(left.original_id, right.original_id)),
      saved_feed_items: sortRows(manifest.saved_feed_items, (left, right) =>
        compareScalars(left.collection_id, right.collection_id) ||
        compareScalars(left.original_id, right.original_id)),
      assets: sortRows(manifest.assets, (left, right) =>
        compareScalars(left.checksum, right.checksum) ||
        compareScalars(left.kind, right.kind) ||
        compareScalars(left.original_id, right.original_id)),
    }
  }

  return {
    ...manifest,
    pages: sortRows(manifest.pages, (left, right) => compareScalars(left.sync_id, right.sync_id)),
    modules: sortRows(manifest.modules, (left, right) =>
      compareScalars(left.page_sync_id, right.page_sync_id) ||
      compareScalars(left.sync_id, right.sync_id)),
    collections: sortRows(manifest.collections, (left, right) =>
      compareScalars(left.module_sync_id, right.module_sync_id) ||
      compareScalars(left.sync_id, right.sync_id)),
    tabs: sortRows(manifest.tabs, (left, right) =>
      compareScalars(left.collection_sync_id, right.collection_sync_id) ||
      compareScalars(left.sync_id, right.sync_id)),
    notes: sortRows(manifest.notes, (left, right) =>
      compareScalars(left.collection_sync_id, right.collection_sync_id) ||
      compareScalars(left.sync_id, right.sync_id)),
    feed_sources: sortRows(manifest.feed_sources, (left, right) =>
      compareScalars(left.collection_sync_id, right.collection_sync_id) ||
      compareScalars(left.sync_id, right.sync_id)),
    saved_feed_items: sortRows(manifest.saved_feed_items, (left, right) =>
      compareScalars(left.collection_sync_id, right.collection_sync_id) ||
      compareScalars(left.sync_id, right.sync_id)),
    assets: sortRows(manifest.assets, (left, right) =>
      compareScalars(left.checksum, right.checksum) ||
      compareScalars(left.kind, right.kind) ||
      compareScalars(left.original_id, right.original_id)),
    bg_archive: sortRows(manifest.bg_archive ?? [], (left, right) =>
      compareScalars(left.created_at, right.created_at) ||
      compareScalars(left.id ?? null, right.id ?? null)),
  }
}

function buildChecksumPayload(manifest: BackupManifest): JsonLike {
  const canonical = canonicalizeManifest(manifest)

  if (canonical.version === LEGACY_BACKUP_VERSION) {
    return sortObjectKeys({
      ...canonical,
      exported_at: '',
      pages: canonical.pages.map(({ original_id: _originalId, ...row }) => row),
      modules: canonical.modules.map(({ original_id: _originalId, page_id, ...row }) => ({
        ...row,
        page_original_id: page_id,
      })),
      collections: canonical.collections.map(({ original_id: _originalId, module_id, ...row }) => ({
        ...row,
        module_original_id: module_id,
      })),
      tabs: canonical.tabs.map(({ original_id: _originalId, collection_id, favicon_asset_id, preview_asset_id, ...row }) => ({
        ...row,
        collection_original_id: collection_id,
        favicon_asset_original_id: favicon_asset_id,
        preview_asset_original_id: preview_asset_id,
      })),
      notes: canonical.notes.map(({ original_id: _originalId, collection_id, ...row }) => ({
        ...row,
        collection_original_id: collection_id,
      })),
      feed_sources: canonical.feed_sources.map(({ original_id: _originalId, collection_id, ...row }) => ({
        ...row,
        collection_original_id: collection_id,
      })),
      feed_items: canonical.feed_items.map(({ original_id: _originalId, feed_source_id, ...row }) => ({
        ...row,
        feed_source_original_id: feed_source_id,
      })),
      saved_feed_items: canonical.saved_feed_items.map(({ original_id: _originalId, collection_id, ...row }) => ({
        ...row,
        collection_original_id: collection_id,
      })),
      assets: canonical.assets.map(({ original_id: _originalId, ...row }) => row),
    } as unknown as JsonLike)
  }

  const assetChecksumByOriginalId = new Map<number, string>(
    canonical.assets.map((asset) => [asset.original_id, asset.checksum] as const),
  )

  const normalizeAssetRef = (assetOriginalId: number | null | undefined): string | null =>
    assetOriginalId != null ? assetChecksumByOriginalId.get(assetOriginalId) ?? null : null

  const normalizeNoteContent = (content: string, type: string): string => {
    if (type !== 'html') return content
    return content.replace(NOTE_IMAGE_TOKEN_RE, (_match, assetIdRaw: string) => {
      const assetChecksum = assetChecksumByOriginalId.get(Number(assetIdRaw))
      return assetChecksum ? `{{asset:image:${assetChecksum}}}` : ''
    })
  }

  return sortObjectKeys({
    ...canonical,
    exported_at: '',
    modules: canonical.modules.map(({ original_id: _originalId, ...row }) => row),
    collections: canonical.collections.map(({ original_id: _originalId, ...row }) => row),
    tabs: canonical.tabs.map(({ original_id: _originalId, favicon_asset_id, preview_asset_id, ...row }) => ({
      ...row,
      favicon_asset_checksum: normalizeAssetRef(favicon_asset_id),
      preview_asset_checksum: normalizeAssetRef(preview_asset_id),
    })),
    notes: canonical.notes.map(({ original_id: _originalId, content, type, ...row }) => ({
      ...row,
      content: normalizeNoteContent(content, type),
      type,
    })),
    feed_sources: canonical.feed_sources.map(({ original_id: _originalId, ...row }) => row),
    saved_feed_items: canonical.saved_feed_items.map(({ original_id: _originalId, ...row }) => row),
    assets: canonical.assets.map(({ original_id: _originalId, ...row }) => row),
    bg_archive: (canonical as BackupManifestV2).bg_archive ?? [],
  } as unknown as JsonLike)
}

export function manifestToJsonString(m: BackupManifest): string {
  return JSON.stringify(sortObjectKeys(canonicalizeManifest(m) as unknown as JsonLike))
}

export async function manifestChecksum(manifest: BackupManifest): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(buildChecksumPayload(manifest)))
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = Array.from(new Uint8Array(digest).slice(0, 6))
  return bytes.map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function exportFilename(_manifest: BackupManifest, checksum: string): string {
  return `speedtab-export-${checksum}.json`
}

// ─── Import ───────────────────────────────────────────────────────────────────

export interface ImportOptions {
  dryRun?: boolean
}

export interface ImportReport {
  pages: number
  modules: number
  collections: number
  tabs: number
  notes: number
  feed_sources: number
  feed_items: number
  saved_feed_items: number
  assets: number
  assets_deduped: number
  dry_run: boolean
  manifest_version: number
  pages_inserted?: number
  pages_updated?: number
  modules_inserted?: number
  modules_updated?: number
  collections_inserted?: number
  collections_updated?: number
  tabs_inserted?: number
  tabs_updated?: number
  notes_inserted?: number
  notes_updated?: number
  feed_sources_inserted?: number
  feed_sources_updated?: number
  saved_feed_items_inserted?: number
  saved_feed_items_updated?: number
  newer_local_skipped?: number
  orphans_skipped?: number
  legacy_warning?: string
}

let activeImportPromise: Promise<ImportReport> | null = null

export async function importAll(
  manifest: BackupManifest,
  options: ImportOptions = {},
  database: SpeedtabDB = defaultDb,
): Promise<ImportReport> {
  if (activeImportPromise) {
    throw new Error('Import already in progress')
  }

  await acquireImportLock(database)
  const run = importAllInternal(manifest, options, database)
  activeImportPromise = run
  try {
    return await run
  } finally {
    activeImportPromise = null
    await releaseImportLock(database)
  }
}

async function acquireImportLock(database: SpeedtabDB) {
  const now = Date.now()
  const existing = await database.app_settings.get(IMPORT_LOCK_KEY)
  if (existing) {
    const expiresAt = existing.updated_at + IMPORT_LOCK_TTL_MS
    if (expiresAt > now) {
      throw new Error('Import already in progress')
    }
  }

  await database.app_settings.put({
    key: IMPORT_LOCK_KEY,
    value_json: JSON.stringify({ started_at: now }),
    updated_at: now,
  })
}

async function releaseImportLock(database: SpeedtabDB) {
  await database.app_settings.delete(IMPORT_LOCK_KEY)
}

async function importAllInternal(
  manifest: BackupManifest,
  options: ImportOptions,
  database: SpeedtabDB,
): Promise<ImportReport> {
  validateManifest(manifest)

  if (manifest.version === LEGACY_BACKUP_VERSION) {
    return importLegacyManifest(manifest, options, database)
  }
  return importManifestV2(manifest, options, database)
}

async function importLegacyManifest(
  manifest: BackupManifestV1,
  options: ImportOptions,
  database: SpeedtabDB,
): Promise<ImportReport> {
  const report: ImportReport = {
    pages: 0, modules: 0, collections: 0, tabs: 0, notes: 0,
    feed_sources: 0, feed_items: 0, saved_feed_items: 0, assets: 0, assets_deduped: 0,
    dry_run: !!options.dryRun,
    manifest_version: LEGACY_BACKUP_VERSION,
    legacy_warning: 'Legacy export detected. This import format does not contain stable sync identities and may duplicate content.',
  }

  if (options.dryRun) {
    report.pages = manifest.pages.length
    report.modules = manifest.modules.length
    report.collections = manifest.collections.length
    report.tabs = manifest.tabs.length
    report.notes = manifest.notes.length
    report.feed_sources = manifest.feed_sources.length
    report.saved_feed_items = manifest.saved_feed_items.length
    report.assets = manifest.assets.length
    return report
  }

  await database.transaction(
    'rw',
    [
      database.pages, database.modules, database.collections,
      database.tabs, database.notes, database.feed_sources,
      database.feed_items, database.saved_feed_items, database.assets,
      database.app_settings,
    ],
    async () => {
      const importNow = Date.now()
      const assetMap = new Map<number, number>()
      for (const a of manifest.assets) {
        const existing = await database.assets.where('checksum').equals(a.checksum).first()
        if (existing?.id) {
          assetMap.set(a.original_id, existing.id)
          report.assets_deduped++
          continue
        }
        const blob = base64ToBlob(a.data_base64, a.mime_type)
        const newId = await database.assets.add({
          kind: a.kind, checksum: a.checksum, blob,
          width: a.width, height: a.height, meta_json: a.meta_json,
        } as Asset) as number
        assetMap.set(a.original_id, newId)
        report.assets++
      }

      const pageMap = new Map<number, number>()
      for (const p of manifest.pages) {
        const { original_id, id: _id, ...rest } = p
        const existing = await database.pages.where('slug').equals(rest.slug).first()
        if (existing?.id) {
          pageMap.set(original_id, existing.id)
          continue
        }
        const newId = await database.pages.add({
          ...rest,
          ...makeCreateMetadata(importNow),
        } as Page) as number
        pageMap.set(original_id, newId)
        report.pages++
      }

      const moduleMap = new Map<number, number>()
      for (const m of manifest.modules) {
        const { original_id, id: _id, ...rest } = m
        const newId = await database.modules.add({
          ...rest,
          page_id: pageMap.get(rest.page_id)!,
          ...makeCreateMetadata(importNow),
        } as Module) as number
        moduleMap.set(original_id, newId)
        report.modules++
      }

      const collectionMap = new Map<number, number>()
      for (const c of manifest.collections) {
        const { original_id, id: _id, ...rest } = c
        const newId = await database.collections.add({
          ...rest,
          module_id: moduleMap.get(rest.module_id)!,
          ...makeCreateMetadata(importNow),
        } as Collection) as number
        collectionMap.set(original_id, newId)
        report.collections++
      }

      for (const t of manifest.tabs) {
        const { id: _id, original_id: _o, ...rest } = t
        await database.tabs.add({
          ...rest,
          collection_id: collectionMap.get(rest.collection_id)!,
          favicon_asset_id: rest.favicon_asset_id != null ? assetMap.get(rest.favicon_asset_id) ?? null : null,
          preview_asset_id: rest.preview_asset_id != null ? assetMap.get(rest.preview_asset_id) ?? null : null,
          ...makeCreateMetadata(importNow),
        } as Tab)
        report.tabs++
      }

      for (const n of manifest.notes) {
        const { id: _id, original_id: _o, ...rest } = n
        await database.notes.add({
          ...rest,
          collection_id: collectionMap.get(rest.collection_id)!,
          content: rest.type === 'html'
            ? remapNoteImageTokens(rest.content, (assetId) => assetMap.get(assetId))
            : rest.content,
          ...makeCreateMetadata(importNow),
        } as Note)
        report.notes++
      }

      for (const fs of manifest.feed_sources) {
        const { original_id: _original_id, id: _id, ...rest } = fs
        await database.feed_sources.add({
          ...rest,
          collection_id: collectionMap.get(rest.collection_id)!,
          ...makeCreateMetadata(importNow),
        } as FeedSource)
        report.feed_sources++
      }

      for (const sfi of manifest.saved_feed_items) {
        const { id: _id, original_id: _o, ...rest } = sfi
        await database.saved_feed_items.add({
          ...rest,
          collection_id: collectionMap.get(rest.collection_id)!,
          ...makeCreateMetadata(importNow),
        } as SavedFeedItem)
        report.saved_feed_items++
      }

      await database.app_settings.put({
        key: LAST_IMPORT_EXPORTED_AT_KEY,
        value_json: JSON.stringify(manifest.exported_at),
        updated_at: Date.now(),
      })
    },
  )

  return report
}

async function importManifestV2(
  manifest: BackupManifestV2,
  options: ImportOptions,
  database: SpeedtabDB,
): Promise<ImportReport> {
  const report: ImportReport = {
    pages: 0, modules: 0, collections: 0, tabs: 0, notes: 0,
    feed_sources: 0, feed_items: 0, saved_feed_items: 0, assets: 0, assets_deduped: 0,
    dry_run: !!options.dryRun,
    manifest_version: BACKUP_VERSION,
    pages_inserted: 0,
    pages_updated: 0,
    modules_inserted: 0,
    modules_updated: 0,
    collections_inserted: 0,
    collections_updated: 0,
    tabs_inserted: 0,
    tabs_updated: 0,
    notes_inserted: 0,
    notes_updated: 0,
    feed_sources_inserted: 0,
    feed_sources_updated: 0,
    saved_feed_items_inserted: 0,
    saved_feed_items_updated: 0,
    newer_local_skipped: 0,
    orphans_skipped: 0,
  }

  if (options.dryRun) {
    report.pages = manifest.pages.length
    report.modules = manifest.modules.length
    report.collections = manifest.collections.length
    report.tabs = manifest.tabs.length
    report.notes = manifest.notes.length
    report.feed_sources = manifest.feed_sources.length
    report.saved_feed_items = manifest.saved_feed_items.length
    report.assets = manifest.assets.length
    return report
  }

  await database.transaction(
    'rw',
    [
      database.pages, database.modules, database.collections,
      database.tabs, database.notes, database.feed_sources,
      database.saved_feed_items, database.assets, database.app_settings,
      database.bg_archive,
    ],
    async () => {
      const assetIdByChecksum = new Map<string, number>()
      const assetIdByOriginalId = new Map<number, number>()
      for (const existing of await database.assets.toArray()) {
        if (existing.id != null) assetIdByChecksum.set(existing.checksum, existing.id)
      }

      for (const asset of manifest.assets) {
        const existingId = assetIdByChecksum.get(asset.checksum)
        if (existingId != null) {
          assetIdByOriginalId.set(asset.original_id, existingId)
          report.assets_deduped++
          continue
        }
        const blob = base64ToBlob(asset.data_base64, asset.mime_type)
        const newId = await database.assets.add({
          kind: asset.kind,
          checksum: asset.checksum,
          blob,
          width: asset.width,
          height: asset.height,
          meta_json: asset.meta_json,
        } as Asset) as number
        assetIdByChecksum.set(asset.checksum, newId)
        assetIdByOriginalId.set(asset.original_id, newId)
        report.assets++
      }

      const pagesBySync = new Map((await database.pages.toArray()).map((row) => [row.sync_id, row] as const))
      const modulesBySync = new Map((await database.modules.toArray()).map((row) => [row.sync_id, row] as const))
      const collectionsBySync = new Map((await database.collections.toArray()).map((row) => [row.sync_id, row] as const))

      for (const page of manifest.pages) {
        const existing = pagesBySync.get(page.sync_id)
        if (existing) {
          pagesBySync.set(page.sync_id, existing)
          if (page.updated_at <= existing.updated_at) {
            report.newer_local_skipped!++
            continue
          }
          await database.pages.update(existing.id!, {
            slug: page.slug,
            title: page.title,
            nav_group: page.nav_group,
            icon: page.icon,
            is_home: page.is_home,
            config_json: page.config_json ?? null,
            created_at: page.created_at,
            updated_at: page.updated_at,
          })
          const updated = { ...existing, ...page, sort_order: existing.sort_order }
          pagesBySync.set(page.sync_id, updated)
          report.pages++
          report.pages_updated!++
          continue
        }

        const newId = await database.pages.add({
          ...page,
          deleted_at: null,
        } as Page) as number
        pagesBySync.set(page.sync_id, { ...page, id: newId, deleted_at: null })
        report.pages++
        report.pages_inserted!++
      }

      for (const module of manifest.modules) {
        const localPage = pagesBySync.get(module.page_sync_id)
        if (!localPage?.id) {
          report.orphans_skipped!++
          continue
        }

        const existing = modulesBySync.get(module.sync_id)
        if (existing) {
          modulesBySync.set(module.sync_id, existing)
          if (module.updated_at <= existing.updated_at) {
            report.newer_local_skipped!++
            continue
          }
          await database.modules.update(existing.id!, {
            page_id: localPage.id,
            type: module.type,
            title: module.title,
            config_json: module.config_json,
            created_at: module.created_at,
            updated_at: module.updated_at,
          })
          const updated = { ...existing, ...module, id: existing.id, page_id: localPage.id, sort_order: existing.sort_order, deleted_at: existing.deleted_at }
          modulesBySync.set(module.sync_id, updated)
          report.modules++
          report.modules_updated!++
          continue
        }

        const newId = await database.modules.add({
          ...module,
          page_id: localPage.id,
          deleted_at: null,
        } as Module) as number
        modulesBySync.set(module.sync_id, { ...module, id: newId, page_id: localPage.id, deleted_at: null })
        report.modules++
        report.modules_inserted!++
      }

      for (const collection of manifest.collections) {
        const localModule = modulesBySync.get(collection.module_sync_id)
        if (!localModule?.id) {
          report.orphans_skipped!++
          continue
        }

        const existing = collectionsBySync.get(collection.sync_id)
        if (existing) {
          collectionsBySync.set(collection.sync_id, existing)
          if (collection.updated_at <= existing.updated_at) {
            report.newer_local_skipped!++
            continue
          }
          await database.collections.update(existing.id!, {
            module_id: localModule.id,
            title: collection.title,
            config_json: collection.config_json,
            created_at: collection.created_at,
            updated_at: collection.updated_at,
          })
          const updated = { ...existing, ...collection, id: existing.id, module_id: localModule.id, sort_order: existing.sort_order, deleted_at: existing.deleted_at }
          collectionsBySync.set(collection.sync_id, updated)
          report.collections++
          report.collections_updated!++
          continue
        }

        const newId = await database.collections.add({
          ...collection,
          module_id: localModule.id,
          deleted_at: null,
        } as Collection) as number
        collectionsBySync.set(collection.sync_id, { ...collection, id: newId, module_id: localModule.id, deleted_at: null })
        report.collections++
        report.collections_inserted!++
      }

      await importChildRowsV2(manifest.tabs, {
        table: database.tabs,
        map: new Map((await database.tabs.toArray()).map((row) => [row.sync_id, row] as const)),
        resolveParent: (row) => collectionsBySync.get(row.collection_sync_id),
        makeInsert: (row, parentId) => ({
          ...row,
          collection_id: parentId,
          favicon_asset_id: row.favicon_asset_id != null ? assetIdByOriginalId.get(row.favicon_asset_id) ?? null : null,
          preview_asset_id: row.preview_asset_id != null ? assetIdByOriginalId.get(row.preview_asset_id) ?? null : null,
          deleted_at: null,
        } as Tab),
        makeUpdate: (row, _existing, parentId) => ({
          collection_id: parentId,
          title: row.title,
          url: row.url,
          description: row.description,
          favicon_asset_id: row.favicon_asset_id != null ? assetIdByOriginalId.get(row.favicon_asset_id) ?? null : null,
          preview_asset_id: row.preview_asset_id != null ? assetIdByOriginalId.get(row.preview_asset_id) ?? null : null,
          meta_json: row.meta_json,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }),
        updateCounters: () => { report.tabs++; },
        updateInserted: () => { report.tabs_inserted!++; },
        updateUpdated: () => { report.tabs_updated!++; },
        report,
      })

      await importChildRowsV2(manifest.notes, {
        table: database.notes,
        map: new Map((await database.notes.toArray()).map((row) => [row.sync_id, row] as const)),
        resolveParent: (row) => collectionsBySync.get(row.collection_sync_id),
        makeInsert: (row, parentId) => ({
          ...row,
          collection_id: parentId,
          content: row.type === 'html'
            ? remapNoteImageTokens(row.content, (assetId) => assetIdByOriginalId.get(assetId))
            : row.content,
          deleted_at: null,
        } as Note),
        makeUpdate: (row, _existing, parentId) => ({
          collection_id: parentId,
          title: row.title,
          type: row.type,
          content: row.type === 'html'
            ? remapNoteImageTokens(row.content, (assetId) => assetIdByOriginalId.get(assetId))
            : row.content,
          style_token: row.style_token,
          meta_json: row.meta_json,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }),
        updateCounters: () => { report.notes++; },
        updateInserted: () => { report.notes_inserted!++; },
        updateUpdated: () => { report.notes_updated!++; },
        report,
      })

      await importChildRowsV2(manifest.feed_sources, {
        table: database.feed_sources,
        map: new Map((await database.feed_sources.toArray()).map((row) => [row.sync_id, row] as const)),
        resolveParent: (row) => collectionsBySync.get(row.collection_sync_id),
        makeInsert: (row, parentId) => ({
          ...row,
          collection_id: parentId,
          deleted_at: null,
        } as FeedSource),
        makeUpdate: (row, _existing, parentId) => ({
          collection_id: parentId,
          title: row.title,
          feed_url: row.feed_url,
          site_url: row.site_url,
          style_token: row.style_token,
          last_hash: row.last_hash,
          last_fetched_at: row.last_fetched_at,
          last_error_at: row.last_error_at,
          last_error_message: row.last_error_message,
          fetch_options_json: row.fetch_options_json,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }),
        updateCounters: () => { report.feed_sources++; },
        updateInserted: () => { report.feed_sources_inserted!++; },
        updateUpdated: () => { report.feed_sources_updated!++; },
        report,
      })

      await importChildRowsV2(manifest.saved_feed_items, {
        table: database.saved_feed_items,
        map: new Map((await database.saved_feed_items.toArray()).map((row) => [row.sync_id, row] as const)),
        resolveParent: (row) => collectionsBySync.get(row.collection_sync_id),
        makeInsert: (row, parentId) => ({
          ...row,
          collection_id: parentId,
          deleted_at: null,
        } as SavedFeedItem),
        makeUpdate: (row, _existing, parentId) => ({
          collection_id: parentId,
          title: row.title,
          url: row.url,
          source_title: row.source_title,
          author: row.author,
          published_at: row.published_at,
          summary: row.summary,
          content: row.content,
          comment: row.comment,
          saved_at: row.saved_at,
          meta_json: row.meta_json,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }),
        updateCounters: () => { report.saved_feed_items++; },
        updateInserted: () => { report.saved_feed_items_inserted!++; },
        updateUpdated: () => { report.saved_feed_items_updated!++; },
        report,
      })

      if (Array.isArray(manifest.bg_archive) && manifest.bg_archive.length > 0) {
        await database.bg_archive.bulkAdd(
          manifest.bg_archive.map(({ id: _id, ...row }) => row),
        )
      }

      await database.app_settings.put({
        key: LAST_IMPORT_EXPORTED_AT_KEY,
        value_json: JSON.stringify(manifest.exported_at),
        updated_at: Date.now(),
      })
    },
  )

  return report
}

type ChildImportOptions<TManifestRow extends { sync_id: string; updated_at: number }, TLocal extends { id?: number; sync_id: string; updated_at: number; sort_order: number; deleted_at: number | null }> = {
  table: ReturnType<SpeedtabDB['table']>
  map: Map<string, TLocal>
  resolveParent: (row: TManifestRow & Record<string, unknown>) => { id?: number } | undefined
  makeInsert: (row: TManifestRow & Record<string, unknown>, parentId: number) => TLocal
  makeUpdate: (row: TManifestRow & Record<string, unknown>, existing: TLocal, parentId: number) => Record<string, unknown>
  updateCounters: () => void
  updateInserted: () => void
  updateUpdated: () => void
  report: ImportReport
}

async function importChildRowsV2<TManifestRow extends { sync_id: string; updated_at: number }, TLocal extends { id?: number; sync_id: string; updated_at: number; sort_order: number; deleted_at: number | null }>(
  rows: Array<TManifestRow & Record<string, unknown>>,
  options: ChildImportOptions<TManifestRow, TLocal>,
) {
  for (const row of rows) {
    const parent = options.resolveParent(row)
    if (!parent?.id) {
      options.report.orphans_skipped!++
      continue
    }

    const existing = options.map.get(row.sync_id)
    if (existing) {
      options.map.set(row.sync_id, existing)
      if (row.updated_at <= existing.updated_at) {
        options.report.newer_local_skipped!++
        continue
      }
      await options.table.update(existing.id!, options.makeUpdate(row, existing, parent.id))
      options.map.set(row.sync_id, {
        ...existing,
        ...row,
        id: existing.id,
        sort_order: existing.sort_order,
        deleted_at: existing.deleted_at,
      } as TLocal)
      options.updateCounters()
      options.updateUpdated()
      continue
    }

    const newId = await options.table.add(options.makeInsert(row, parent.id))
    options.map.set(row.sync_id, { ...(options.makeInsert(row, parent.id) as TLocal), id: newId as number })
    options.updateCounters()
    options.updateInserted()
  }
}

// ─── Browser helpers ──────────────────────────────────────────────────────────

export async function downloadManifest(manifest: BackupManifest, filename?: string): Promise<void> {
  const resolvedFilename = filename ?? exportFilename(manifest, await manifestChecksum(manifest))
  const blob = new Blob([manifestToJsonString(manifest)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = resolvedFilename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function parseManifestText(text: string): BackupManifest {
  let parsed: unknown
  try { parsed = JSON.parse(text) }
  catch { throw new BackupValidationError('File is not valid JSON') }
  parsed = repairManifestV2StructuralOrphans(parsed)
  validateManifest(parsed)
  return parsed
}

export async function readManifestFile(file: File): Promise<BackupManifest> {
  return parseManifestText(await file.text())
}
