import { db as defaultDb, type SpeedtabDB } from '@/db/db'

export const EXPORT_STATE_KEY = 'local_export_state'
const RECENT_EXPORT_GRACE_MS = 30_000
const MAX_DIRTY_REASONS = 20

export interface LocalExportState {
  export_dirty: boolean
  export_dirty_reasons: string[]
  remote_out_of_date: boolean
  last_export_checksum: string | null
  last_exported_at: string | null
  last_export_manifest_version: number | null
  last_remote_push_checksum: string | null
  last_remote_pull_checksum: string | null
}

export const DEFAULT_LOCAL_EXPORT_STATE: LocalExportState = {
  export_dirty: false,
  export_dirty_reasons: [],
  remote_out_of_date: false,
  last_export_checksum: null,
  last_exported_at: null,
  last_export_manifest_version: null,
  last_remote_push_checksum: null,
  last_remote_pull_checksum: null,
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
}

function normalizeExportState(valueJson: string | null | undefined): LocalExportState {
  if (!valueJson) return { ...DEFAULT_LOCAL_EXPORT_STATE }

  try {
    const parsed = JSON.parse(valueJson) as Record<string, unknown>
    return {
      export_dirty: parsed.export_dirty === true,
      export_dirty_reasons: normalizeStringArray(parsed.export_dirty_reasons).slice(0, MAX_DIRTY_REASONS),
      remote_out_of_date: parsed.remote_out_of_date === true,
      last_export_checksum: typeof parsed.last_export_checksum === 'string' ? parsed.last_export_checksum : null,
      last_exported_at: typeof parsed.last_exported_at === 'string' ? parsed.last_exported_at : null,
      last_export_manifest_version: typeof parsed.last_export_manifest_version === 'number' ? parsed.last_export_manifest_version : null,
      last_remote_push_checksum: typeof parsed.last_remote_push_checksum === 'string' ? parsed.last_remote_push_checksum : null,
      last_remote_pull_checksum: typeof parsed.last_remote_pull_checksum === 'string' ? parsed.last_remote_pull_checksum : null,
    }
  } catch {
    return { ...DEFAULT_LOCAL_EXPORT_STATE }
  }
}

async function writeExportState(
  nextState: LocalExportState,
  database: SpeedtabDB = defaultDb,
): Promise<LocalExportState> {
  await database.app_settings.put({
    key: EXPORT_STATE_KEY,
    value_json: JSON.stringify(nextState),
    updated_at: Date.now(),
  })
  return nextState
}

export async function getExportState(database: SpeedtabDB = defaultDb): Promise<LocalExportState> {
  const setting = await database.app_settings.get(EXPORT_STATE_KEY)
  return normalizeExportState(setting?.value_json)
}

export async function markExportDirty(reason: string, database: SpeedtabDB = defaultDb): Promise<LocalExportState> {
  const current = await getExportState(database)
  const nextReasons = current.export_dirty_reasons.includes(reason)
    ? current.export_dirty_reasons
    : [...current.export_dirty_reasons, reason].slice(-MAX_DIRTY_REASONS)

  return writeExportState({
    ...current,
    export_dirty: true,
    export_dirty_reasons: nextReasons,
    remote_out_of_date: true,
  }, database)
}

export async function clearExportDirty(
  metadata: {
    checksum: string
    exportedAt: string
    manifestVersion: number
  },
  database: SpeedtabDB = defaultDb,
): Promise<LocalExportState> {
  const current = await getExportState(database)
  return writeExportState({
    ...current,
    export_dirty: false,
    export_dirty_reasons: [],
    last_export_checksum: metadata.checksum,
    last_exported_at: metadata.exportedAt,
    last_export_manifest_version: metadata.manifestVersion,
  }, database)
}

export async function markRemoteOutOfDate(database: SpeedtabDB = defaultDb): Promise<LocalExportState> {
  const current = await getExportState(database)
  if (current.remote_out_of_date) return current
  return writeExportState({
    ...current,
    remote_out_of_date: true,
  }, database)
}

export async function clearRemoteOutOfDate(
  metadata: {
    pushChecksum?: string | null
    pullChecksum?: string | null
  } = {},
  database: SpeedtabDB = defaultDb,
): Promise<LocalExportState> {
  const current = await getExportState(database)
  return writeExportState({
    ...current,
    remote_out_of_date: false,
    last_remote_push_checksum: metadata.pushChecksum ?? current.last_remote_push_checksum,
    last_remote_pull_checksum: metadata.pullChecksum ?? current.last_remote_pull_checksum,
  }, database)
}

export async function noteImportedWorkspace(reason: string, database: SpeedtabDB = defaultDb): Promise<LocalExportState> {
  const current = await getExportState(database)
  return writeExportState({
    ...current,
    export_dirty: false,
    export_dirty_reasons: [],
    remote_out_of_date: reason === 'import:local',
  }, database)
}

export function shouldWarnBeforeUnload(state: LocalExportState, now = Date.now()): boolean {
  if (!state.export_dirty) return false
  if (!state.last_exported_at) return true

  const lastExportMillis = Date.parse(state.last_exported_at)
  if (Number.isNaN(lastExportMillis)) return true
  return now - lastExportMillis > RECENT_EXPORT_GRACE_MS
}

export function summarizeExportDirtyReasons(reasons: string[]): string {
  const labels = Array.from(new Set(reasons.map((reason) => reason.split(':', 1)[0]).filter(Boolean)))
  return labels.join(', ')
}

export function parseStoredExportState(valueJson: string | null | undefined): LocalExportState {
  return normalizeExportState(valueJson)
}
