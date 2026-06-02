import type { Note } from '@/types/db'
import { computed, reactive } from 'vue'

export interface OpenNoteWindow {
  noteId: number
  zIndex: number
  x: number
  y: number
  width: number | null
  height: number | null
}

const WINDOW_OFFSET_STEP = 28
const MIN_WINDOW_WIDTH = 320
const MIN_WINDOW_HEIGHT = 220
const NOTE_Z_INDEX_BASE = 70

const state = reactive<{
  windows: OpenNoteWindow[]
  currentZIndex: number
}>({
  windows: [],
  currentZIndex: NOTE_Z_INDEX_BASE,
})

function readViewportWidth() {
  return typeof window === 'undefined' ? 1280 : window.innerWidth
}

function readViewportHeight() {
  return typeof window === 'undefined' ? 800 : window.innerHeight
}

function syncBodyZIndex() {
  if (typeof document === 'undefined') return
  if (!state.windows.length) {
    delete document.body.dataset.stNoteZIndex
    return
  }
  document.body.dataset.stNoteZIndex = String(state.currentZIndex)
}

function resetZIndexIfEmpty() {
  if (state.windows.length > 0) return
  state.currentZIndex = NOTE_Z_INDEX_BASE
  syncBodyZIndex()
}

function nextZIndex() {
  state.currentZIndex += 1
  syncBodyZIndex()
  return state.currentZIndex
}

function clampWindowPosition(width: number, height: number, x: number, y: number) {
  const viewportWidth = readViewportWidth()
  const viewportHeight = readViewportHeight()
  const maxX = Math.max(12, viewportWidth - width - 12)
  const maxY = Math.max(12, viewportHeight - height - 12)

  return {
    x: Math.min(Math.max(12, x), maxX),
    y: Math.min(Math.max(12, y), maxY),
  }
}

function clampWindowSize(width: number, height: number, x: number, y: number) {
  const viewportWidth = readViewportWidth()
  const viewportHeight = readViewportHeight()
  const safeWidth = Math.max(MIN_WINDOW_WIDTH, Math.min(width, Math.max(MIN_WINDOW_WIDTH, viewportWidth - 24)))
  const safeHeight = Math.max(MIN_WINDOW_HEIGHT, Math.min(height, Math.max(MIN_WINDOW_HEIGHT, viewportHeight - 24)))
  const position = clampWindowPosition(safeWidth, safeHeight, x, y)

  return {
    width: safeWidth,
    height: safeHeight,
    x: position.x,
    y: position.y,
  }
}

function getWindow(noteId: number) {
  return state.windows.find((windowState) => windowState.noteId === noteId) ?? null
}

function isNoteOpen(noteId: number | null | undefined) {
  return typeof noteId === 'number' && !!getWindow(noteId)
}

function openNote(note: Pick<Note, 'id'>) {
  if (!note.id) return

  const existing = getWindow(note.id)
  if (existing) {
    focusNote(note.id)
    return
  }

  const index = state.windows.length
  const origin = clampWindowPosition(
    MIN_WINDOW_WIDTH,
    MIN_WINDOW_HEIGHT,
    32 + (index % 6) * WINDOW_OFFSET_STEP,
    72 + (index % 6) * WINDOW_OFFSET_STEP,
  )

  state.windows.push({
    noteId: note.id,
    zIndex: nextZIndex(),
    x: origin.x,
    y: origin.y,
    width: null,
    height: null,
  })
}

function focusNote(noteId: number) {
  const windowState = getWindow(noteId)
  if (!windowState) return
  if (windowState.zIndex >= state.currentZIndex) return
  windowState.zIndex = nextZIndex()
}

function closeNote(noteId: number) {
  const nextWindows = state.windows.filter((windowState) => windowState.noteId !== noteId)
  state.windows.splice(0, state.windows.length, ...nextWindows)
  resetZIndexIfEmpty()
}

function closeMissingNotes(noteIds: number[]) {
  const noteIdSet = new Set(noteIds)
  const nextWindows = state.windows.filter((windowState) => noteIdSet.has(windowState.noteId))
  if (nextWindows.length === state.windows.length) return
  state.windows.splice(0, state.windows.length, ...nextWindows)
  resetZIndexIfEmpty()
}

function updateWindow(noteId: number, patch: Partial<Pick<OpenNoteWindow, 'x' | 'y' | 'width' | 'height'>>) {
  const windowState = getWindow(noteId)
  if (!windowState) return

  if (patch.width == null && patch.height == null && patch.x != null && patch.y != null) {
    windowState.x = patch.x
    windowState.y = patch.y
    return
  }

  const normalized = clampWindowSize(
    patch.width ?? windowState.width ?? MIN_WINDOW_WIDTH,
    patch.height ?? windowState.height ?? MIN_WINDOW_HEIGHT,
    patch.x ?? windowState.x,
    patch.y ?? windowState.y,
  )

  windowState.x = normalized.x
  windowState.y = normalized.y
  windowState.width = normalized.width
  windowState.height = normalized.height
}

function resetOpenNotes() {
  state.windows.splice(0, state.windows.length)
  resetZIndexIfEmpty()
}

export function useOpenNotes() {
  return {
    openWindows: computed(() => state.windows),
    currentZIndex: computed(() => state.currentZIndex),
    isNoteOpen,
    openNote,
    focusNote,
    closeNote,
    closeMissingNotes,
    updateWindow,
    resetOpenNotes,
    minWindowWidth: MIN_WINDOW_WIDTH,
    minWindowHeight: MIN_WINDOW_HEIGHT,
  }
}
