import {decryptNote, parseCryptPayload} from '../../../composables/useCrypt.ts'
import {highlightCode} from '../../../composables/useHighlight.ts'
import {renderNoteHtmlWithAssets} from '../../../composables/useNoteImages.ts'
import {loadLocalToolsState, normalizeLocalToolsState, saveLocalToolsState} from '../../data/local-tools.js'
import {loadNoteById, loadNotesByIds, saveNoteData} from '../../data/notes.js'
import {initFavicons} from '../../utils/favicon.js'
import {t} from '../../utils/i18n.js'
import {initFormDirtyState} from '../forms/actions.js'
import {buildNotePayload} from '../modules/note-form.js'
import {getNoteAccentCssValue, getNoteBorderClass, getNoteTokenClass} from '../modules/notes-shared.js'
import {renderLocalToolsRoot} from './render.js'

const WINDOW_ROOT_ATTR = 'data-floating-windows'
const MIN_WIDTH = 240
const MIN_HEIGHT = 140
const NOTE_MIN_HEIGHT = 96

let root = null
let appRoot = null
let state = normalizeLocalToolsState()
let saveTimer = null
let session = null
let bound = false
let initialized = false
const cryptSessions = new Map()
const editorSessions = new Map()
const noteRecords = new Map()
const enteringWindowIds = new Set()
const closingWindowIds = new Set()
const WINDOW_CLOSE_ANIMATION_MS = 180
const noteHtmlRenderRevokes = new Map()
const MOBILE_NOTE_BREAKPOINT = 900

function isMobileNoteViewport() {
  return window.innerWidth <= MOBILE_NOTE_BREAKPOINT
}

function getShellTabsInstance() {
  return document.querySelector('#app')?.__nextTabsInstance ?? null
}

function syncNestedTabsInFloatingWindows(scope = null) {
  const tabs = getShellTabsInstance()
  if (!tabs || !(scope instanceof HTMLElement)) return
  tabs.initializeAllContainers(scope)
}

function getSavedNoteLayout(noteId) {
  return state.noteLayouts.find((entry) => entry.noteId === noteId) ?? null
}

function saveNoteLayout(windowState) {
  if (!windowState?.noteId) return
  const layout = {
    noteId: windowState.noteId,
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    z: windowState.z,
  }
  const existingIndex = state.noteLayouts.findIndex((entry) => entry.noteId === windowState.noteId)
  if (existingIndex === -1) {
    state.noteLayouts = [...state.noteLayouts, layout]
    return
  }
  state.noteLayouts = state.noteLayouts.map((entry, index) => (index === existingIndex ? layout : entry))
}

function getRenderableNotes(notesById) {
  return state.noteWindows.map((windowState) => ({
    ...notesById.get(windowState.noteId),
    ...windowState,
    ...cryptSessions.get(windowState.noteId),
    ...editorSessions.get(windowState.noteId),
    module_sync_id: document.querySelector(`[data-note-sync-id="${CSS.escape(notesById.get(windowState.noteId)?.sync_id ?? '')}"]`)
      ?.getAttribute?.('data-module-sync-id') ?? '',
  }))
}

function revokeAllNoteHtmlRenderers() {
  noteHtmlRenderRevokes.forEach((revoke) => {
    try {
      revoke?.()
    } catch {
      // ignore cleanup failures
    }
  })
  noteHtmlRenderRevokes.clear()
}

async function ensureCachedNotes(noteIds = []) {
  const missingIds = noteIds.filter((noteId) => !noteRecords.has(noteId))
  if (!missingIds.length) return
  const records = await loadNotesByIds(missingIds)
  records.forEach((note) => {
    if (note?.id) noteRecords.set(note.id, note)
  })
}

function removeCachedNote(noteId) {
  noteRecords.delete(noteId)
}

function getOpenNotesById() {
  return new Map(
    state.noteWindows
      .map((windowState) => [windowState.noteId, noteRecords.get(windowState.noteId)])
      .filter(([, note]) => !!note)
  )
}

function syncOpenNotePreviewState() {
  const openNoteIds = new Set(state.noteWindows.map((windowState) => String(windowState.noteId)))
  document.querySelectorAll('[data-note-id]').forEach((element) => {
    if (!(element instanceof HTMLElement)) return
    const noteId = element.dataset.noteId
    if (!noteId) return
    element.toggleAttribute('data-note-open', openNoteIds.has(noteId))
  })
}

export function refreshOpenNotePreviewState() {
  syncOpenNotePreviewState()
}

function ensureRoot() {
  const host = appRoot instanceof HTMLElement ? appRoot : document.body

  if (!root) {
    root = document.createElement('div')
    root.setAttribute(WINDOW_ROOT_ATTR, '')
  }

  if (root.parentElement !== host) {
    host.appendChild(root)
  }

  return root
}

function queueSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    saveTimer = null
    state = await saveLocalToolsState(state)
    syncZTracker()
  }, 120)
}

function syncZTracker() {
  const value = String(state.zIndexTracker ?? 220)
  document.body.dataset.windowZ = value
  appRoot?.setAttribute?.('data-window-z', value)
}

function parseWindowId(windowId) {
  if (!windowId) return {type: 'unknown', key: null}
  if (windowId === 'quicknote') return {type: 'quicknote', key: 'quicknote'}
  if (windowId.startsWith('note:')) {
    const noteId = parseInt(windowId.slice(5), 10)
    return {type: 'note', key: Number.isInteger(noteId) ? noteId : null}
  }
  return {type: 'unknown', key: null}
}

async function render({reloadNotes = false} = {}) {
  const el = ensureRoot()
  const openNoteIds = state.noteWindows.map((windowState) => windowState.noteId)
  if (reloadNotes) {
    const notes = openNoteIds.length ? await loadNotesByIds(openNoteIds) : []
    openNoteIds.forEach((noteId) => noteRecords.delete(noteId))
    notes.forEach((note) => {
      if (note?.id) noteRecords.set(note.id, note)
    })
  } else {
    await ensureCachedNotes(openNoteIds)
  }
  const notesById = getOpenNotesById()
  state.noteWindows = state.noteWindows.filter((windowState) => notesById.has(windowState.noteId))
  revokeAllNoteHtmlRenderers()
  el.innerHTML = renderLocalToolsRoot({
    ...state,
    notes: getRenderableNotes(notesById),
  })
  enteringWindowIds.forEach((windowId) => {
    const windowEl = el.querySelector(`[data-window-id="${CSS.escape(windowId)}"]`)
    if (windowEl instanceof HTMLElement) {
      windowEl.setAttribute('data-window-entering', '')
    }
  })
  el.querySelectorAll('[data-floating-note-form]').forEach((form) => {
    initFormDirtyState(form)
  })
  syncNestedTabsInFloatingWindows(el)
  initFavicons(el)
  void hydrateNoteHtmlRenders(el)
  void hydrateNoteCodeBlocks(el)
  autoFitNoteWindows(notesById)
  syncZTracker()
  syncOpenNotePreviewState()
  enteringWindowIds.clear()
}

function normalizeEditorSession(note = {}, session = {}) {
  let language = 'auto'
  try {
    const meta = note?.meta_json ? JSON.parse(note.meta_json) : {}
    if (typeof meta?.language === 'string') language = meta.language
  } catch {
    // ignore invalid meta
  }

  return {
    editMode: true,
    editTitle: session.editTitle ?? note.title ?? '',
    editContent: session.editContent ?? (note.type === 'crypt'
      ? (cryptSessions.get(note.id)?.unlockedContent ?? '')
      : (note.content ?? '')),
    editLanguage: session.editLanguage ?? language,
    editStyleToken: session.editStyleToken ?? note.style_token ?? 'primary',
    previewMode: session.previewMode ?? (note.type === 'html'),
    editError: session.editError ?? '',
  }
}

function getEditorSession(noteId) {
  return editorSessions.get(noteId) ?? null
}

function setEditorSession(noteId, patch = {}) {
  const current = editorSessions.get(noteId) ?? {}
  editorSessions.set(noteId, {
    ...current,
    ...patch,
  })
}

async function hydrateNoteCodeBlocks(container) {
  const codeBlocks = [...container.querySelectorAll('[data-note-code-block]')]
  await Promise.all(codeBlocks.map(async (block) => {
    if (!(block instanceof HTMLElement)) return
    const source = block.textContent ?? ''
    const language = block.dataset.noteCodeLanguage || 'auto'
    const html = await highlightCode(source, language)
    block.innerHTML = html
    block.classList.add('hljs')
  }))
}

async function hydrateNoteHtmlRenders(container) {
  if (!(container instanceof HTMLElement)) return
  const renders = [
    ...(container.matches?.('[data-note-html-render]') ? [container] : []),
    ...container.querySelectorAll('[data-note-html-render]'),
  ]

  await Promise.all(renders.map(async (el) => {
    if (!(el instanceof HTMLElement)) return
    const source = el.dataset.noteHtmlSource ?? ''
    const renderKey = el.dataset.noteHtmlRenderKey || ''
    const rendered = await renderNoteHtmlWithAssets(source)

    if (!el.isConnected) {
      rendered.revoke()
      return
    }

    if (renderKey) {
      const previousRevoke = noteHtmlRenderRevokes.get(renderKey)
      if (previousRevoke) {
        try {
          previousRevoke()
        } catch {
          // ignore cleanup failures
        }
      }
      noteHtmlRenderRevokes.set(renderKey, rendered.revoke)
    }

    el.innerHTML = rendered.html
    syncNestedTabsInFloatingWindows(el)
    initFavicons(el, {force: true})
  }))
}

function focusQuicknoteTextarea({moveCaretToEnd = false} = {}) {
  requestAnimationFrame(() => {
    const textarea = root?.querySelector?.('#scratchpad_content')
    if (!(textarea instanceof HTMLTextAreaElement)) return
    textarea.focus()
    if (!moveCaretToEnd) return
    const length = textarea.value.length
    textarea.setSelectionRange(length, length)
  })
}

function getWindowState(windowId) {
  const parsed = parseWindowId(windowId)
  if (parsed.type === 'quicknote') return state.quicknote
  if (parsed.type === 'note') {
    return state.noteWindows.find((entry) => entry.noteId === parsed.key) ?? null
  }
  return null
}

function getWindowMinHeight(windowIdOrState) {
  const windowId = typeof windowIdOrState === 'string'
    ? windowIdOrState
    : (windowIdOrState?.windowId || `note:${windowIdOrState?.noteId ?? ''}`)
  const parsed = parseWindowId(windowId)
  return parsed.type === 'note' ? NOTE_MIN_HEIGHT : MIN_HEIGHT
}

function setWindowState(windowId, patch = {}) {
  const parsed = parseWindowId(windowId)
  if (parsed.type === 'quicknote') {
    state.quicknote = {
      ...state.quicknote,
      ...patch,
    }
    return
  }

  if (parsed.type === 'note') {
    state.noteWindows = state.noteWindows.map((entry) => (
      entry.noteId === parsed.key
        ? (() => {
          const nextEntry = {...entry, ...patch}
          saveNoteLayout(nextEntry)
          return nextEntry
        })()
        : entry
    ))
  }
}

function getWindowElement(windowId) {
  if (!root || !windowId) return null
  return root.querySelector(`[data-window-id="${CSS.escape(windowId)}"]`)
}

function clampWindowState(windowState) {
  const parsed = parseWindowId(windowState?.windowId || `note:${windowState?.noteId ?? ''}`)
  const minHeight = getWindowMinHeight(windowState)
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const maxWidth = parsed.type === 'note'
    ? Math.max(MIN_WIDTH, viewportWidth - 80)
    : Math.max(MIN_WIDTH, viewportWidth - 16)
  const maxHeight = parsed.type === 'note'
    ? Math.max(minHeight, viewportHeight - 20)
    : Math.max(minHeight, viewportHeight - 16)
  const width = Math.max(MIN_WIDTH, Math.min(windowState.width, maxWidth))
  const height = Math.max(minHeight, Math.min(windowState.height, maxHeight))
  const x = Math.max(0, Math.min(windowState.x, Math.max(0, viewportWidth - width)))
  const y = Math.max(0, Math.min(windowState.y, Math.max(0, viewportHeight - height)))

  return {...windowState, width, height, x, y}
}

function applyWindowPatch(windowId, patch = {}, {persist = true, rerender = true} = {}) {
  const current = getWindowState(windowId)
  if (!current) return
  const nextState = clampWindowState({...current, ...patch, windowId})
  setWindowState(windowId, nextState)
  if (!rerender) {
    const windowEl = getWindowElement(windowId)
    if (windowEl instanceof HTMLElement) {
      windowEl.style.left = `${nextState.x}px`
      windowEl.style.top = `${nextState.y}px`
      windowEl.style.width = `${nextState.width}px`
      windowEl.style.height = `${nextState.height}px`
      if (Number.isFinite(nextState.z)) windowEl.style.zIndex = String(nextState.z)
    }
  }
  syncZTracker()
  if (rerender) void render()
  if (persist) queueSave()
}

function measureNoteWindowTargetSize(windowEl, viewportMaxWidth, viewportMaxHeight) {
  if (!(windowEl instanceof HTMLElement)) return null

  const clone = windowEl.cloneNode(true)
  if (!(clone instanceof HTMLElement)) return null

  clone.style.position = 'fixed'
  clone.style.left = '-10000px'
  clone.style.top = '-10000px'
  clone.style.width = 'auto'
  clone.style.height = 'auto'
  clone.style.maxWidth = 'none'
  clone.style.maxHeight = 'none'
  clone.style.visibility = 'hidden'
  clone.style.pointerEvents = 'none'

  const body = clone.querySelector('[data-note-window-body]')
  if (body instanceof HTMLElement) {
    const noteType = body.dataset.noteType || ''
    body.style.overflow = 'visible'
    body.style.maxHeight = 'none'
    body.style.height = 'auto'
    body.style.width = 'max-content'
    body.style.maxWidth = 'none'

    if (noteType === 'links') {
      body.style.whiteSpace = 'normal'
      body.querySelectorAll('.st-note-link-label, .st-note-link-copy, .st-note-link-copy p').forEach((node) => {
        if (node instanceof HTMLElement) {
          node.style.whiteSpace = 'nowrap'
          node.style.maxWidth = 'none'
        }
      })
    } else if (noteType === 'code') {
      body.style.whiteSpace = 'normal'
      body.querySelectorAll('pre, code').forEach((node) => {
        if (node instanceof HTMLElement) {
          node.style.whiteSpace = 'pre'
          node.style.maxWidth = 'none'
          node.style.width = 'auto'
        }
      })
    } else {
      body.style.whiteSpace = 'normal'
    }
  }

  document.body.appendChild(clone)

  const header = clone.querySelector('[data-window-header]')
  const headerWidth = header instanceof HTMLElement ? header.scrollWidth : 0
  const headerHeight = header instanceof HTMLElement ? header.offsetHeight : 0
  const bodyWidth = body instanceof HTMLElement ? body.scrollWidth : 0
  const bodyHeight = body instanceof HTMLElement ? body.scrollHeight : 0
  const noteType = body instanceof HTMLElement ? (body.dataset.noteType || '') : ''
  const extraHeight = noteType === 'html' ? 25 : 0

  clone.remove()

  return {
    width: Math.max(300, Math.min(viewportMaxWidth, Math.ceil(Math.max(headerWidth + 16, bodyWidth + 28)))),
    height: Math.max(NOTE_MIN_HEIGHT, Math.min(viewportMaxHeight, Math.ceil(headerHeight + bodyHeight + 24 + extraHeight))),
  }
}

function autoFitNoteWindows(notesById) {
  const viewportMaxWidth = Math.max(300, window.innerWidth - 80)
  const viewportMaxHeight = Math.max(NOTE_MIN_HEIGHT, window.innerHeight - 20)
  let changed = false

  state.noteWindows = state.noteWindows.map((windowState) => {
    if (!windowState.autoHeight && !windowState.autoWidth) return windowState

    const note = notesById.get(windowState.noteId)
    if (!note) return windowState
    const autoFitMaxWidth = note.type === 'html'
      ? Math.min(viewportMaxWidth, 650)
      : viewportMaxWidth

    const windowEl = root?.querySelector?.(`[data-window-id="note:${CSS.escape(String(windowState.noteId))}"]`)
    if (!(windowEl instanceof HTMLElement)) return windowState

    const header = windowEl.querySelector('[data-window-header]')
    const body = windowEl.querySelector('[data-note-window-body]')
    if (!(body instanceof HTMLElement)) return windowState

    const measured = measureNoteWindowTargetSize(windowEl, autoFitMaxWidth, viewportMaxHeight)
    const headerHeight = header instanceof HTMLElement ? header.offsetHeight : 0
    const headerWidth = header instanceof HTMLElement ? header.scrollWidth : 0
    const extraHeight = note.type === 'html' ? 25 : 0
    const fallbackWidth = Math.max(
      300,
      Math.min(autoFitMaxWidth, Math.ceil(Math.max(headerWidth + 16, body.scrollWidth + 28)))
    )
    const fallbackHeight = Math.max(
      NOTE_MIN_HEIGHT,
      Math.min(viewportMaxHeight, Math.ceil(headerHeight + body.scrollHeight + 24 + extraHeight))
    )
    const targetWidth = measured?.width ?? fallbackWidth
    const targetHeight = measured?.height ?? fallbackHeight

    changed = true
    return clampWindowState({
      ...windowState,
      width: targetWidth,
      height: targetHeight,
      autoHeight: false,
      autoWidth: false,
      windowId: `note:${windowState.noteId}`,
    })
  })

  if (!changed) return

  root.innerHTML = renderLocalToolsRoot({
    ...state,
    notes: getRenderableNotes(notesById),
  })
  syncNestedTabsInFloatingWindows(root)
  initFavicons(root)
  void hydrateNoteHtmlRenders(root)
  void hydrateNoteCodeBlocks(root)
}

function bringToFront(windowId, {persist = true, rerender = true} = {}) {
  const current = getWindowState(windowId)
  if (!current) return

  if (current.z >= state.zIndexTracker) {
    syncZTracker()
    if (rerender) void render()
    if (persist) queueSave()
    return
  }

  const nextZ = Math.max(state.zIndexTracker + 1, 221)
  state.zIndexTracker = nextZ
  applyWindowPatch(windowId, {z: nextZ}, {persist, rerender})
}

function applyLiveZIndex(windowEl, zIndex) {
  if (!(windowEl instanceof HTMLElement)) return
  windowEl.style.zIndex = String(zIndex)
}

function getPointerPoint(event) {
  const point = event.touches?.[0] || event.changedTouches?.[0] || event
  return {
    x: point?.clientX ?? 0,
    y: point?.clientY ?? 0,
  }
}

function startSession(type, windowEl, event) {
  const windowId = windowEl?.dataset?.windowId
  const windowState = getWindowState(windowId)
  if (!windowId || !windowState) return

  const point = getPointerPoint(event)
  session = {
    type,
    windowId,
    startX: point.x,
    startY: point.y,
    originX: windowState.x,
    originY: windowState.y,
    originWidth: windowState.width,
    originHeight: windowState.height,
  }
}

function handlePointerMove(event) {
  if (!session) return
  const point = getPointerPoint(event)
  const deltaX = point.x - session.startX
  const deltaY = point.y - session.startY

  if (session.type === 'move') {
    event.preventDefault()
    applyWindowPatch(session.windowId, {
      x: session.originX + deltaX,
      y: session.originY + deltaY,
    }, {persist: false, rerender: false})
    return
  }

  if (session.type === 'resize') {
    event.preventDefault()
    applyWindowPatch(session.windowId, {
      width: session.originWidth + deltaX,
      height: session.originHeight + deltaY,
      autoHeight: false,
      autoWidth: false,
    }, {persist: false, rerender: false})
  }
}

function handlePointerUp() {
  if (!session) return
  queueSave()
  session = null
}

function handlePointerDown(event) {
  const target = event.target
  if (!(target instanceof Element)) return
  const windowEl = target.closest('[data-floating-window]')
  if (!windowEl) return

  bringToFront(windowEl.dataset.windowId, {persist: true, rerender: false})
  applyLiveZIndex(windowEl, getWindowState(windowEl.dataset.windowId)?.z ?? state.quicknote.z)

  if (isMobileNoteViewport() && windowEl.dataset.windowType === 'note') {
    return
  }

  const resizeHandle = target.closest('[data-window-resize-handle]')
  if (resizeHandle) {
    event.preventDefault()
    startSession('resize', windowEl, event)
    return
  }

  const header = target.closest('[data-window-header]')
  if (header) {
    if (target.closest('button, input, textarea, select, a')) return
    event.preventDefault()
    startSession('move', windowEl, event)
  }
}

function bindGlobalListeners() {
  if (bound) return
  bound = true
  document.addEventListener('pointerdown', handlePointerDown)
  window.addEventListener('pointermove', handlePointerMove, {passive: false})
  window.addEventListener('pointerup', handlePointerUp)
  window.addEventListener('pointercancel', handlePointerUp)
}

export async function initializeLocalTools(appEl) {
  appRoot = appEl || appRoot
  if (!initialized) {
    state = await loadLocalToolsState()
    initialized = true
  }
  ensureRoot()
  bindGlobalListeners()
  await render({reloadNotes: true})
}

export function openQuicknote() {
  if (!state.quicknote.open) {
    state.quicknote.open = true
    enteringWindowIds.add('quicknote')
    bringToFront('quicknote', {persist: true, rerender: true})
    queueSave()
    focusQuicknoteTextarea({moveCaretToEnd: true})
    return
  }

  bringToFront('quicknote', {persist: true, rerender: true})
  focusQuicknoteTextarea({moveCaretToEnd: true})
}

export function closeQuicknoteWindow() {
  state.quicknote.open = false
  void render()
  queueSave()
}

export async function refreshQuicknoteWindow() {
  state = await loadLocalToolsState()
  await render()
}

export function updateQuicknoteContent(value) {
  setWindowState('quicknote', {content: String(value ?? '')})
  queueSave()
}

export function openFloatingNote(noteId) {
  const parsedNoteId = parseInt(String(noteId), 10)
  if (!Number.isInteger(parsedNoteId) || parsedNoteId <= 0) return
  if (isMobileNoteViewport()) {
    state.noteWindows = state.noteWindows.filter((entry) => entry.noteId === parsedNoteId)
  }
  const existing = state.noteWindows.find((entry) => entry.noteId === parsedNoteId)
  if (existing) {
    bringToFront(`note:${parsedNoteId}`, {persist: true, rerender: true})
    return
  }

  const offset = isMobileNoteViewport() ? 0 : state.noteWindows.length * 20
  const nextZ = Math.max(state.zIndexTracker + 1, 221)
  const savedLayout = getSavedNoteLayout(parsedNoteId)
  state.zIndexTracker = nextZ
  state.noteWindows = [
    ...state.noteWindows,
    {
      noteId: parsedNoteId,
      x: savedLayout?.x ?? (40 + offset),
      y: savedLayout?.y ?? (72 + offset),
      width: savedLayout?.width ?? 420,
      height: savedLayout?.height ?? 320,
      z: nextZ,
      autoHeight: !savedLayout,
      autoWidth: !savedLayout,
    },
  ]
  enteringWindowIds.add(`note:${parsedNoteId}`)
  void render({reloadNotes: true})
  queueSave()
}

export function closeFloatingNote(noteId) {
  const parsedNoteId = parseInt(String(noteId), 10)
  if (!Number.isInteger(parsedNoteId) || parsedNoteId <= 0) return
  const windowId = `note:${parsedNoteId}`
  if (closingWindowIds.has(windowId)) return
  const existing = state.noteWindows.find((entry) => entry.noteId === parsedNoteId)
  if (existing) saveNoteLayout(existing)
  const windowEl = getWindowElement(windowId)
  if (!(windowEl instanceof HTMLElement)) {
    cryptSessions.delete(parsedNoteId)
    editorSessions.delete(parsedNoteId)
    state.noteWindows = state.noteWindows.filter((entry) => entry.noteId !== parsedNoteId)
    void render()
    queueSave()
    return
  }

  closingWindowIds.add(windowId)
  windowEl.setAttribute('data-window-closing', '')
  window.setTimeout(() => {
    closingWindowIds.delete(windowId)
    cryptSessions.delete(parsedNoteId)
    editorSessions.delete(parsedNoteId)
    state.noteWindows = state.noteWindows.filter((entry) => entry.noteId !== parsedNoteId)
    void render()
    queueSave()
  }, WINDOW_CLOSE_ANIMATION_MS)
}

export async function unlockFloatingCryptNote(noteId, passphrase = '') {
  const parsedNoteId = parseInt(String(noteId), 10)
  const normalizedPassphrase = String(passphrase ?? '')
  if (!Number.isInteger(parsedNoteId) || parsedNoteId <= 0) return false

  cryptSessions.set(parsedNoteId, {
    unlockPassphrase: normalizedPassphrase,
    unlockError: '',
    unlocking: true,
  })
  await render()

  try {
    const note = await loadNoteById(parsedNoteId)
    if (!note || note.type !== 'crypt') {
      cryptSessions.delete(parsedNoteId)
      await render()
      return false
    }

    if (note?.id) noteRecords.set(note.id, note)
    const payload = parseCryptPayload(note.content ?? '')
    const unlockedContent = await decryptNote(payload, normalizedPassphrase)
    cryptSessions.set(parsedNoteId, {
      unlockedContent,
      passphrase: normalizedPassphrase,
      unlockPassphrase: '',
      unlockError: '',
      unlocking: false,
    })
    if (editorSessions.has(parsedNoteId)) {
      setEditorSession(parsedNoteId, {
        editContent: unlockedContent,
        editError: '',
      })
    }
    await render()
    return true
  } catch {
    cryptSessions.set(parsedNoteId, {
      unlockPassphrase: normalizedPassphrase,
      unlockError: t('noteViewer.wrongPassphrase'),
      unlocking: false,
    })
    await render()
    return false
  }
}

export async function lockFloatingCryptNote(noteId) {
  const parsedNoteId = parseInt(String(noteId), 10)
  if (!Number.isInteger(parsedNoteId) || parsedNoteId <= 0) return
  if (!cryptSessions.has(parsedNoteId)) return
  cryptSessions.delete(parsedNoteId)
  await render()
}

export async function toggleFloatingCryptPassphrase(noteId, passphrase = '') {
  const parsedNoteId = parseInt(String(noteId), 10)
  if (!Number.isInteger(parsedNoteId) || parsedNoteId <= 0) return
  const current = cryptSessions.get(parsedNoteId) ?? {}
  cryptSessions.set(parsedNoteId, {
    ...current,
    unlockPassphrase: String(passphrase ?? current.unlockPassphrase ?? ''),
    revealPassphrase: current.revealPassphrase !== true,
  })
  await render()
}

export async function startFloatingNoteEdit(noteId) {
  const parsedNoteId = parseInt(String(noteId), 10)
  if (!Number.isInteger(parsedNoteId) || parsedNoteId <= 0) return
  const note = await loadNoteById(parsedNoteId)
  if (!note) return
  noteRecords.set(parsedNoteId, note)
  if (note.type === 'crypt') {
    cryptSessions.delete(parsedNoteId)
    setEditorSession(parsedNoteId, {
      editMode: true,
      editTitle: note.title ?? '',
      editStyleToken: note.style_token ?? 'primary',
      editContent: '',
      editError: '',
    })
    await render()
    return
  }
  setEditorSession(parsedNoteId, normalizeEditorSession(note))
  await render()
  requestAnimationFrame(() => {
    const form = root?.querySelector?.(`[data-floating-note-form][data-note-id="${parsedNoteId}"]`)
    const content = form?.querySelector?.('[name="content"]')
    const title = form?.querySelector?.('[name="title"]')
    const target = content instanceof HTMLTextAreaElement ? content : title
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return
    target.focus()
    const length = target.value.length
    target.setSelectionRange?.(length, length)
  })
}

export async function cancelFloatingNoteEdit(noteId) {
  const parsedNoteId = parseInt(String(noteId), 10)
  if (!Number.isInteger(parsedNoteId) || parsedNoteId <= 0) return
  editorSessions.delete(parsedNoteId)
  const note = noteRecords.get(parsedNoteId)
  if (note?.type === 'crypt') {
    cryptSessions.delete(parsedNoteId)
  }
  await render()
}

export function syncFloatingNoteEditorField(noteId, field, value) {
  const parsedNoteId = parseInt(String(noteId), 10)
  if (!Number.isInteger(parsedNoteId) || parsedNoteId <= 0 || !field) return
  const patch = {}
  if (field === 'title') patch.editTitle = String(value ?? '')
  if (field === 'content') patch.editContent = String(value ?? '')
  if (field === 'language') patch.editLanguage = String(value ?? 'auto')
  if (field === 'style_token') patch.editStyleToken = String(value ?? 'primary')
  patch.editError = ''
  if (!Object.keys(patch).length) return
  setEditorSession(parsedNoteId, patch)

  if (field === 'title') {
    const titleEl = root?.querySelector?.(`[data-note-window-id="${parsedNoteId}"] [data-note-window-title]`)
    if (titleEl instanceof HTMLElement) {
      titleEl.textContent = String(value ?? '') || t('openNotes.noteTitle')
    }
  }

  if (field === 'content') {
    const preview = root?.querySelector?.(`[data-note-window-id="${parsedNoteId}"] [data-note-editor-preview]`)
    const windowEl = root?.querySelector?.(`[data-window-id="note:${parsedNoteId}"]`)
    const noteType = windowEl?.querySelector?.('[data-note-window-body]')?.dataset?.noteType ?? ''
    if (preview instanceof HTMLElement && noteType === 'html') {
      preview.dataset.noteHtmlSource = String(value ?? '')
      void hydrateNoteHtmlRenders(preview)
    }
  }

  if (field === 'style_token') {
    const windowRoot = root?.querySelector?.(`[data-note-window-id="${parsedNoteId}"]`)
    const colorSelect = windowRoot?.querySelector?.('[data-note-color-select]')
    if (colorSelect instanceof HTMLElement) {
      colorSelect.setAttribute('data-note-token', String(value ?? 'primary'))
    }
    const header = windowRoot?.querySelector?.('[data-window-header]')
    if (header instanceof HTMLElement) {
      header.className = getNoteTokenClass(String(value ?? 'primary'))
    }
    if (windowRoot instanceof HTMLElement) {
      windowRoot.style.setProperty('--st-note-window-accent-color', getNoteAccentCssValue(String(value ?? 'primary')))
      windowRoot.className = `st-note-window ${getNoteBorderClass(String(value ?? 'primary'))}`
    }
  }
}

export async function toggleFloatingNotePreview(noteId) {
  const parsedNoteId = parseInt(String(noteId), 10)
  if (!Number.isInteger(parsedNoteId) || parsedNoteId <= 0) return
  const current = getEditorSession(parsedNoteId)
  if (!current) return
  setEditorSession(parsedNoteId, {previewMode: current.previewMode !== true})
  await render()
}

export async function saveFloatingNoteEdit(noteId, form) {
  const parsedNoteId = parseInt(String(noteId), 10)
  if (!Number.isInteger(parsedNoteId) || parsedNoteId <= 0 || !(form instanceof HTMLFormElement)) return false
  if (typeof form.reportValidity === 'function' && !form.reportValidity()) return false
  const note = await loadNoteById(parsedNoteId)
  if (!note) return false

  const title = form.querySelector('[name="title"]')?.value?.trim() ?? ''
  const contentValue = form.querySelector('[name="content"]')?.value ?? ''
  const language = form.querySelector('[name="language"]')?.value ?? 'auto'
  const styleToken = form.querySelector('[name="style_token"]')?.value ?? (note.style_token ?? 'primary')

  if (!title) {
    setEditorSession(parsedNoteId, {editError: t('noteForm.title')})
    await render()
    return false
  }

  const cryptState = cryptSessions.get(parsedNoteId)
  const payload = await buildNotePayload({
    title,
    type: note.type,
    content: contentValue,
    styleToken,
    language,
    passphrase: cryptState?.passphrase ?? cryptState?.unlockPassphrase ?? '',
    confirmPassphrase: cryptState?.passphrase ?? cryptState?.unlockPassphrase ?? '',
    isExistingCrypt: note.type === 'crypt',
    isDecrypted: typeof cryptState?.unlockedContent === 'string',
  }, (error) => {
    setEditorSession(parsedNoteId, {editError: error})
  })

  if (!payload) {
    await render()
    return false
  }

  await saveNoteData(parsedNoteId, payload)
  noteRecords.set(parsedNoteId, {
    ...note,
    ...payload,
  })

  if (note.type === 'crypt') {
    cryptSessions.delete(parsedNoteId)
  }

  editorSessions.delete(parsedNoteId)
  await render()
  const moduleSyncId = document.querySelector(`[data-note-id="${CSS.escape(String(parsedNoteId))}"][data-module-sync-id]`)?.getAttribute('data-module-sync-id')
  if (moduleSyncId) {
    const {refreshModuleContent} = await import('../../app/bootstrap.js')
    await refreshModuleContent(moduleSyncId)
  }
  return true
}
