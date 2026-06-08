import 'fake-indexeddb/auto'

import { SpeedtabDB } from '@/db/db'
import {
  clearExportDirty,
  clearRemoteOutOfDate,
  getExportState,
  markExportDirty,
  noteImportedWorkspace,
  parseStoredExportState,
  shouldWarnBeforeUnload,
} from './useExportState'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

describe('useExportState', () => {
  let db: SpeedtabDB

  beforeEach(async () => {
    db = new SpeedtabDB()
    await db.open()
  })

  afterEach(async () => {
    await db.delete()
  })

  it('marks export and remote state dirty with deduped reasons', async () => {
    await markExportDirty('notes:update', db)
    await markExportDirty('notes:update', db)
    await markExportDirty('tabs:create', db)

    const state = await getExportState(db)
    expect(state.export_dirty).toBe(true)
    expect(state.remote_out_of_date).toBe(true)
    expect(state.export_dirty_reasons).toEqual(['notes:update', 'tabs:create'])
  })

  it('clears export dirty state after a successful export', async () => {
    await markExportDirty('pages:update', db)
    await clearExportDirty({
      checksum: 'checksum-123',
      exportedAt: '2026-06-01T10:00:00.000Z',
      manifestVersion: 2,
    }, db)

    const state = await getExportState(db)
    expect(state.export_dirty).toBe(false)
    expect(state.export_dirty_reasons).toEqual([])
    expect(state.last_export_checksum).toBe('checksum-123')
    expect(state.last_exported_at).toBe('2026-06-01T10:00:00.000Z')
    expect(state.last_export_manifest_version).toBe(2)
  })

  it('does not treat local import as unsaved local edits', async () => {
    await noteImportedWorkspace('import:local', db)

    const state = await getExportState(db)
    expect(state.export_dirty).toBe(false)
    expect(state.remote_out_of_date).toBe(true)
    expect(state.export_dirty_reasons).toEqual([])
  })

  it('does not warn after a remote pull with no further local edits', async () => {
    await noteImportedWorkspace('import:remote', db)

    const state = await getExportState(db)
    expect(state.export_dirty).toBe(false)
    expect(state.remote_out_of_date).toBe(false)
    expect(shouldWarnBeforeUnload(state)).toBe(false)
  })

  it('clears remote out-of-date state independently', async () => {
    await markExportDirty('tabs:update', db)
    await clearRemoteOutOfDate({ pushChecksum: 'remote-abc' }, db)

    const state = await getExportState(db)
    expect(state.export_dirty).toBe(true)
    expect(state.remote_out_of_date).toBe(false)
    expect(state.last_remote_push_checksum).toBe('remote-abc')
  })

  it('suppresses beforeunload warnings right after a recent export', () => {
    const recent = parseStoredExportState(JSON.stringify({
      export_dirty: true,
      last_exported_at: '2026-06-01T10:00:00.000Z',
    }))

    expect(shouldWarnBeforeUnload(recent, Date.parse('2026-06-01T10:00:20.000Z'))).toBe(false)
    expect(shouldWarnBeforeUnload(recent, Date.parse('2026-06-01T10:00:31.000Z'))).toBe(true)
  })
})
