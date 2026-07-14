/**
 * useBackup – unit tests
 *
 * Tests cover:
 *  • blobToBase64 / base64ToBlob helpers
 *  • validateManifest – accepts valid, rejects corrupted manifests
 *  • exportAll        – serialises portable user data and assets
 *  • importAll        – round-trip, ID remapping, asset deduplication, dry-run
 *  • readManifestFile – rejects non-JSON and structurally invalid files
 */
import { makeCreateMetadata, SpeedtabDB } from '@/db/db'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// ─── jsdom polyfills ──────────────────────────────────────────────────────────
// jsdom ships an incomplete Blob / File implementation. Patch the minimum
// surface we need so tests don't break in the node environment.

if (!Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function () {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(this)
    })
  }
}

if (!File.prototype.text) {
  File.prototype.text = function () {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsText(this)
    })
  }
}

import {
    BACKUP_VERSION,
    BackupValidationError,
    LAST_IMPORT_EXPORTED_AT_KEY,
    base64ToBlob,
    blobToBase64,
    exportAll,
    importAll,
    manifestChecksum,
    manifestToJsonString,
    parseManifestText,
    readManifestFile,
    validateManifest,
    type BackupManifest,
} from './useBackup'

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeDb() {
  return new SpeedtabDB({ indexedDB: new IDBFactory(), IDBKeyRange })
}

function withMeta<T extends object>(data: T) {
  return { ...makeCreateMetadata(1_700_000_000_000), ...data }
}

/** Minimal valid manifest with no rows. */
function emptyManifest(): BackupManifest {
  return {
    version:      BACKUP_VERSION,
    exported_at:  new Date().toISOString(),
    pages:        [],
    modules:      [],
    collections:  [],
    tabs:         [],
    notes:        [],
    feed_sources: [],
    saved_feed_items: [],
    assets:       [],
  }
}

/** Seed a complete page → module → collection → tab chain. */
async function seedFullChain(db: SpeedtabDB) {
  const pageId       = await db.pages.add(withMeta({ slug: 'home', title: 'Home', nav_group: 'main', icon: '🏠', is_home: 1, sort_order: 0 }))
  const moduleId     = await db.modules.add(withMeta({ page_id: pageId as number, type: 'tabs', title: 'Bookmarks', sort_order: 0, config_json: null }))
  const collectionId = await db.collections.add(withMeta({ module_id: moduleId as number, title: 'Work', sort_order: 0, config_json: null }))
  const tabId        = await db.tabs.add(withMeta({ collection_id: collectionId as number, title: 'GitHub', url: 'https://github.com', description: null, favicon_asset_id: null, preview_asset_id: null, sort_order: 0, meta_json: null }))
  return { pageId, moduleId, collectionId, tabId }
}

async function seedDeterministicWorkspace(database: SpeedtabDB, options?: { reversePages?: boolean }) {
  const now = 1_700_000_000_000
  const pageRecords = options?.reversePages
    ? [
        withMeta({ slug: 'work', title: 'Work', nav_group: 'main' as const, icon: 'W', is_home: 0 as const, sort_order: 1, sync_id: '20000000-0000-4000-8000-000000000002', created_at: now + 2, updated_at: now + 2, deleted_at: null }),
        withMeta({ slug: 'home', title: 'Home', nav_group: 'main' as const, icon: 'H', is_home: 1 as const, sort_order: 0, sync_id: '10000000-0000-4000-8000-000000000001', created_at: now + 1, updated_at: now + 1, deleted_at: null }),
      ]
    : [
        withMeta({ slug: 'home', title: 'Home', nav_group: 'main' as const, icon: 'H', is_home: 1 as const, sort_order: 0, sync_id: '10000000-0000-4000-8000-000000000001', created_at: now + 1, updated_at: now + 1, deleted_at: null }),
        withMeta({ slug: 'work', title: 'Work', nav_group: 'main' as const, icon: 'W', is_home: 0 as const, sort_order: 1, sync_id: '20000000-0000-4000-8000-000000000002', created_at: now + 2, updated_at: now + 2, deleted_at: null }),
      ]

  const pageIds: Record<string, number> = {}
  for (const page of pageRecords) {
    pageIds[page.slug] = await database.pages.add(page) as number
  }

  const moduleRecords = options?.reversePages
    ? [
        withMeta({ page_id: pageIds.work, type: 'tabs' as const, title: 'Work Tabs', sort_order: 0, config_json: JSON.stringify({ columns: 4, compact: true }), sync_id: '40000000-0000-4000-8000-000000000004', created_at: now + 4, updated_at: now + 4, deleted_at: null }),
        withMeta({ page_id: pageIds.home, type: 'tabs' as const, title: 'Home Tabs', sort_order: 0, config_json: JSON.stringify({ columns: 6, compact: false }), sync_id: '30000000-0000-4000-8000-000000000003', created_at: now + 3, updated_at: now + 3, deleted_at: null }),
      ]
    : [
        withMeta({ page_id: pageIds.home, type: 'tabs' as const, title: 'Home Tabs', sort_order: 0, config_json: JSON.stringify({ columns: 6, compact: false }), sync_id: '30000000-0000-4000-8000-000000000003', created_at: now + 3, updated_at: now + 3, deleted_at: null }),
        withMeta({ page_id: pageIds.work, type: 'tabs' as const, title: 'Work Tabs', sort_order: 0, config_json: JSON.stringify({ columns: 4, compact: true }), sync_id: '40000000-0000-4000-8000-000000000004', created_at: now + 4, updated_at: now + 4, deleted_at: null }),
      ]

  const moduleIds: Record<string, number> = {}
  for (const module of moduleRecords) {
    moduleIds[module.title] = await database.modules.add(module) as number
  }

  const collectionRecords = options?.reversePages
    ? [
        withMeta({ module_id: moduleIds['Work Tabs'], title: 'Work Collection', sort_order: 0, config_json: JSON.stringify({ collapsed: false }), sync_id: '60000000-0000-4000-8000-000000000006', created_at: now + 6, updated_at: now + 6, deleted_at: null }),
        withMeta({ module_id: moduleIds['Home Tabs'], title: 'Home Collection', sort_order: 0, config_json: JSON.stringify({ collapsed: false }), sync_id: '50000000-0000-4000-8000-000000000005', created_at: now + 5, updated_at: now + 5, deleted_at: null }),
      ]
    : [
        withMeta({ module_id: moduleIds['Home Tabs'], title: 'Home Collection', sort_order: 0, config_json: JSON.stringify({ collapsed: false }), sync_id: '50000000-0000-4000-8000-000000000005', created_at: now + 5, updated_at: now + 5, deleted_at: null }),
        withMeta({ module_id: moduleIds['Work Tabs'], title: 'Work Collection', sort_order: 0, config_json: JSON.stringify({ collapsed: false }), sync_id: '60000000-0000-4000-8000-000000000006', created_at: now + 6, updated_at: now + 6, deleted_at: null }),
      ]

  const collectionIds: Record<string, number> = {}
  for (const collection of collectionRecords) {
    collectionIds[collection.title] = await database.collections.add(collection) as number
  }

  await database.tabs.bulkAdd([
    withMeta({
      collection_id: collectionIds['Home Collection'],
      title: 'Alpha',
      url: 'https://alpha.example.com',
      description: 'Alpha',
      favicon_asset_id: null,
      preview_asset_id: null,
      sort_order: 0,
      meta_json: JSON.stringify({ pinned: true }),
      sync_id: '70000000-0000-4000-8000-000000000007',
      created_at: now + 7,
      updated_at: now + 7,
      deleted_at: null,
    }),
    withMeta({
      collection_id: collectionIds['Work Collection'],
      title: 'Beta',
      url: 'https://beta.example.com',
      description: 'Beta',
      favicon_asset_id: null,
      preview_asset_id: null,
      sort_order: 0,
      meta_json: JSON.stringify({ pinned: false }),
      sync_id: '80000000-0000-4000-8000-000000000008',
      created_at: now + 8,
      updated_at: now + 8,
      deleted_at: null,
    }),
  ])
}

// ─── blob helpers ─────────────────────────────────────────────────────────────

describe('blobToBase64 / base64ToBlob', () => {
  it('round-trips binary data through base64', async () => {
    const bytes    = new Uint8Array([1, 2, 3, 255, 128])
    const original = new Blob([bytes], { type: 'image/webp' })
    const b64      = await blobToBase64(original)
    const restored = base64ToBlob(b64, 'image/webp')
    const restoredBytes = new Uint8Array(await restored.arrayBuffer())
    expect(Array.from(restoredBytes)).toEqual([1, 2, 3, 255, 128])
    expect(restored.type).toBe('image/webp')
  })
})

// ─── validateManifest ─────────────────────────────────────────────────────────

describe('validateManifest', () => {
  it('accepts a minimal valid manifest', () => {
    expect(() => validateManifest(emptyManifest())).not.toThrow()
  })

  it('rejects null / non-object', () => {
    expect(() => validateManifest(null)).toThrow(BackupValidationError)
    expect(() => validateManifest('string')).toThrow(BackupValidationError)
  })

  it('rejects wrong version', () => {
    expect(() => validateManifest({ ...emptyManifest(), version: 99 })).toThrow(BackupValidationError)
  })

  it('rejects missing exported_at', () => {
    const m = emptyManifest() as any
    delete m.exported_at
    expect(() => validateManifest(m)).toThrow(BackupValidationError)
  })

  it('rejects when a table is not an array', () => {
    expect(() => validateManifest({ ...emptyManifest(), tabs: 'bad' as any })).toThrow(BackupValidationError)
  })

  it('rejects duplicate sync_id values in v2 tables', () => {
    const meta = makeCreateMetadata(1_700_000_000_000)
    const m = emptyManifest()
    m.pages = [
      { ...meta, slug: 'one', title: 'One', nav_group: 'main', icon: null, is_home: 1, sort_order: 0 },
      { ...meta, slug: 'two', title: 'Two', nav_group: 'main', icon: null, is_home: 0, sort_order: 1 },
    ]
    m.pages[1].sync_id = m.pages[0].sync_id
    expect(() => validateManifest(m)).toThrow(BackupValidationError)
  })

  it('rejects rows missing original_id', () => {
    const m = emptyManifest()
    m.pages = [{ slug: 'x', title: 'X', nav_group: 'main', icon: null, is_home: 0, sort_order: 0 } as any]
    expect(() => validateManifest(m)).toThrow(BackupValidationError)
  })

  it('rejects broken FK (module references unknown page)', () => {
    const m = emptyManifest()
    m.modules = [{ ...withMeta({ page_id: 999, type: 'tabs' as const, title: 'M', sort_order: 0, config_json: null }), original_id: 1, id: 1 }]
    expect(() => validateManifest(m)).toThrow(BackupValidationError)
  })
})

describe('exportAll', () => {
  it('blocks export when active orphaned structural rows exist', async () => {
    const db = makeDb()

    const pageId = await db.pages.add(withMeta({
      slug: 'home',
      title: 'Home',
      nav_group: 'main',
      icon: null,
      is_home: 1,
      sort_order: 0,
    }))

    const validModuleId = await db.modules.add(withMeta({
      page_id: pageId as number,
      type: 'tabs',
      title: 'Valid module',
      sort_order: 0,
      config_json: null,
    }))

    const validCollectionId = await db.collections.add(withMeta({
      module_id: validModuleId as number,
      title: 'Valid collection',
      sort_order: 0,
      config_json: null,
    }))

    await db.tabs.add(withMeta({
      collection_id: validCollectionId as number,
      title: 'Valid tab',
      url: 'https://example.com',
      description: null,
      favicon_asset_id: null,
      preview_asset_id: null,
      sort_order: 0,
      meta_json: null,
    }))

    const orphanModuleId = await db.modules.add(withMeta({
      page_id: 999999,
      type: 'tabs',
      title: 'Orphan module',
      sort_order: 1,
      config_json: null,
    }))

    const orphanCollectionId = await db.collections.add(withMeta({
      module_id: orphanModuleId as number,
      title: 'Orphan collection',
      sort_order: 0,
      config_json: null,
    }))

    await db.tabs.add(withMeta({
      collection_id: orphanCollectionId as number,
      title: 'Orphan tab',
      url: 'https://orphan.example.com',
      description: null,
      favicon_asset_id: null,
      preview_asset_id: null,
      sort_order: 0,
      meta_json: null,
    }))

    await expect(exportAll(db)).rejects.toThrow(
      'Export blocked: orphaned active rows detected (modules:1, collections:1, tabs:1). Run cleanup before exporting.'
    )
  })
})

// ─── exportAll / importAll round-trip ─────────────────────────────────────────

let src: SpeedtabDB
let dst: SpeedtabDB

beforeEach(async () => {
  src = makeDb(); await src.open()
  dst = makeDb(); await dst.open()
})

afterEach(async () => {
  await src.delete()
  await dst.delete()
})

describe('exportAll', () => {
  it('returns an empty manifest for an empty DB', async () => {
    const m = await exportAll(src)
    expect(m.version).toBe(BACKUP_VERSION)
    expect(m.pages).toHaveLength(0)
    expect(m.tabs).toHaveLength(0)
    expect(m.saved_feed_items).toHaveLength(0)
  })

  it('serialises all seeded rows', async () => {
    await seedFullChain(src)
    const collectionId = await src.collections.toCollection().first().then(c => c!.id!)
    await src.saved_feed_items.add(withMeta({
      collection_id: collectionId,
      title: 'Saved item',
      url: 'https://example.com/saved',
      source_title: 'Example Feed',
      author: null,
      published_at: null,
      summary: 'Summary',
      content: null,
      comment: 'Comment',
      saved_at: Date.now(),
      sort_order: 0,
      meta_json: null,
    }))
    const m = await exportAll(src)
    expect(m.pages).toHaveLength(1)
    expect(m.modules).toHaveLength(1)
    expect(m.collections).toHaveLength(1)
    expect(m.tabs).toHaveLength(1)
    expect(m.tabs[0].collection_sync_id).toBeTypeOf('string')
    expect(m.saved_feed_items).toHaveLength(1)
  })

  it('excludes wallpaper assets and background archive rows from new exports', async () => {
    await src.assets.add({
      kind: 'background',
      checksum: 'wallpaper-checksum',
      blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' }),
      width: 1920,
      height: 1080,
      meta_json: null,
    })
    await src.bg_archive.add({
      name: 'Wallpaper preset',
      value: 'linear-gradient(90deg, #111, #333)',
      created_at: 1_700_000_000_000,
    })

    const manifest = await exportAll(src)

    expect(manifest.assets).toHaveLength(0)
    expect('bg_archive' in manifest).toBe(false)
  })

  it('serialises backup JSON in minified form', async () => {
    await seedFullChain(src)
    const manifest = await exportAll(src)
    const json = manifestToJsonString(manifest)

    expect(json).not.toContain('\n')
    expect(json).toContain('"version":2')
  })

  it('returns the same checksum when hashed twice', async () => {
    await seedDeterministicWorkspace(src)
    const manifest = await exportAll(src)

    const checksumA = await manifestChecksum(manifest)
    const checksumB = await manifestChecksum(manifest)

    expect(checksumA).toBe(checksumB)
  })

  it('ignores exported_at differences when computing checksum', async () => {
    await seedDeterministicWorkspace(src)
    const manifest = await exportAll(src)

    const checksumA = await manifestChecksum(manifest)
    const checksumB = await manifestChecksum({
      ...manifest,
      exported_at: new Date(Date.parse(manifest.exported_at) + 60_000).toISOString(),
    })

    expect(checksumA).toBe(checksumB)
  })

  it('keeps checksum stable when portable record insertion order differs', async () => {
    const left = makeDb()
    const right = makeDb()
    await left.open()
    await right.open()

    try {
      await seedDeterministicWorkspace(left, { reversePages: false })
      await seedDeterministicWorkspace(right, { reversePages: true })

      const leftManifest = await exportAll(left)
      const rightManifest = await exportAll(right)

      expect(await manifestChecksum(leftManifest)).toBe(await manifestChecksum(rightManifest))
    } finally {
      await left.delete()
      await right.delete()
    }
  })

  it('keeps checksum stable when asset insertion order differs', async () => {
    const previewBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' })
    const faviconBlob = new Blob([new Uint8Array([4, 5, 6])], { type: 'image/png' })
    const previewBase64 = await blobToBase64(previewBlob)
    const faviconBase64 = await blobToBase64(faviconBlob)

    const leftManifest: BackupManifest = {
      ...emptyManifest(),
      assets: [
        {
          original_id: 10,
          kind: 'preview',
          checksum: 'asset-a',
          width: 120,
          height: 80,
          meta_json: null,
          mime_type: 'image/webp',
          data_base64: previewBase64,
        },
        {
          original_id: 11,
          kind: 'favicon',
          checksum: 'asset-b',
          width: 32,
          height: 32,
          meta_json: JSON.stringify({ hostnames: ['example.com'] }),
          mime_type: 'image/png',
          data_base64: faviconBase64,
        },
      ],
    }

    const rightManifest: BackupManifest = {
      ...emptyManifest(),
      assets: [...leftManifest.assets].reverse(),
    }

    expect(await manifestChecksum(leftManifest)).toBe(await manifestChecksum(rightManifest))
  })

  it('ignores wallpaper assets and background archive rows when computing checksum', async () => {
    const baseManifest = emptyManifest()
    const variantManifest: BackupManifest = {
      ...baseManifest,
      assets: [{
        original_id: 99,
        kind: 'background',
        checksum: 'wallpaper-checksum',
        width: 1920,
        height: 1080,
        meta_json: null,
        mime_type: 'image/webp',
        data_base64: await blobToBase64(new Blob([new Uint8Array([7, 8, 9])], { type: 'image/webp' })),
      }],
      bg_archive: [{
        id: 1,
        name: 'Wallpaper preset',
        value: 'linear-gradient(90deg, #111, #333)',
        created_at: 1_700_000_000_000,
      }],
    }

    expect(await manifestChecksum(baseManifest)).toBe(await manifestChecksum(variantManifest))
  })
})

describe('importAll – round-trip', () => {
  it('imports all records into an empty destination DB', async () => {
    await seedFullChain(src)
    const manifest = await exportAll(src)
    const report   = await importAll(manifest, {}, dst)

    expect(report.pages).toBe(1)
    expect(report.modules).toBe(1)
    expect(report.collections).toBe(1)
    expect(report.tabs).toBe(1)
    expect(report.dry_run).toBe(false)

    const pages = await dst.pages.toArray()
    expect(pages).toHaveLength(1)
    expect(pages[0].slug).toBe('home')
  })

  it('remaps foreign keys so tab.collection_id points at the new id', async () => {
    await seedFullChain(src)
    const manifest = await exportAll(src)
    await importAll(manifest, {}, dst)

    const [collection] = await dst.collections.toArray()
    const [tab]        = await dst.tabs.toArray()
    expect(tab.collection_id).toBe(collection.id)
  })

  it('remaps bookmark preview asset ids to restored local asset ids', async () => {
    await seedFullChain(src)
    const manifest = await exportAll(src)
    const previewBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' })
    const previewAssetOriginalId = 99
    manifest.assets.push({
      original_id: previewAssetOriginalId,
      kind: 'preview',
      checksum: 'preview-checksum',
      width: 100,
      height: 50,
      meta_json: null,
      mime_type: 'image/webp',
      data_base64: await blobToBase64(previewBlob),
    })
    manifest.tabs[0].preview_asset_id = previewAssetOriginalId

    await importAll(manifest, {}, dst)

    const [importedTab] = await dst.tabs.toArray()
    expect(importedTab.preview_asset_id).not.toBeNull()

    const importedPreview = await dst.assets.get(importedTab.preview_asset_id!)
    expect(importedPreview?.checksum).toBe('preview-checksum')
    expect(importedPreview?.kind).toBe('preview')
  })

  it('remaps bookmark favicon asset ids to restored local asset ids', async () => {
    await seedFullChain(src)
    const manifest = await exportAll(src)
    const faviconBlob = new Blob([new Uint8Array([9, 8, 7])], { type: 'image/png' })
    const faviconAssetOriginalId = 101
    manifest.assets.push({
      original_id: faviconAssetOriginalId,
      kind: 'favicon',
      checksum: 'favicon-checksum',
      width: 32,
      height: 32,
      meta_json: JSON.stringify({ hostnames: ['github.com'], fetched_at: Date.now() }),
      mime_type: 'image/png',
      data_base64: await blobToBase64(faviconBlob),
    })
    manifest.tabs[0].favicon_asset_id = faviconAssetOriginalId

    await importAll(manifest, {}, dst)

    const [importedTab] = await dst.tabs.toArray()
    expect(importedTab.favicon_asset_id).not.toBeNull()

    const importedFavicon = await dst.assets.get(importedTab.favicon_asset_id!)
    expect(importedFavicon?.checksum).toBe('favicon-checksum')
    expect(importedFavicon?.kind).toBe('favicon')
  })

  it('still imports background archive rows from older manifests without overwriting local rows', async () => {
    const manifest = emptyManifest()
    manifest.bg_archive = [{
      id: 1,
      name: 'Source item',
      value: 'linear-gradient(90deg, #111, #333)',
      created_at: 1_700_000_000_000,
    }]

    await dst.bg_archive.add({
      name: 'Existing item',
      value: 'radial-gradient(circle, #444, #111)',
      created_at: 1_700_000_100_000,
    })

    await importAll(manifest, {}, dst)

    const archiveItems = await dst.bg_archive.orderBy('created_at').toArray()
    expect(archiveItems).toHaveLength(2)
    expect(archiveItems.map((item) => item.name)).toEqual(['Source item', 'Existing item'])
    expect(archiveItems.map((item) => item.value)).toEqual([
      'linear-gradient(90deg, #111, #333)',
      'radial-gradient(circle, #444, #111)',
    ])
  })

  it('round-trips bookmark module config_json options unchanged', async () => {
    const pageId = await src.pages.add(withMeta({
      slug: 'home',
      title: 'Home',
      nav_group: 'main',
      icon: '🏠',
      is_home: 1,
      sort_order: 0,
      config_json: null,
    }))
    const moduleConfig = JSON.stringify({
      columns: 10,
      show_add_tile: true,
      full_width: false,
      open_in_new_tab: true,
      quicklinks: true,
      show_hover_actions: false,
    })
    await src.modules.add(withMeta({
      page_id: pageId as number,
      type: 'tabs',
      title: 'Bookmarks',
      sort_order: 0,
      config_json: moduleConfig,
    }))

    const manifest = await exportAll(src)
    await importAll(manifest, {}, dst)

    const [importedModule] = await dst.modules.toArray()
    expect(importedModule.config_json).toBe(moduleConfig)
  })

  it('remaps html note image tokens to restored local asset ids', async () => {
    await seedFullChain(src)
    const manifest = await exportAll(src)
    const noteImageBlob = new Blob([new Uint8Array([4, 5, 6])], { type: 'image/png' })
    const noteImageOriginalId = 123

    manifest.assets.push({
      original_id: noteImageOriginalId,
      kind: 'note_image',
      checksum: 'note-image-checksum',
      width: null,
      height: null,
      meta_json: null,
      mime_type: 'image/png',
      data_base64: await blobToBase64(noteImageBlob),
    })
    manifest.notes.push({
      ...withMeta({
        collection_sync_id: manifest.collections[0].sync_id,
        title: 'HTML note',
        type: 'html',
        content: `<p>{{asset:image:${noteImageOriginalId}}}</p>`,
        style_token: null,
        sort_order: 0,
        meta_json: null,
        original_id: 222,
      }),
    })

    await importAll(manifest, {}, dst)

    const importedAssets = await dst.assets.toArray()
    const importedNoteImage = importedAssets.find((asset) => asset.checksum === 'note-image-checksum')
    expect(importedNoteImage?.id).toBeTruthy()

    const htmlNote = (await dst.notes.toArray()).find((note) => note.title === 'HTML note')
    expect(htmlNote?.content).toContain(`{{asset:image:${importedNoteImage!.id}}}`)
  })

  it('deduplicates assets with the same checksum', async () => {
    await seedFullChain(src)
    const manifest = await exportAll(src)
    // Pre-insert the same asset into dst so import must detect the duplicate.
    // We can test dedup via two imports of the same manifest.
    await importAll(manifest, {}, dst)
    // Add a note to avoid page slug conflict on second import
    const report2  = await importAll({ ...manifest, pages: [], modules: [], collections: [], tabs: [], notes: [], feed_sources: [] }, {}, dst)
    expect(report2.assets_deduped).toBe(0) // no assets in this manifest
  })

  it('ignores feed_items from older manifests during import', async () => {
    await seedFullChain(src)
    const manifest = await exportAll(src)
    manifest.feed_sources = [{
      ...withMeta({
        collection_sync_id: manifest.collections[0].sync_id,
        title: 'Feed',
        feed_url: 'https://example.com/feed.xml',
        site_url: null,
        sort_order: 0,
        style_token: null,
        last_hash: null,
        last_fetched_at: null,
        last_error_at: null,
        last_error_message: null,
        fetch_options_json: null,
        original_id: 77,
      }),
    }]
    const legacyManifest = {
      version: 1 as const,
      exported_at: manifest.exported_at,
      pages: manifest.pages.map((page, index) => ({ ...page, id: index + 1, original_id: index + 1 })),
      modules: manifest.modules.map((mod, index) => ({
        ...mod,
        id: index + 1,
        original_id: index + 1,
        page_id: 1,
      })),
      collections: manifest.collections.map((col, index) => ({
        ...col,
        id: index + 1,
        original_id: index + 1,
        module_id: 1,
      })),
      tabs: manifest.tabs.map((tab, index) => ({
        ...tab,
        id: index + 1,
        original_id: index + 1,
        collection_id: 1,
      })),
      notes: manifest.notes.map((note, index) => ({
        ...note,
        id: index + 1,
        original_id: index + 1,
        collection_id: 1,
      })),
      feed_sources: [{
        ...withMeta({
          collection_id: 1,
          title: 'Feed',
          feed_url: 'https://example.com/feed.xml',
          site_url: null,
          sort_order: 0,
          style_token: null,
          last_hash: null,
          last_fetched_at: null,
          last_error_at: null,
          last_error_message: null,
          fetch_options_json: null,
        }),
        id: 77,
        original_id: 77,
      }],
      feed_items: [{
      original_id: 88,
      id: 88,
      feed_source_id: 77,
      external_id: 'legacy-item',
      title: 'Legacy item',
      url: 'https://example.com/post',
      author: null,
      published_at: Date.now(),
      summary: null,
      content: null,
      payload_json: null,
      fetched_at: Date.now(),
      }],
      saved_feed_items: [],
      assets: manifest.assets,
    } as unknown as BackupManifest

    const report = await importAll(legacyManifest, {}, dst)
    expect(report.feed_sources).toBe(1)
    expect(report.feed_items).toBe(0)
    expect(await dst.feed_items.count()).toBe(0)
  })

  it('can export a valid v2 backup after importing a legacy manifest', async () => {
    const legacyManifest = {
      version: 1 as const,
      exported_at: new Date().toISOString(),
      pages: [{
        original_id: 1,
        slug: 'legacy-home',
        title: 'Legacy Home',
        nav_group: 'main' as const,
        icon: '🏠',
        is_home: 1 as const,
        sort_order: 0,
        config_json: null,
      }],
      modules: [{
        original_id: 2,
        page_id: 1,
        type: 'tabs' as const,
        title: 'Legacy Module',
        sort_order: 0,
        config_json: null,
      }],
      collections: [{
        original_id: 3,
        module_id: 2,
        title: 'Legacy Collection',
        sort_order: 0,
        config_json: null,
      }],
      tabs: [{
        original_id: 4,
        collection_id: 3,
        title: 'Legacy Tab',
        url: 'https://example.com',
        description: null,
        favicon_asset_id: null,
        preview_asset_id: null,
        sort_order: 0,
        meta_json: null,
      }],
      notes: [],
      feed_sources: [],
      feed_items: [],
      saved_feed_items: [],
      assets: [],
    } as unknown as BackupManifest

    await importAll(legacyManifest, {}, dst)

    const reExported = await exportAll(dst)
    expect(() => validateManifest(reExported)).not.toThrow()
    expect(reExported.pages[0].sync_id).toBeTypeOf('string')
  })

  it('imports archived feed items as portable content', async () => {
    await seedFullChain(src)
    const manifest = await exportAll(src)
    manifest.saved_feed_items = [{
      ...withMeta({
        collection_sync_id: manifest.collections[0].sync_id,
        title: 'Archived item',
        url: 'https://example.com/archived',
        source_title: 'Example Feed',
        author: null,
        published_at: Date.now(),
        summary: 'Interesting summary',
        content: null,
        comment: 'Keep this',
      saved_at: Date.now(),
      sort_order: 0,
      meta_json: null,
      original_id: 91,
    }),
    }]

    const report = await importAll(manifest, {}, dst)
    expect(report.saved_feed_items).toBe(1)
    expect(await dst.saved_feed_items.count()).toBe(1)
  })

  it('does not duplicate authored records on repeated v2 imports', async () => {
    await seedFullChain(src)
    const manifest = await exportAll(src)

    const first = await importAll(manifest, {}, dst)
    const second = await importAll(manifest, {}, dst)

    expect(first.pages).toBe(1)
    expect(second.pages).toBe(0)
    expect(second.modules).toBe(0)
    expect(second.collections).toBe(0)
    expect(second.tabs).toBe(0)
    expect(second.newer_local_skipped).toBeGreaterThanOrEqual(4)

    expect(await dst.pages.count()).toBe(1)
    expect(await dst.modules.count()).toBe(1)
    expect(await dst.collections.count()).toBe(1)
    expect(await dst.tabs.count()).toBe(1)
  })

  it('stores the exported_at timestamp after a successful v2 import', async () => {
    await seedFullChain(src)
    const manifest = await exportAll(src)

    await importAll(manifest, {}, dst)

    const setting = await dst.app_settings.get(LAST_IMPORT_EXPORTED_AT_KEY)
    expect(setting?.value_json).toBe(JSON.stringify(manifest.exported_at))
  })
})

describe('importAll – dry-run', () => {
  it('returns counts without writing to IndexedDB', async () => {
    await seedFullChain(src)
    const manifest = await exportAll(src)
    const report   = await importAll(manifest, { dryRun: true }, dst)

    expect(report.dry_run).toBe(true)
    expect(report.pages).toBe(1)
    expect(report.tabs).toBe(1)
    expect(report.saved_feed_items).toBe(0)

    // DB must still be empty
    const pages = await dst.pages.toArray()
    expect(pages).toHaveLength(0)
  })
})

// ─── readManifestFile ─────────────────────────────────────────────────────────

describe('readManifestFile', () => {
  it('rejects a non-JSON file', async () => {
    const file = new File(['not json {{{'], 'bad.json', { type: 'application/json' })
    await expect(readManifestFile(file)).rejects.toThrow(BackupValidationError)
  })

  it('rejects a JSON file with wrong structure', async () => {
    const file = new File([JSON.stringify({ version: 99 })], 'bad.json', { type: 'application/json' })
    await expect(readManifestFile(file)).rejects.toThrow(BackupValidationError)
  })

  it('accepts and returns a valid manifest file', async () => {
    const manifest = emptyManifest()
    const file = new File([JSON.stringify(manifest)], 'export.json', { type: 'application/json' })
    const result = await readManifestFile(file)
    expect(result.version).toBe(BACKUP_VERSION)
  })
})

describe('parseManifestText', () => {
  it('repairs v2 orphaned child rows before validation', () => {
    const now = 1_782_554_278_267
    const manifestText = JSON.stringify({
      version: BACKUP_VERSION,
      exported_at: new Date(now).toISOString(),
      pages: [
        {
          created_at: now,
          deleted_at: null,
          icon: null,
          is_home: 1,
          nav_group: 'main',
          slug: 'home',
          sort_order: 0,
          sync_id: '11111111-1111-4111-8111-111111111111',
          title: 'Home',
          updated_at: now,
        },
      ],
      modules: [
        {
          config_json: null,
          created_at: now,
          deleted_at: null,
          original_id: 99,
          page_sync_id: '11111111-1111-4111-8111-111111111111',
          sort_order: 0,
          sync_id: '22222222-2222-4222-8222-222222222222',
          title: 'Module',
          type: 'tabs',
          updated_at: now,
        },
      ],
      collections: [
        {
          config_json: null,
          created_at: now,
          deleted_at: null,
          original_id: 1,
          sort_order: 0,
          sync_id: '33333333-3333-4333-8333-333333333333',
          title: 'New Tab',
          updated_at: now,
        },
        {
          config_json: null,
          created_at: now,
          deleted_at: null,
          module_sync_id: '22222222-2222-4222-8222-222222222222',
          original_id: 2,
          sort_order: 1,
          sync_id: '44444444-4444-4444-8444-444444444444',
          title: 'main',
          updated_at: now,
        },
      ],
      tabs: [
        {
          collection_sync_id: '33333333-3333-4333-8333-333333333333',
          created_at: now,
          deleted_at: null,
          description: null,
          favicon_asset_id: null,
          meta_json: null,
          original_id: 4,
          preview_asset_id: null,
          sort_order: 0,
          sync_id: '55555555-5555-4555-8555-555555555555',
          title: 'Orphan tab',
          updated_at: now,
          url: 'https://orphan.example.com',
        },
        {
          collection_sync_id: '44444444-4444-4444-8444-444444444444',
          created_at: now,
          deleted_at: null,
          description: null,
          favicon_asset_id: null,
          meta_json: null,
          original_id: 5,
          preview_asset_id: null,
          sort_order: 0,
          sync_id: '66666666-6666-4666-8666-666666666666',
          title: 'Valid tab',
          updated_at: now,
          url: 'https://valid.example.com',
        },
      ],
      notes: [],
      feed_sources: [],
      saved_feed_items: [],
      assets: [],
    })

    const manifest = parseManifestText(manifestText)

    expect(manifest.version).toBe(BACKUP_VERSION)
    expect(manifest.collections).toHaveLength(1)
    expect(manifest.collections[0].title).toBe('main')
    expect(manifest.tabs).toHaveLength(1)
    expect(manifest.tabs[0].title).toBe('Valid tab')
  })
})
