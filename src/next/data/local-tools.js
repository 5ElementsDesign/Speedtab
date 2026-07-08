import {db} from '../../db/db.ts'

const LOCAL_TOOLS_STATE_KEY = 'local_tools_state'

const DEFAULT_QUICKNOTE_STATE = {
  open: false,
  content: '',
  x: 268,
  y: 48,
  width: 376,
  height: 263,
  z: 221,
}

const DEFAULT_NOTE_WINDOW_STATE = {
  noteId: null,
  x: 40,
  y: 72,
  width: 420,
  height: 320,
  z: 221,
  autoHeight: false,
  autoWidth: false,
}

const NOTE_MIN_HEIGHT = 96

const DEFAULT_LOCAL_TOOLS_STATE = {
  zIndexTracker: 220,
  quicknote: {...DEFAULT_QUICKNOTE_STATE},
  noteWindows: [],
  noteLayouts: [],
  noteTabStates: [],
}

function toFiniteNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeQuicknoteState(source = {}) {
  return {
    open: source.open === true,
    content: typeof source.content === 'string' ? source.content : DEFAULT_QUICKNOTE_STATE.content,
    x: Math.max(0, toFiniteNumber(source.x, DEFAULT_QUICKNOTE_STATE.x)),
    y: Math.max(0, toFiniteNumber(source.y, DEFAULT_QUICKNOTE_STATE.y)),
    width: Math.max(240, toFiniteNumber(source.width, DEFAULT_QUICKNOTE_STATE.width)),
    height: Math.max(140, toFiniteNumber(source.height, DEFAULT_QUICKNOTE_STATE.height)),
    z: Math.max(1, toFiniteNumber(source.z, DEFAULT_QUICKNOTE_STATE.z)),
  }
}

function normalizeNoteWindowState(source = {}) {
  const noteId = toFiniteNumber(source.noteId, null)
  if (!Number.isInteger(noteId) || noteId <= 0) return null

  return {
    noteId,
    x: Math.max(0, toFiniteNumber(source.x, DEFAULT_NOTE_WINDOW_STATE.x)),
    y: Math.max(0, toFiniteNumber(source.y, DEFAULT_NOTE_WINDOW_STATE.y)),
    width: Math.max(280, toFiniteNumber(source.width, DEFAULT_NOTE_WINDOW_STATE.width)),
    height: Math.max(NOTE_MIN_HEIGHT, toFiniteNumber(source.height, DEFAULT_NOTE_WINDOW_STATE.height)),
    z: Math.max(1, toFiniteNumber(source.z, DEFAULT_NOTE_WINDOW_STATE.z)),
    autoHeight: source.autoHeight === true,
    autoWidth: source.autoWidth === true,
  }
}

function normalizeNoteLayoutState(source = {}) {
  const noteId = toFiniteNumber(source.noteId, null)
  if (!Number.isInteger(noteId) || noteId <= 0) return null

  return {
    noteId,
    x: Math.max(0, toFiniteNumber(source.x, DEFAULT_NOTE_WINDOW_STATE.x)),
    y: Math.max(0, toFiniteNumber(source.y, DEFAULT_NOTE_WINDOW_STATE.y)),
    width: Math.max(280, toFiniteNumber(source.width, DEFAULT_NOTE_WINDOW_STATE.width)),
    height: Math.max(NOTE_MIN_HEIGHT, toFiniteNumber(source.height, DEFAULT_NOTE_WINDOW_STATE.height)),
    z: Math.max(1, toFiniteNumber(source.z, DEFAULT_NOTE_WINDOW_STATE.z)),
  }
}

function normalizeNoteTabEntry(source = {}) {
  if (!source || typeof source !== 'object') return null
  const path = typeof source.path === 'string' ? source.path.trim() : ''
  const lastActive = typeof source.lastActive === 'string' ? source.lastActive.trim() : ''
  if (!path || !lastActive) return null
  return {path, lastActive}
}

function normalizeNoteTabState(source = {}) {
  const noteId = toFiniteNumber(source.noteId, null)
  if (!Number.isInteger(noteId) || noteId <= 0) return null

  return {
    noteId,
    tabs: Array.isArray(source.tabs)
      ? source.tabs.map((entry) => normalizeNoteTabEntry(entry)).filter(Boolean)
      : [],
  }
}

export function normalizeLocalToolsState(source = {}) {
  return {
    zIndexTracker: Math.max(
      DEFAULT_LOCAL_TOOLS_STATE.zIndexTracker,
      toFiniteNumber(source.zIndexTracker, DEFAULT_LOCAL_TOOLS_STATE.zIndexTracker),
    ),
    quicknote: normalizeQuicknoteState(source.quicknote),
    noteWindows: Array.isArray(source.noteWindows)
      ? source.noteWindows
        .map((entry) => normalizeNoteWindowState(entry))
        .filter(Boolean)
      : [],
    noteLayouts: Array.isArray(source.noteLayouts)
      ? source.noteLayouts
        .map((entry) => normalizeNoteLayoutState(entry))
        .filter(Boolean)
      : [],
    noteTabStates: Array.isArray(source.noteTabStates)
      ? source.noteTabStates
        .map((entry) => normalizeNoteTabState(entry))
        .filter(Boolean)
      : [],
  }
}

export async function loadLocalToolsState() {
  const row = await db.app_settings.get(LOCAL_TOOLS_STATE_KEY)
  if (!row?.value_json) return normalizeLocalToolsState(DEFAULT_LOCAL_TOOLS_STATE)

  try {
    return normalizeLocalToolsState(JSON.parse(row.value_json))
  } catch {
    return normalizeLocalToolsState(DEFAULT_LOCAL_TOOLS_STATE)
  }
}

export async function saveLocalToolsState(state) {
  const normalized = normalizeLocalToolsState(state)
  await db.app_settings.put({
    key: LOCAL_TOOLS_STATE_KEY,
    value_json: JSON.stringify(normalized),
    updated_at: Date.now(),
  })
  return normalized
}
