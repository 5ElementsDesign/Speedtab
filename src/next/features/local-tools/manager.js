import {decryptNote, parseCryptPayload} from '../../../composables/useCrypt.ts'
import {highlightCode} from '../../../composables/useHighlight.ts'
import {renderNoteHtmlWithAssets} from '../../../composables/useNoteImages.ts'
import {loadLocalToolsState, normalizeLocalToolsState, saveLocalToolsState} from '../../data/local-tools.js'
import {loadNoteById, loadNotesByIds, saveNoteData} from '../../data/notes.js'
import {syncPictureInPicture} from '../../actions/picture-in-picture.js'
import {initFavicons} from '../../utils/favicon.js'
import {t} from '../../utils/i18n.js'
import {initFormDirtyState} from '../forms/actions.js'
import {buildNotePayload} from '../modules/note-form.js'
import {getHtmlNoteSubtype, normalizeNoteStyleToken, parseNoteMeta} from '../modules/notes-shared.js'
import {renderLocalToolsRoot, renderQuicknoteWindow} from './render.js'

const WINDOW_ROOT_ATTR = 'data-floating-windows'
const MIN_WIDTH = 240
const MIN_HEIGHT = 140
const NOTE_MIN_HEIGHT = 96
const DEFAULT_NOTE_LAYOUT = {
  x: 40,
  y: 72,
  width: 420,
  height: 320,
  z: 221,
}

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

function getFloatingTabsInstance() {
  return document.body?.__floatingTabsInstance
    ?? document.querySelector('#app')?.__floatingTabsInstance
    ?? document.querySelector('#app')?.__nextTabsInstance
    ?? null
}

function syncShellTabsEditorMode() {
  const tabs = getFloatingTabsInstance()
  if (!tabs) return

  const hasActiveEditor = editorSessions.size > 0

  if (hasActiveEditor) {
    if (!tabs._editorModeFocusState) {
      tabs._editorModeFocusState = {
        autoFocus: tabs.config.autoFocus,
        suspendFocusBlur: tabs._suspendFocusBlur === true,
      }
    }
    tabs.config.autoFocus = false
    tabs._suspendFocusBlur = true
    return
  }

  if (!tabs._editorModeFocusState) return
  tabs.config.autoFocus = tabs._editorModeFocusState.autoFocus
  tabs._suspendFocusBlur = tabs._editorModeFocusState.suspendFocusBlur
  delete tabs._editorModeFocusState
}

function syncNestedTabsInFloatingWindows(scope = null) {
  const tabs = getFloatingTabsInstance()
  if (!tabs || !(scope instanceof HTMLElement)) return
  const shouldPreserveEditorFocus = !!scope.closest?.('[data-note-editor-preview]')
  if (!shouldPreserveEditorFocus) {
    tabs.initializeAllContainers(scope)
    return
  }

  const previousAutoFocus = tabs.config.autoFocus
  const previousSuspendFocusBlur = tabs._suspendFocusBlur
  tabs.config.autoFocus = false
  tabs._suspendFocusBlur = true
  try {
    tabs.initializeAllContainers(scope, { staticDefaults: true })
  } finally {
    tabs.config.autoFocus = previousAutoFocus
    tabs._suspendFocusBlur = previousSuspendFocusBlur
  }
}

function getElementPath(root, element) {
  if (!(root instanceof HTMLElement) || !(element instanceof HTMLElement)) return ''
  const segments = []
  let current = element

  while (current && current !== root) {
    const parent = current.parentElement
    if (!parent) return ''
    const index = Array.from(parent.children).indexOf(current)
    if (index < 0) return ''
    segments.unshift(String(index))
    current = parent
  }

  return current === root ? segments.join('.') : ''
}

function getElementByPath(root, path = '') {
  if (!(root instanceof HTMLElement) || !path) return null
  let current = root
  const segments = path.split('.').map((entry) => Number.parseInt(entry, 10))

  for (const segment of segments) {
    if (!Number.isInteger(segment) || segment < 0) return null
    current = current.children?.[segment]
    if (!(current instanceof HTMLElement)) return null
  }

  return current
}

function getSavedNoteTabState(noteId) {
  return state.noteTabStates.find((entry) => entry.noteId === noteId)?.tabs ?? []
}

function saveNoteTabState(noteId, tabs = []) {
  const nextState = {noteId, tabs}
  const index = state.noteTabStates.findIndex((entry) => entry.noteId === noteId)
  if (index === -1) {
    state.noteTabStates = [...state.noteTabStates, nextState]
    return
  }
  state.noteTabStates = state.noteTabStates.map((entry, currentIndex) => (
    currentIndex === index ? nextState : entry
  ))
}

function removeNoteTabState(noteId) {
  state.noteTabStates = state.noteTabStates.filter((entry) => entry.noteId !== noteId)
}

function applySavedNoteTabStateToScope(noteId, scope) {
  if (!Number.isInteger(noteId) || noteId <= 0 || !(scope instanceof HTMLElement)) return
  const savedTabs = getSavedNoteTabState(noteId)
  if (!savedTabs.length) return

  savedTabs.forEach(({path, lastActive}) => {
    const container = getElementByPath(scope, path)
    if (!(container instanceof HTMLElement) || !container.matches('[data-yai-tabs]')) return
    if (!container.querySelector(`:scope > [data-controller] [data-open="${CSS.escape(lastActive)}"]`)) return
    container.dataset.lastActive = lastActive
  })
}

function persistNoteTabStateFromContainer(container) {
  const noteWindow = container?.closest?.('[data-note-window-id]')
  if (!(noteWindow instanceof HTMLElement)) return
  if (noteWindow.querySelector('[data-note-window-body]')?.getAttribute('data-note-mode') !== 'view') return
  if (container.closest('[data-note-editor-preview]')) return

  const noteId = Number.parseInt(noteWindow.dataset.noteWindowId || '', 10)
  if (!Number.isInteger(noteId) || noteId <= 0) return

  const htmlScope = noteWindow.querySelector('[data-note-html-render]')
  if (!(htmlScope instanceof HTMLElement)) return

  const tabs = [...htmlScope.querySelectorAll('[data-yai-tabs]')]
    .map((entry) => {
      if (!(entry instanceof HTMLElement)) return null
      const activeButton = entry.querySelector(':scope > [data-controller] [data-open].active')
      const lastActive = entry.dataset.lastActive || activeButton?.getAttribute('data-open') || activeButton?.dataset?.open || ''
      const path = getElementPath(htmlScope, entry)
      if (!path || !lastActive) return null
      return {path, lastActive}
    })
    .filter(Boolean)

  if (!tabs.length) {
    removeNoteTabState(noteId)
  } else {
    saveNoteTabState(noteId, tabs)
  }
  queueSave()
}

function getSavedNoteLayout(noteId) {
  return state.noteLayouts.find((entry) => entry.noteId === noteId) ?? null
}

function removeSavedNoteLayout(noteId) {
  state.noteLayouts = state.noteLayouts.filter((entry) => entry.noteId !== noteId)
}

function getDefaultNoteWindowMeta(note = {}) {
  const meta = parseNoteMeta(note?.meta_json ?? null)
  const windowMeta = meta?.window && typeof meta.window === 'object' ? meta.window : {}
  const width = Number(windowMeta?.width)
  const height = Number(windowMeta?.height)

  return {
    width: Number.isFinite(width) && width >= 300 ? width : null,
    height: Number.isFinite(height) && height >= NOTE_MIN_HEIGHT ? height : null,
  }
}

function saveNoteLayout(windowState) {
  if (!windowState?.noteId) return
  if (windowState.transientInitialLayout === true) return
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

function hasUserAdjustedNoteLayout(windowState) {
  return windowState?.userAdjustedLayout === true
}

function isNoteWindowInEditMode(windowId) {
  const parsed = parseWindowId(windowId)
  return parsed.type === 'note' && editorSessions.has(parsed.key)
}

function saveNoteLayoutPatch(windowState, patch = {}) {
  if (!windowState?.noteId) return
  const existing = getSavedNoteLayout(windowState.noteId)
  saveNoteLayout({
    noteId: windowState.noteId,
    x: patch.x ?? existing?.x ?? DEFAULT_NOTE_LAYOUT.x,
    y: patch.y ?? existing?.y ?? DEFAULT_NOTE_LAYOUT.y,
    width: patch.width ?? existing?.width ?? DEFAULT_NOTE_LAYOUT.width,
    height: patch.height ?? existing?.height ?? DEFAULT_NOTE_LAYOUT.height,
    z: patch.z ?? existing?.z ?? DEFAULT_NOTE_LAYOUT.z,
    transientInitialLayout: false,
  })
}

function getRenderableNotes(notesById) {
  return state.noteWindows.map((windowState) => ({
    ...notesById.get(windowState.noteId),
    ...windowState,
    ...cryptSessions.get(windowState.noteId),
    ...editorSessions.get(windowState.noteId),
    hasSavedLayout: !!getSavedNoteLayout(windowState.noteId),
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

function revokeNoteHtmlRenderers(noteId) {
  const prefixView = `note-view:${noteId}`
  const prefixPreview = `note-preview:${noteId}`
  for (const [key, revoke] of noteHtmlRenderRevokes.entries()) {
    if (key !== prefixView && key !== prefixPreview) continue
    try {
      revoke?.()
    } catch {
      // ignore cleanup failures
    }
    noteHtmlRenderRevokes.delete(key)
  }
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

function renderSingleFloatingNoteHtml(noteId) {
  const notesById = getOpenNotesById()
  const renderable = getRenderableNotes(notesById).find((note) => note.id === noteId)
  if (!renderable) return ''
  return renderLocalToolsRoot({notes: [renderable]})
}

function renderQuicknoteHtml() {
  if (!state.quicknote?.open) return ''
  return renderQuicknoteWindow(state.quicknote)
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
  const host = appRoot || document.querySelector('#app') || document.body

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
  // CRITICAL FLOATING-WINDOW RENDER PATH:
  // DO NOT USE THIS FOR ORDINARY NOTE UI STATE.
  // PREFER SINGLE-WINDOW MOUNTS OR DIRECT DOM PATCHES ON HOT PATHS.
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
  autoFitNoteWindows()
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

function buildTabberMarkup(selectedContent = '', {nested = false, theme = 'light'} = {}) {
  const safeTheme = theme === 'dark' ? 'dark' : 'light'
  const contentA = selectedContent.trim() || 'Content A …'
  const lines = [
    `<div data-yai-tabs="" data-theme="${safeTheme}" data-color-accent="secondary" data-nav="top" data-behavior="blur" data-swipe="" data-closable="false" data-auto-accessibility="false">`,
    '    <nav data-controller="">',
    '        <button data-tab-action="open" data-open="1" data-default>Tab A</button>',
    '        <button data-tab-action="open" data-open="2">Tab B</button>',
    '    </nav>',
    '    <div data-content="">',
    `        <div data-tab="1" class="p-3">${contentA}</div>`,
    '        <div data-tab="2" class="p-3">Content B…</div>',
    '    </div>',
    '</div>',
  ]

  if (!nested) return lines.join('\n')

  return [
    `\n<!--`,
    '  Nested Tabs start here',
    '-->',
    ...lines,
    '<!--',
    '  Nested Tabs ends here',
    `-->\n`,
  ].join('\n')
}

function buildTableauMarkup(selectedContent = '', {theme = 'light'} = {}) {
  const safeTheme = theme === 'dark' ? 'dark' : 'light'
  const inverseTheme = safeTheme === 'dark' ? 'light' : 'dark'
  const introContent = selectedContent.trim() || 'Speedtab'
  return [
    '<!-- Tabbed browser -->',
    '<div',
    '  data-yai-tabs',
    '  data-swipe',
    '  data-nav="top"',
    `  data-theme="${safeTheme}"`,
    '  data-color-accent="secondary"',
    '  data-behavior="blur"',
    '  data-closable="false"',
    '  data-auto-accessibility="false">',
    '  <nav data-controller>',
    '    <button data-tab-action="open" data-open="1" data-default> Intro </button>',
    '    <button data-tab-action="open" data-open="2"> More </button>',
    '  </nav>',
    '  <div data-content>',
    '',
    '    <!-- Tabbed browser -->',
    '    <div data-tab="1" data-spaceless>',
    '      <div',
    '        data-yai-tabs',
    '        data-swipe',
    '        data-nav="left"',
    '        data-color-accent="warning">',
    '        <nav data-controller>',
    '          <button data-tab-action="open" data-open="1" data-default> (Intro) - Speedtab </button>',
    '          <button data-tab-action="open" data-open="2"> (Intro) - YaiTabs </button>',
    '          <button data-tab-action="open" data-open="3"> (Intro) - Tabbed Browsing </button>',
    '        </nav>',
    '        <div data-content>',
    '',
    '          <div data-tab="1">',
    '',
    '            <div class="flex p-1">',
    '              <div class="pr-3 w-100" data-swipe-ignore>',
    `                ${introContent}`,
    '              </div>',
    '              <div class="extras">',
    '                <div',
    '                  data-yai-tabs',
    '                  data-swipe',
    '                  data-auto-height',
    '                  data-nav="top"',
    `                  data-theme="${inverseTheme}"`,
    '                  data-color-accent="danger"',
    '                  data-variant="danger">',
    '                  <nav data-controller data-grow>',
    '                    <button data-tab-action="open" data-open="1" data-default> About </button>',
    '                    <button data-tab-action="open" data-open="2"> Manual </button>',
    '                    <button data-tab-action="open" data-open="3"> Extras </button>',
    '                  </nav>',
    '                  <div data-content>',
    '',
    '                    <div data-tab="1">',
    '                      About (Content)',
    '                    </div>',
    '',
    '                    <div data-tab="2">',
    '                      Manual (Content)',
    '                    </div>',
    '',
    '                    <div data-tab="3">',
    '                      Extras (Content)',
    '                    </div>',
    '',
    '                  </div>',
    '                </div>',
    '              </div>',
    '            </div>',
    '',
    '          </div>',
    '',
    '          <div data-tab="2">',
    '            YaiTabs (Content)',
    '          </div>',
    '',
    '          <div data-tab="3">',
    '            Tabbed Browsing (Content)',
    '          </div>',
    '',
    '        </div>',
    '      </div>',
    '    </div>',
    '',
    '    <!-- Tabbed browser -->',
    '    <div data-tab="2" data-spaceless>',
    '      <div',
    '        data-yai-tabs',
    '        data-swipe',
    '        data-nav="bottom"',
    '        data-color-accent="success">',
    '        <nav data-controller>',
    '          <button data-tab-action="open" data-open="1" data-default> (More) - How to </button>',
    '          <button data-tab-action="open" data-open="2"> (More) - Attributes </button>',
    '        </nav>',
    '        <div data-content>',
    '',
    '          <div data-tab="1">',
    '            How to (Content)',
    '          </div>',
    '',
    '          <!-- Tabbed browser -->',
    '          <div data-tab="2" data-spaceless>',
    '            <div',
    '              data-yai-tabs',
    '              data-swipe',
    '              data-nav="right"',
    '              data-color-accent="danger">',
    '              <nav data-controller>',
    '                <button data-tab-action="open" data-open="1" data-default> (Attributes) - DOCS </button>',
    '                <button data-tab-action="open" data-open="2"> (Attributes) - Details </button>',
    '              </nav>',
    '              <div data-content>',
    '',
    '                <div data-tab="1">',
    '                  DOCs (content)',
    '                </div>',
    '',
    '                <div data-tab="2">',
    '                  Attributes (content)',
    '                </div>',
    '',
    '              </div>',
    '            </div>',
    '',
    '          </div>',
    '        </div>',
    '      </div>',
    '    </div>',
    '  </div>',
    '</div>',
  ].join('\n')
}

function getFloatingNoteTemplateTheme(noteId) {
  const parsedNoteId = parseInt(String(noteId), 10)
  if (!Number.isInteger(parsedNoteId) || parsedNoteId <= 0) return 'light'
  const select = root?.querySelector?.(
    `[data-note-window-id="${parsedNoteId}"] [data-note-template-theme]`,
  )
  const value = select instanceof HTMLSelectElement ? select.value : ''
  return value === 'dark' ? 'dark' : 'light'
}

function insertFloatingNoteTemplate(noteId, buildInsertion) {
  const parsedNoteId = parseInt(String(noteId), 10)
  if (!Number.isInteger(parsedNoteId) || parsedNoteId <= 0) return

  const textarea = root?.querySelector?.(
    `[data-note-window-id="${parsedNoteId}"] textarea[name="content"][data-editor-field="content"]`
  )
  if (!(textarea instanceof HTMLTextAreaElement)) return

  const start = textarea.selectionStart ?? textarea.value.length
  const end = textarea.selectionEnd ?? start
  const selectedText = textarea.value.slice(start, end)
  const insertion = buildInsertion(selectedText, textarea.value)
  const prefix = textarea.value.slice(0, start)
  const suffix = textarea.value.slice(end)
  const beforeNeedsGap = prefix.length > 0 && !prefix.endsWith('\n')
  const afterNeedsGap = suffix.length > 0 && !suffix.startsWith('\n')
  const nextValue = `${prefix}${beforeNeedsGap ? '\n' : ''}${insertion}${afterNeedsGap ? '\n' : ''}${suffix}`

  textarea.value = nextValue
  const nextCaret = `${prefix}${beforeNeedsGap ? '\n' : ''}${insertion}`.length
  textarea.focus()
  textarea.setSelectionRange(nextCaret, nextCaret)
  syncFloatingNoteEditorField(parsedNoteId, 'content', nextValue)
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

    // HTML note preview lives inside the editor <form>. Any nested tab buttons
    // without an explicit type would become submit buttons and exit edit mode.
    if (el.hasAttribute('data-note-editor-preview')) {
      el.querySelectorAll('button:not([type])').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return
        button.type = 'button'
      })
    }

    if (renderKey.startsWith('note-view:')) {
      const noteId = Number.parseInt(renderKey.slice('note-view:'.length), 10)
      applySavedNoteTabStateToScope(noteId, el)
    }
    syncNestedTabsInFloatingWindows(el)
    initFavicons(el, {force: true})
    syncPictureInPicture()
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
        ? {...entry, ...patch}
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
    ? Math.max(MIN_WIDTH, viewportWidth)
    : Math.max(MIN_WIDTH, viewportWidth - 16)
  const maxHeight = parsed.type === 'note'
    ? Math.max(minHeight, viewportHeight)
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

function refreshWindowGeometry(windowId) {
  const nextState = getWindowState(windowId)
  const windowEl = getWindowElement(windowId)
  if (!nextState || !(windowEl instanceof HTMLElement)) return
  windowEl.style.left = `${nextState.x}px`
  windowEl.style.top = `${nextState.y}px`
  windowEl.style.width = `${nextState.width}px`
  windowEl.style.height = `${nextState.height}px`
  if (Number.isFinite(nextState.z)) windowEl.style.zIndex = String(nextState.z)
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

function autoFitNoteWindows() {
  state.noteWindows.forEach((windowState) => {
    autoFitSingleNoteWindow(windowState.noteId)
  })
}

function autoFitSingleNoteWindow(noteId) {
  const windowState = state.noteWindows.find((entry) => entry.noteId === noteId)
  if (!windowState || (!windowState.autoHeight && !windowState.autoWidth)) return

  const note = noteRecords.get(noteId)
  if (!note) return

  const autoFitMaxWidth = note.type === 'html'
    ? Math.min(Math.max(300, window.innerWidth - 80), 650)
    : Math.max(300, window.innerWidth - 80)
  const viewportMaxHeight = Math.max(NOTE_MIN_HEIGHT, window.innerHeight - 20)
  const windowEl = root?.querySelector?.(`[data-window-id="note:${CSS.escape(String(noteId))}"]`)
  if (!(windowEl instanceof HTMLElement)) return

  const measured = measureNoteWindowTargetSize(windowEl, autoFitMaxWidth, viewportMaxHeight)
  if (!measured) return

  const nextState = clampWindowState({
    ...windowState,
    width: windowState.autoWidth ? measured.width : windowState.width,
    height: windowState.autoHeight ? measured.height : windowState.height,
    autoHeight: false,
    autoWidth: false,
    windowId: `note:${noteId}`,
  })

  setWindowState(`note:${noteId}`, nextState)
  windowEl.style.left = `${nextState.x}px`
  windowEl.style.top = `${nextState.y}px`
  windowEl.style.width = `${nextState.width}px`
  windowEl.style.height = `${nextState.height}px`
  if (Number.isFinite(nextState.z)) windowEl.style.zIndex = String(nextState.z)
}

async function mountSingleFloatingNoteWindow(noteId) {
  const el = ensureRoot()
  revokeNoteHtmlRenderers(noteId)
  const noteHtml = renderSingleFloatingNoteHtml(noteId)
  if (!noteHtml) return

  const existing = el.querySelector(`[data-window-id="note:${CSS.escape(String(noteId))}"]`)
  if (existing instanceof HTMLElement) existing.remove()

  el.insertAdjacentHTML('beforeend', noteHtml)
  const windowEl = el.querySelector(`[data-window-id="note:${CSS.escape(String(noteId))}"]`)
  if (!(windowEl instanceof HTMLElement)) return

  if (enteringWindowIds.has(`note:${noteId}`)) {
    windowEl.setAttribute('data-window-entering', '')
  }

  windowEl.querySelectorAll('[data-floating-note-form]').forEach((form) => {
    initFormDirtyState(form)
  })

  syncNestedTabsInFloatingWindows(windowEl)
  initFavicons(windowEl)
  await hydrateNoteHtmlRenders(windowEl)
  await hydrateNoteCodeBlocks(windowEl)
  syncPictureInPicture()
  autoFitSingleNoteWindow(noteId)
  syncZTracker()
  syncOpenNotePreviewState()
  enteringWindowIds.delete(`note:${noteId}`)
}

function getQuicknoteWindowElement() {
  return root?.querySelector?.('[data-window-id="quicknote"]') ?? null
}

async function mountQuicknoteWindow() {
  const el = ensureRoot()
  const quicknoteHtml = renderQuicknoteHtml()
  const existing = getQuicknoteWindowElement()

  if (!quicknoteHtml) {
    if (existing instanceof HTMLElement) existing.remove()
    syncZTracker()
    return
  }

  if (existing instanceof HTMLElement) {
    existing.remove()
  }

  el.insertAdjacentHTML('afterbegin', quicknoteHtml)
  const windowEl = getQuicknoteWindowElement()
  if (!(windowEl instanceof HTMLElement)) return
  if (enteringWindowIds.has('quicknote')) {
    windowEl.setAttribute('data-window-entering', '')
  }
  syncZTracker()
  enteringWindowIds.delete('quicknote')
}

function removeFloatingNoteWindowDom(noteId) {
  revokeNoteHtmlRenderers(noteId)
  const windowEl = root?.querySelector?.(`[data-window-id="note:${CSS.escape(String(noteId))}"]`)
  if (windowEl instanceof HTMLElement) {
    windowEl.remove()
  }
}

function removeQuicknoteWindowDom() {
  const windowEl = getQuicknoteWindowElement()
  if (windowEl instanceof HTMLElement) {
    windowEl.remove()
  }
}

async function rerenderWindowById(windowId) {
  const parsed = parseWindowId(windowId)
  if (parsed.type === 'quicknote') {
    await mountQuicknoteWindow()
    return
  }
  if (parsed.type === 'note' && parsed.key != null) {
    await mountSingleFloatingNoteWindow(parsed.key)
    return
  }
  await render()
}

function bringToFront(windowId, {persist = true, rerender = true} = {}) {
  const current = getWindowState(windowId)
  if (!current) return

  if (current.z >= state.zIndexTracker) {
    syncZTracker()
    if (persist) queueSave()
    return
  }

  const nextZ = Math.max(state.zIndexTracker + 1, 221)
  state.zIndexTracker = nextZ
  applyWindowPatch(windowId, {z: nextZ}, {persist, rerender: false})
  if (rerender) void rerenderWindowById(windowId)
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

  if (windowState.transientInitialLayout === true) {
    setWindowState(windowId, {transientInitialLayout: false})
  }

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
    if (deltaX === 0 && deltaY === 0) return
    applyWindowPatch(session.windowId, {
      x: session.originX + deltaX,
      y: session.originY + deltaY,
      userAdjustedLayout: true,
    }, {persist: false, rerender: false})
    session.didChange = true
    return
  }

  if (session.type === 'resize') {
    event.preventDefault()
    if (deltaX === 0 && deltaY === 0) return
    applyWindowPatch(session.windowId, {
      width: session.originWidth + deltaX,
      height: session.originHeight + deltaY,
      autoHeight: false,
      autoWidth: false,
      userAdjustedLayout: true,
    }, {persist: false, rerender: false})
    session.didChange = true
  }
}

function handlePointerUp() {
  if (!session) return
  if (session.didChange && !isNoteWindowInEditMode(session.windowId)) {
    const windowState = getWindowState(session.windowId)
    if (windowState && hasUserAdjustedNoteLayout(windowState)) {
      if (session.type === 'move') {
        saveNoteLayoutPatch(windowState, {
          x: windowState.x,
          y: windowState.y,
          z: windowState.z,
        })
      }
      if (session.type === 'resize') {
        saveNoteLayoutPatch(windowState, {
          width: windowState.width,
          height: windowState.height,
          z: windowState.z,
        })
      }
    }
  }
  if (session.didChange && isNoteWindowInEditMode(session.windowId)) {
    applyWindowPatch(session.windowId, {userAdjustedLayout: false}, {persist: false, rerender: false})
  }
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

export function persistFloatingNoteTabState(container) {
  persistNoteTabStateFromContainer(container)
}

export function openQuicknote() {
  if (!state.quicknote.open) {
    state.quicknote.open = true
    enteringWindowIds.add('quicknote')
    const nextZ = Math.max(state.zIndexTracker + 1, 221)
    state.zIndexTracker = nextZ
    state.quicknote.z = nextZ
    void mountQuicknoteWindow()
    queueSave()
    focusQuicknoteTextarea({moveCaretToEnd: true})
    return
  }

  bringToFront('quicknote', {persist: true, rerender: false})
  focusQuicknoteTextarea({moveCaretToEnd: true})
}

export function closeQuicknoteWindow() {
  state.quicknote.open = false
  removeQuicknoteWindowDom()
  syncZTracker()
  queueSave()
}

export async function refreshQuicknoteWindow() {
  state = await loadLocalToolsState()
  await mountQuicknoteWindow()
}

export function updateQuicknoteContent(value) {
  setWindowState('quicknote', {content: String(value ?? '')})
  queueSave()
}

export function openFloatingNote(noteId, options = {}) {
  const parsedNoteId = parseInt(String(noteId), 10)
  if (!Number.isInteger(parsedNoteId) || parsedNoteId <= 0) return
  const windowId = `note:${parsedNoteId}`
  const transientWidth = Number(options.initialWidth)
  const transientHeight = Number(options.initialHeight)
  const hasTransientWidth = Number.isFinite(transientWidth) && transientWidth >= 300
  const hasTransientHeight = Number.isFinite(transientHeight) && transientHeight >= NOTE_MIN_HEIGHT
  if (isMobileNoteViewport()) {
    const removedIds = state.noteWindows
      .map((entry) => entry.noteId)
      .filter((id) => id !== parsedNoteId)
    removedIds.forEach((id) => {
      cryptSessions.delete(id)
      editorSessions.delete(id)
      removeFloatingNoteWindowDom(id)
      removeCachedNote(id)
    })
    state.noteWindows = state.noteWindows.filter((entry) => entry.noteId === parsedNoteId)
  }
  const existing = state.noteWindows.find((entry) => entry.noteId === parsedNoteId)
  if (existing) {
    if (hasTransientWidth || hasTransientHeight) {
      applyWindowPatch(windowId, {
        ...(hasTransientWidth ? {width: transientWidth, autoWidth: false} : {}),
        ...(hasTransientHeight ? {height: transientHeight, autoHeight: false} : {}),
        transientInitialLayout: true,
      }, {persist: false, rerender: false})
    }
    bringToFront(windowId, {persist: true, rerender: false})
    syncOpenNotePreviewState()
    return
  }
  if (enteringWindowIds.has(windowId)) return

  const savedLayout = getSavedNoteLayout(parsedNoteId)
  enteringWindowIds.add(windowId)
  void (async () => {
    const note = await loadNoteById(parsedNoteId)
    if (!note) {
      enteringWindowIds.delete(windowId)
      return
    }
    noteRecords.set(parsedNoteId, note)
    const defaultMetaWindow = getDefaultNoteWindowMeta(note)
    const defaultWidth = note.type === 'crypt' ? 550 : 420
    const offset = isMobileNoteViewport() ? 0 : state.noteWindows.length * 20
    const nextZ = Math.max(state.zIndexTracker + 1, 221)
    state.zIndexTracker = nextZ
    state.noteWindows = [
      ...state.noteWindows,
      {
        noteId: parsedNoteId,
        x: savedLayout?.x ?? (40 + offset),
        y: savedLayout?.y ?? (72 + offset),
        width: savedLayout?.width ?? (
          hasTransientWidth
            ? transientWidth
            : (defaultMetaWindow.width ?? defaultWidth)
        ),
        height: savedLayout?.height ?? (
          hasTransientHeight
            ? transientHeight
            : (defaultMetaWindow.height ?? 320)
        ),
        z: nextZ,
        autoHeight: !savedLayout && !hasTransientHeight && !defaultMetaWindow.height,
        autoWidth: note.type !== 'crypt' && !savedLayout && !hasTransientWidth && !defaultMetaWindow.width,
        transientInitialLayout: !savedLayout && (hasTransientWidth || hasTransientHeight || !!defaultMetaWindow.width || !!defaultMetaWindow.height),
      },
    ]
    await mountSingleFloatingNoteWindow(parsedNoteId)
    queueSave()
  })()
}

export async function resetFloatingNoteWindowLayout(noteId) {
  const parsedNoteId = parseInt(String(noteId), 10)
  if (!Number.isInteger(parsedNoteId) || parsedNoteId <= 0) return
  const windowState = state.noteWindows.find((entry) => entry.noteId === parsedNoteId)
  if (!windowState) return

  removeSavedNoteLayout(parsedNoteId)

  const note = noteRecords.get(parsedNoteId) ?? await loadNoteById(parsedNoteId)
  if (!note) {
    queueSave()
    return
  }
  noteRecords.set(parsedNoteId, note)
  const defaultMetaWindow = getDefaultNoteWindowMeta(note)

  applyWindowPatch(`note:${parsedNoteId}`, {
    x: DEFAULT_NOTE_LAYOUT.x,
    y: DEFAULT_NOTE_LAYOUT.y,
    width: defaultMetaWindow.width ?? DEFAULT_NOTE_LAYOUT.width,
    height: defaultMetaWindow.height ?? DEFAULT_NOTE_LAYOUT.height,
    autoWidth: !defaultMetaWindow.width,
    autoHeight: !defaultMetaWindow.height,
    transientInitialLayout: false,
    userAdjustedLayout: false,
  }, {persist: false, rerender: false})
  refreshWindowGeometry(`note:${parsedNoteId}`)
  autoFitSingleNoteWindow(parsedNoteId)
  queueSave()
}


export function closeFloatingNote(noteId) {
  const parsedNoteId = parseInt(String(noteId), 10)
  if (!Number.isInteger(parsedNoteId) || parsedNoteId <= 0) return
  const windowId = `note:${parsedNoteId}`
  if (closingWindowIds.has(windowId)) return
  const existing = state.noteWindows.find((entry) => entry.noteId === parsedNoteId)
  const windowEl = getWindowElement(windowId)
  if (!(windowEl instanceof HTMLElement)) {
    removeFloatingNoteWindowDom(parsedNoteId)
    cryptSessions.delete(parsedNoteId)
    editorSessions.delete(parsedNoteId)
    syncShellTabsEditorMode()
    state.noteWindows = state.noteWindows.filter((entry) => entry.noteId !== parsedNoteId)
    removeCachedNote(parsedNoteId)
    syncOpenNotePreviewState()
    syncZTracker()
    queueSave()
    return
  }

  closingWindowIds.add(windowId)
  windowEl.setAttribute('data-window-closing', '')
  window.setTimeout(() => {
    closingWindowIds.delete(windowId)
    removeFloatingNoteWindowDom(parsedNoteId)
    cryptSessions.delete(parsedNoteId)
    editorSessions.delete(parsedNoteId)
    syncShellTabsEditorMode()
    state.noteWindows = state.noteWindows.filter((entry) => entry.noteId !== parsedNoteId)
    removeCachedNote(parsedNoteId)
    syncOpenNotePreviewState()
    syncZTracker()
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
  await mountSingleFloatingNoteWindow(parsedNoteId)

  try {
    const note = await loadNoteById(parsedNoteId)
    if (!note || note.type !== 'crypt') {
      cryptSessions.delete(parsedNoteId)
      await mountSingleFloatingNoteWindow(parsedNoteId)
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
    await mountSingleFloatingNoteWindow(parsedNoteId)
    return true
  } catch {
    cryptSessions.set(parsedNoteId, {
      unlockPassphrase: normalizedPassphrase,
      unlockError: t('noteViewer.wrongPassphrase'),
      unlocking: false,
    })
    await mountSingleFloatingNoteWindow(parsedNoteId)
    return false
  }
}

export async function lockFloatingCryptNote(noteId) {
  const parsedNoteId = parseInt(String(noteId), 10)
  if (!Number.isInteger(parsedNoteId) || parsedNoteId <= 0) return
  if (!cryptSessions.has(parsedNoteId)) return
  cryptSessions.delete(parsedNoteId)
  await mountSingleFloatingNoteWindow(parsedNoteId)
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
  await mountSingleFloatingNoteWindow(parsedNoteId)
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
    syncShellTabsEditorMode()
    await mountSingleFloatingNoteWindow(parsedNoteId)
    return
  }
  setEditorSession(parsedNoteId, normalizeEditorSession(note))
  syncShellTabsEditorMode()
  await mountSingleFloatingNoteWindow(parsedNoteId)
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
  syncShellTabsEditorMode()
  const note = noteRecords.get(parsedNoteId)
  if (note?.type === 'crypt') {
    cryptSessions.delete(parsedNoteId)
  }
  await mountSingleFloatingNoteWindow(parsedNoteId)
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
    const counter = root?.querySelector?.(
      `[data-note-window-id="${parsedNoteId}"] .st-note-editor-char-count`
    )
    if (counter instanceof HTMLElement) {
      counter.textContent = String(String(value ?? '').length)
    }

    const preview = root?.querySelector?.(`[data-note-window-id="${parsedNoteId}"] [data-note-editor-preview]`)
    const windowEl = root?.querySelector?.(`[data-window-id="note:${parsedNoteId}"]`)
    const noteType = windowEl?.querySelector?.('[data-note-window-body]')?.dataset?.noteType ?? ''
    if (preview instanceof HTMLElement && noteType === 'html') {
      const source = String(value ?? '')
      const subtype = getHtmlNoteSubtype(source)
      preview.dataset.noteHtmlSource = source
      if (subtype) preview.setAttribute('data-note-html-subtype', subtype)
      else preview.removeAttribute('data-note-html-subtype')
      void hydrateNoteHtmlRenders(preview)
    }
  }

  if (field === 'style_token') {
    const windowRoot = root?.querySelector?.(`[data-note-window-id="${parsedNoteId}"]`)
    const colorSelect = windowRoot?.querySelector?.('[data-note-color-select]')
    if (colorSelect instanceof HTMLElement) {
      const token = normalizeNoteStyleToken(String(value ?? 'primary'))
      colorSelect.setAttribute('data-note-token', token)
      colorSelect.setAttribute('data-ui-token', token)
    }
    if (windowRoot instanceof HTMLElement) {
      windowRoot.dataset.noteStyleToken = normalizeNoteStyleToken(String(value ?? 'primary'))
    }
  }
}

export function insertFloatingNoteTabber(noteId) {
  const theme = getFloatingNoteTemplateTheme(noteId)
  insertFloatingNoteTemplate(noteId, (selectedText, source) => {
    const hasExistingTabs = source.includes('data-yai-tabs')
    return buildTabberMarkup(selectedText, {nested: hasExistingTabs, theme})
  })
}

export function insertFloatingNoteTableau(noteId) {
  const theme = getFloatingNoteTemplateTheme(noteId)
  insertFloatingNoteTemplate(noteId, (selectedText) => buildTableauMarkup(selectedText, {theme}))
}

export async function toggleFloatingNotePreview(noteId) {
  const parsedNoteId = parseInt(String(noteId), 10)
  if (!Number.isInteger(parsedNoteId) || parsedNoteId <= 0) return
  const current = getEditorSession(parsedNoteId)
  if (!current) return
  setEditorSession(parsedNoteId, {previewMode: current.previewMode !== true})
  await mountSingleFloatingNoteWindow(parsedNoteId)
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
    await mountSingleFloatingNoteWindow(parsedNoteId)
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
    await mountSingleFloatingNoteWindow(parsedNoteId)
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
  syncShellTabsEditorMode()
  await mountSingleFloatingNoteWindow(parsedNoteId)
  const moduleSyncId = document.querySelector(`[data-note-id="${CSS.escape(String(parsedNoteId))}"][data-module-sync-id]`)?.getAttribute('data-module-sync-id')
  if (moduleSyncId) {
    const {refreshModuleContent} = await import('../../app/bootstrap.js')
    await refreshModuleContent(moduleSyncId)
  }
  return true
}
