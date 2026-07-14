import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('../../db/db', async (importOriginal) => {
  const actual = await importOriginal() as any
  const {IDBFactory, IDBKeyRange} = await import('fake-indexeddb')
  const testDb = new actual.SpeedtabDB({indexedDB: new IDBFactory(), IDBKeyRange})
  return {
    ...actual,
    db: testDb,
  }
})

import {db as testDb} from '../../db/db'
import {
  CLOCK_TOOLS_STATE_KEY,
  createDefaultClockToolsState,
  getStopwatchElapsedMs,
  hasRunningClockTools,
  loadClockToolsState,
  normalizeClockToolsState,
  saveClockToolsState,
} from '../data/clock-tools.js'

beforeEach(async () => {
  await testDb.open()
})

afterEach(async () => {
  await testDb.app_settings.clear()
  await testDb.close()
})

describe('normalizeClockToolsState', () => {
  it('returns defaults for malformed input', () => {
    expect(normalizeClockToolsState(null)).toEqual(createDefaultClockToolsState())
  })

  it('expires overdue running timers on read', () => {
    const now = 50_000
    const state = normalizeClockToolsState({
      stopwatch: {running: false, started_at: null, elapsed_ms: 0},
      timers: [{
        id: 'timer-1',
        label: 'Tea',
        duration_ms: 5_000,
        state: 'running',
        created_at: 1,
        started_at: 10_000,
        end_at: 20_000,
        remaining_ms: 5_000,
      }],
    }, now)

    expect(state.timers).toHaveLength(1)
    expect(state.timers[0].state).toBe('expired')
    expect(state.timers[0].remaining_ms).toBe(0)
    expect(state.timers[0].expired_at).toBe(20_000)
  })

  it('preserves paused timers and clamps invalid values', () => {
    const state = normalizeClockToolsState({
      timers: [{
        id: 'timer-2',
        label: 'Break',
        duration_ms: 120_000,
        state: 'paused',
        created_at: 1,
        remaining_ms: 9_999_999,
      }],
    })

    expect(state.timers[0].state).toBe('paused')
    expect(state.timers[0].remaining_ms).toBe(120_000)
    expect(state.timers[0].expired_at).toBeNull()
  })

  it('preserves explicit expired timestamps for expired timers', () => {
    const state = normalizeClockToolsState({
      timers: [{
        id: 'timer-4',
        label: 'Laundry',
        duration_ms: 900_000,
        state: 'expired',
        created_at: 1,
        expired_at: 123_456,
        remaining_ms: 0,
      }],
    }, 200_000)

    expect(state.timers[0].state).toBe('expired')
    expect(state.timers[0].expired_at).toBe(123_456)
  })

  it('assigns current time when expired timers have no expired_at metadata', () => {
    const now = 222_000
    const state = normalizeClockToolsState({
      timers: [{
        id: 'timer-5',
        label: 'Pasta',
        duration_ms: 60_000,
        state: 'expired',
        created_at: 1,
        remaining_ms: 0,
      }],
    }, now)

    expect(state.timers[0].expired_at).toBe(now)
  })
})

describe('getStopwatchElapsedMs', () => {
  it('adds current run delta when stopwatch is running', () => {
    const elapsed = getStopwatchElapsedMs({
      running: true,
      started_at: 1_000,
      elapsed_ms: 2_000,
    }, 4_500)

    expect(elapsed).toBe(5_500)
  })
})

describe('clock tools persistence', () => {
  it('stores normalized state in app_settings', async () => {
    await saveClockToolsState({
      schemaVersion: 1,
      stopwatch: {running: false, started_at: null, elapsed_ms: 3_000},
      timers: [{
        id: 'timer-3',
        label: 'Focus',
        duration_ms: 600_000,
        state: 'paused',
        created_at: 1,
        remaining_ms: 300_000,
      }],
    })

    const row = await testDb.app_settings.get(CLOCK_TOOLS_STATE_KEY)
    expect(row).toBeTruthy()
    const parsed = JSON.parse(row!.value_json!)
    expect(parsed.stopwatch.elapsed_ms).toBe(3_000)
    expect(parsed.timers).toHaveLength(1)
    expect(parsed.timers[0].expired_at).toBeNull()
  })

  it('persists expired_at for expired timers across save and load', async () => {
    await saveClockToolsState({
      schemaVersion: 1,
      stopwatch: {running: false, started_at: null, elapsed_ms: 0},
      timers: [{
        id: 'timer-6',
        label: 'Bread',
        duration_ms: 180_000,
        state: 'expired',
        created_at: 1,
        expired_at: 77_000,
        remaining_ms: 0,
      }],
    })

    const state = await loadClockToolsState(100_000)
    expect(state.timers).toHaveLength(1)
    expect(state.timers[0].state).toBe('expired')
    expect(state.timers[0].expired_at).toBe(77_000)
  })

  it('loads defaults when no state exists', async () => {
    const state = await loadClockToolsState()
    expect(state).toEqual(createDefaultClockToolsState())
  })

  it('detects active running state', () => {
    expect(hasRunningClockTools(createDefaultClockToolsState())).toBe(false)
    expect(hasRunningClockTools({
      ...createDefaultClockToolsState(),
      stopwatch: {running: true, started_at: 1, elapsed_ms: 0},
    })).toBe(true)
  })
})
