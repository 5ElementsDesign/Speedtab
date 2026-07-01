import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db as testDb } from '../../db/db'

vi.mock('../../db/db', async (importOriginal) => {
  const actual = (await importOriginal()) as any
  const { IDBFactory, IDBKeyRange } = await import('fake-indexeddb')
  const testDb = new actual.SpeedtabDB({ indexedDB: new IDBFactory(), IDBKeyRange })
  return {
    ...actual,
    db: testDb,
    isActiveRecord: (r: any) => r?.deleted_at == null,
    makeCreateMetadata: (now = Date.now()) => ({ sync_id: crypto.randomUUID(), created_at: now, updated_at: now, deleted_at: null }),
    makeUpdatedAtPatch: (now = Date.now()) => ({ updated_at: now }),
  }
})

import {
    loadLocalToolsState,
    normalizeLocalToolsState,
    saveLocalToolsState,
} from '../data/local-tools.js'

beforeEach(async () => { await testDb.open() })
afterEach(async () => {
  await testDb.app_settings.clear()
  await testDb.close()
})

describe('normalizeLocalToolsState', () => {
  it('returns defaults for empty input', () => {
    const state = normalizeLocalToolsState({})
    expect(state.zIndexTracker).toBe(220)
    expect(state.quicknote.open).toBe(false)
    expect(state.quicknote.content).toBe('')
    expect(state.noteWindows).toEqual([])
    expect(state.noteLayouts).toEqual([])
  })

  it('clamps quicknote width to minimum 240', () => {
    const state = normalizeLocalToolsState({ quicknote: { width: 10 } })
    expect(state.quicknote.width).toBe(240)
  })

  it('clamps quicknote height to minimum 140', () => {
    const state = normalizeLocalToolsState({ quicknote: { height: 50 } })
    expect(state.quicknote.height).toBe(140)
  })

  it('clamps quicknote x/y to be >= 0', () => {
    const state = normalizeLocalToolsState({ quicknote: { x: -100, y: -50 } })
    expect(state.quicknote.x).toBe(0)
    expect(state.quicknote.y).toBe(0)
  })

  it('preserves valid quicknote state', () => {
    const state = normalizeLocalToolsState({
      quicknote: { open: true, content: 'hello', x: 100, y: 200, width: 400, height: 300, z: 500 },
    })
    expect(state.quicknote.open).toBe(true)
    expect(state.quicknote.content).toBe('hello')
    expect(state.quicknote.x).toBe(100)
    expect(state.quicknote.z).toBe(500)
  })

  it('uses default zIndexTracker if provided value is smaller', () => {
    const state = normalizeLocalToolsState({ zIndexTracker: 100 })
    expect(state.zIndexTracker).toBe(220) // max(220, 100) = 220
  })

  it('accepts higher zIndexTracker than default', () => {
    const state = normalizeLocalToolsState({ zIndexTracker: 500 })
    expect(state.zIndexTracker).toBe(500)
  })

  it('filters out invalid noteWindows (null noteId or noteId <= 0)', () => {
    const state = normalizeLocalToolsState({
      noteWindows: [
        { noteId: null, x: 10, y: 10, width: 400, height: 300, z: 221 },
        { noteId: -5, x: 10, y: 10, width: 400, height: 300, z: 221 },
        { noteId: 0, x: 10, y: 10, width: 400, height: 300, z: 221 },
        { noteId: 42, x: 10, y: 10, width: 400, height: 300, z: 221 },
      ],
    })
    expect(state.noteWindows).toHaveLength(1)
    expect(state.noteWindows[0].noteId).toBe(42)
  })

  it('clamps note window width to minimum 280', () => {
    const state = normalizeLocalToolsState({
      noteWindows: [{ noteId: 1, x: 0, y: 0, width: 50, height: 300, z: 221 }],
    })
    expect(state.noteWindows[0].width).toBe(280)
  })

  it('clamps note window height to minimum 180', () => {
    const state = normalizeLocalToolsState({
      noteWindows: [{ noteId: 1, x: 0, y: 0, width: 400, height: 10, z: 221 }],
    })
    expect(state.noteWindows[0].height).toBe(180)
  })

  it('filters noteLayouts the same as noteWindows', () => {
    const state = normalizeLocalToolsState({
      noteLayouts: [
        { noteId: 7, x: 0, y: 0, width: 400, height: 300, z: 221 },
        { noteId: null },
      ],
    })
    expect(state.noteLayouts).toHaveLength(1)
    expect(state.noteLayouts[0].noteId).toBe(7)
  })
})

describe('loadLocalToolsState', () => {
  it('returns defaults when no DB record exists', async () => {
    const state = await loadLocalToolsState()
    expect(state.quicknote.open).toBe(false)
    expect(state.noteWindows).toEqual([])
  })

  it('parses and normalizes stored state', async () => {
    await testDb.app_settings.put({
      key: 'local_tools_state',
      value_json: JSON.stringify({ quicknote: { open: true, content: 'draft' } }),
      updated_at: Date.now(),
    })
    const state = await loadLocalToolsState()
    expect(state.quicknote.open).toBe(true)
    expect(state.quicknote.content).toBe('draft')
  })

  it('returns defaults when stored JSON is malformed', async () => {
    await testDb.app_settings.put({
      key: 'local_tools_state',
      value_json: '{broken',
      updated_at: Date.now(),
    })
    const state = await loadLocalToolsState()
    expect(state.quicknote.open).toBe(false)
  })
})

describe('saveLocalToolsState', () => {
  it('persists state to DB and returns normalized state', async () => {
    const saved = await saveLocalToolsState({
      zIndexTracker: 300,
      quicknote: { open: true, content: 'saved note' },
      noteWindows: [],
      noteLayouts: [],
    })
    expect(saved.quicknote.open).toBe(true)
    expect(saved.quicknote.content).toBe('saved note')
    expect(saved.zIndexTracker).toBe(300)

    // Round-trip: load confirms persistence
    const loaded = await loadLocalToolsState()
    expect(loaded.quicknote.content).toBe('saved note')
  })
})
