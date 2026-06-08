import { db as defaultDb, isActiveRecord, makeCreateMetadata, makeUpdatedAtPatch, type SpeedtabDB } from '@/db/db'
import { markExportDirty } from '@/composables/useExportState'
import type { FeedSource, ModuleType, Note, SavedFeedItem, Tab } from '@/types/db'

export type CollectionTransferMode = 'copy' | 'move'
export type CollectionTransferKey = `${'tab' | 'note' | 'feed_source' | 'saved_feed_item'}:${number}`

type TransferCounts = {
  tabs: number
  notes: number
  feed_sources: number
  saved_feed_items: number
}

export interface CollectionTransferResult {
  mode: CollectionTransferMode
  moved_items: number
  counts: TransferCounts
}

function emptyCounts(): TransferCounts {
  return { tabs: 0, notes: 0, feed_sources: 0, saved_feed_items: 0 }
}

function parseSelectionKeys(keys: CollectionTransferKey[]) {
  const parsed = {
    tabs: [] as number[],
    notes: [] as number[],
    feed_sources: [] as number[],
    saved_feed_items: [] as number[],
  }

  for (const key of keys) {
    const [kind, rawId] = key.split(':')
    const id = Number(rawId)
    if (!Number.isFinite(id) || id <= 0) continue
    if (kind === 'tab') parsed.tabs.push(id)
    if (kind === 'note') parsed.notes.push(id)
    if (kind === 'feed_source') parsed.feed_sources.push(id)
    if (kind === 'saved_feed_item') parsed.saved_feed_items.push(id)
  }

  return parsed
}

async function normalizeSortOrder<T extends { id?: number; sort_order: number }>(
  rows: T[],
  update: (id: number, sortOrder: number) => Promise<unknown>,
) {
  const ordered = [...rows].sort((left, right) => left.sort_order - right.sort_order)
  await Promise.all(
    ordered.map((row, index) => (
      row.id != null && row.sort_order !== index
        ? update(row.id, index)
        : Promise.resolve()
    )),
  )
}

export async function transferCollectionContent(
  input: {
    sourceCollectionId: number
    destinationCollectionId: number
    moduleType: ModuleType
    mode: CollectionTransferMode
    selectedKeys: CollectionTransferKey[]
  },
  database: SpeedtabDB = defaultDb,
): Promise<CollectionTransferResult> {
  if (input.sourceCollectionId === input.destinationCollectionId) {
    throw new Error('Source and destination tabs must be different')
  }

  const selected = parseSelectionKeys(input.selectedKeys)
  const counts = emptyCounts()
  const now = Date.now()

  await database.transaction(
    'rw',
    database.tabs,
    database.notes,
    database.feed_sources,
    database.saved_feed_items,
    async () => {
      if (input.moduleType === 'tabs') {
        const rows = (await database.tabs
          .where('id')
          .anyOf(selected.tabs)
          .filter((row) => row.collection_id === input.sourceCollectionId && isActiveRecord(row))
          .toArray()) as Tab[]
        if (!rows.length) return

        const destinationCount = await database.tabs
          .where('collection_id')
          .equals(input.destinationCollectionId)
          .filter(isActiveRecord)
          .count()

        if (input.mode === 'move') {
          await Promise.all(rows
            .sort((left, right) => left.sort_order - right.sort_order)
            .map((row, index) =>
              database.tabs.update(row.id!, {
                collection_id: input.destinationCollectionId,
                sort_order: destinationCount + index,
                ...makeUpdatedAtPatch(now),
              }),
            ))
          const sourceRows = await database.tabs.where('collection_id').equals(input.sourceCollectionId).filter(isActiveRecord).toArray()
          await normalizeSortOrder(sourceRows as Tab[], (id, sortOrder) => database.tabs.update(id, { sort_order: sortOrder, ...makeUpdatedAtPatch(now) }))
        } else {
          await Promise.all(rows
            .sort((left, right) => left.sort_order - right.sort_order)
            .map((row, index) => {
              const { id: _id, ...rest } = row
              return database.tabs.add({
                ...rest,
                collection_id: input.destinationCollectionId,
                sort_order: destinationCount + index,
                ...makeCreateMetadata(now),
              })
            }))
        }

        counts.tabs = rows.length
      }

      if (input.moduleType === 'notes') {
        const rows = (await database.notes
          .where('id')
          .anyOf(selected.notes)
          .filter((row) => row.collection_id === input.sourceCollectionId && isActiveRecord(row))
          .toArray()) as Note[]
        if (!rows.length) return

        const destinationCount = await database.notes
          .where('collection_id')
          .equals(input.destinationCollectionId)
          .filter(isActiveRecord)
          .count()

        if (input.mode === 'move') {
          await Promise.all(rows
            .sort((left, right) => left.sort_order - right.sort_order)
            .map((row, index) =>
              database.notes.update(row.id!, {
                collection_id: input.destinationCollectionId,
                sort_order: destinationCount + index,
                ...makeUpdatedAtPatch(now),
              }),
            ))
          const sourceRows = await database.notes.where('collection_id').equals(input.sourceCollectionId).filter(isActiveRecord).toArray()
          await normalizeSortOrder(sourceRows as Note[], (id, sortOrder) => database.notes.update(id, { sort_order: sortOrder, ...makeUpdatedAtPatch(now) }))
        } else {
          await Promise.all(rows
            .sort((left, right) => left.sort_order - right.sort_order)
            .map((row, index) => {
              const { id: _id, ...rest } = row
              return database.notes.add({
                ...rest,
                collection_id: input.destinationCollectionId,
                sort_order: destinationCount + index,
                ...makeCreateMetadata(now),
              })
            }))
        }

        counts.notes = rows.length
      }

      if (input.moduleType === 'feeds') {
        const sourceFeedRows = (await database.feed_sources
          .where('id')
          .anyOf(selected.feed_sources)
          .filter((row) => row.collection_id === input.sourceCollectionId && isActiveRecord(row))
          .toArray()) as FeedSource[]
        const sourceSavedRows = (await database.saved_feed_items
          .where('id')
          .anyOf(selected.saved_feed_items)
          .filter((row) => row.collection_id === input.sourceCollectionId && isActiveRecord(row))
          .toArray()) as SavedFeedItem[]

        const destinationFeedCount = await database.feed_sources
          .where('collection_id')
          .equals(input.destinationCollectionId)
          .filter(isActiveRecord)
          .count()
        const destinationSavedCount = await database.saved_feed_items
          .where('collection_id')
          .equals(input.destinationCollectionId)
          .filter(isActiveRecord)
          .count()

        if (input.mode === 'move') {
          await Promise.all(sourceFeedRows
            .sort((left, right) => left.sort_order - right.sort_order)
            .map((row, index) =>
              database.feed_sources.update(row.id!, {
                collection_id: input.destinationCollectionId,
                sort_order: destinationFeedCount + index,
                ...makeUpdatedAtPatch(now),
              }),
            ))
          await Promise.all(sourceSavedRows
            .sort((left, right) => left.sort_order - right.sort_order)
            .map((row, index) =>
              database.saved_feed_items.update(row.id!, {
                collection_id: input.destinationCollectionId,
                sort_order: destinationSavedCount + index,
                ...makeUpdatedAtPatch(now),
              }),
            ))

          const remainingFeeds = await database.feed_sources.where('collection_id').equals(input.sourceCollectionId).filter(isActiveRecord).toArray()
          const remainingSaved = await database.saved_feed_items.where('collection_id').equals(input.sourceCollectionId).filter(isActiveRecord).toArray()
          await normalizeSortOrder(remainingFeeds as FeedSource[], (id, sortOrder) => database.feed_sources.update(id, { sort_order: sortOrder, ...makeUpdatedAtPatch(now) }))
          await normalizeSortOrder(remainingSaved as SavedFeedItem[], (id, sortOrder) => database.saved_feed_items.update(id, { sort_order: sortOrder, ...makeUpdatedAtPatch(now) }))
        } else {
          await Promise.all(sourceFeedRows
            .sort((left, right) => left.sort_order - right.sort_order)
            .map((row, index) => {
              const { id: _id, ...rest } = row
              return database.feed_sources.add({
                ...rest,
                collection_id: input.destinationCollectionId,
                sort_order: destinationFeedCount + index,
                ...makeCreateMetadata(now),
              })
            }))
          await Promise.all(sourceSavedRows
            .sort((left, right) => left.sort_order - right.sort_order)
            .map((row, index) => {
              const { id: _id, ...rest } = row
              return database.saved_feed_items.add({
                ...rest,
                collection_id: input.destinationCollectionId,
                sort_order: destinationSavedCount + index,
                ...makeCreateMetadata(now),
              })
            }))
        }

        counts.feed_sources = sourceFeedRows.length
        counts.saved_feed_items = sourceSavedRows.length
      }
    },
  )

  const movedItems = counts.tabs + counts.notes + counts.feed_sources + counts.saved_feed_items
  if (!movedItems) {
    throw new Error('No transferable items were selected')
  }

  await markExportDirty(`${input.moduleType}:transfer`, database)

  return {
    mode: input.mode,
    moved_items: movedItems,
    counts,
  }
}
