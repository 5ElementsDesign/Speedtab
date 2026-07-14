import {db} from '../../db/db.ts'

export const CLOCK_TOOLS_STATE_KEY = 'clock_tools_state'
export const CLOCK_TOOLS_SCHEMA_VERSION = 1

export function createDefaultClockToolsState() {
  return {
    schemaVersion: CLOCK_TOOLS_SCHEMA_VERSION,
    stopwatch: {
      running: false,
      started_at: null,
      elapsed_ms: 0,
    },
    timers: [],
  }
}

function clampMs(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return Math.round(parsed)
}

function normalizeStopwatch(raw = {}) {
  const running = raw?.running === true
  const elapsedMs = clampMs(raw?.elapsed_ms)
  const startedAt = Number.isFinite(Number(raw?.started_at)) ? Number(raw.started_at) : null

  return {
    running: running && startedAt !== null,
    started_at: running && startedAt !== null ? startedAt : null,
    elapsed_ms: elapsedMs,
  }
}

function normalizeTimer(raw = {}, now = Date.now()) {
  const durationMs = clampMs(raw?.duration_ms)
  const createdAt = Number.isFinite(Number(raw?.created_at)) ? Number(raw.created_at) : now
  const label = typeof raw?.label === 'string' ? raw.label.trim() : ''
  const id = typeof raw?.id === 'string' && raw.id.trim() ? raw.id.trim() : crypto.randomUUID()
  const parsedStartedAt = Number.isFinite(Number(raw?.started_at)) ? Number(raw.started_at) : null
  const parsedEndAt = Number.isFinite(Number(raw?.end_at)) ? Number(raw.end_at) : null
  const parsedExpiredAt = Number.isFinite(Number(raw?.expired_at)) ? Number(raw.expired_at) : null
  const parsedRemaining = clampMs(raw?.remaining_ms)
  const rawState = typeof raw?.state === 'string' ? raw.state : 'paused'

  if (durationMs <= 0) return null

  if (rawState === 'running' && parsedEndAt !== null) {
    const remainingMs = clampMs(parsedEndAt - now)
    if (remainingMs <= 0) {
      return {
        id,
        label,
        duration_ms: durationMs,
        state: 'expired',
        created_at: createdAt,
        started_at: null,
        end_at: null,
        expired_at: parsedEndAt ?? now,
        remaining_ms: 0,
      }
    }

    return {
      id,
      label,
      duration_ms: durationMs,
      state: 'running',
      created_at: createdAt,
      started_at: parsedStartedAt,
      end_at: parsedEndAt,
      expired_at: null,
      remaining_ms: remainingMs,
    }
  }

  if (rawState === 'expired') {
    return {
      id,
      label,
      duration_ms: durationMs,
      state: 'expired',
      created_at: createdAt,
      started_at: null,
      end_at: null,
      expired_at: parsedExpiredAt ?? parsedEndAt ?? now,
      remaining_ms: 0,
    }
  }

  return {
    id,
    label,
    duration_ms: durationMs,
    state: 'paused',
    created_at: createdAt,
    started_at: null,
    end_at: null,
    expired_at: null,
    remaining_ms: Math.min(parsedRemaining || durationMs, durationMs),
  }
}

export function normalizeClockToolsState(raw, now = Date.now()) {
  const defaults = createDefaultClockToolsState()
  const candidate = raw && typeof raw === 'object' ? raw : {}

  return {
    schemaVersion: CLOCK_TOOLS_SCHEMA_VERSION,
    stopwatch: normalizeStopwatch(candidate.stopwatch),
    timers: Array.isArray(candidate.timers)
      ? candidate.timers
        .map((timer) => normalizeTimer(timer, now))
        .filter(Boolean)
      : defaults.timers,
  }
}

export function getStopwatchElapsedMs(stopwatch = {}, now = Date.now()) {
  const elapsedMs = clampMs(stopwatch?.elapsed_ms)
  const startedAt = Number.isFinite(Number(stopwatch?.started_at)) ? Number(stopwatch.started_at) : null
  if (stopwatch?.running !== true || startedAt === null) return elapsedMs
  return elapsedMs + Math.max(0, now - startedAt)
}

export function hasRunningClockTools(state = createDefaultClockToolsState()) {
  if (state?.stopwatch?.running === true) return true
  return Array.isArray(state?.timers) && state.timers.some((timer) => timer?.state === 'running')
}

export async function loadClockToolsState(now = Date.now()) {
  const row = await db.app_settings.get(CLOCK_TOOLS_STATE_KEY)
  if (!row?.value_json) return createDefaultClockToolsState()

  try {
    return normalizeClockToolsState(JSON.parse(row.value_json), now)
  } catch {
    return createDefaultClockToolsState()
  }
}

export async function saveClockToolsState(state) {
  const normalized = normalizeClockToolsState(state)
  await db.app_settings.put({
    key: CLOCK_TOOLS_STATE_KEY,
    value_json: JSON.stringify(normalized),
    updated_at: Date.now(),
  })
  return normalized
}
