import {decryptNote, parseCryptPayload} from '../../../composables/useCrypt.ts'
import {highlightCode} from '../../../composables/useHighlight.ts'
import {renderNoteHtmlWithAssets} from '../../../composables/useNoteImages.ts'
import {syncPictureInPicture} from '../../actions/picture-in-picture.js'
import {closeDropdown, rebindOpenDropdownRoot} from '../../components/dropdown.js'
import {createCaptureInboxItem} from '../../data/capture-inbox.js'
import {loadLocalToolsState, normalizeLocalToolsState, saveLocalToolsState} from '../../data/local-tools.js'
import {loadNoteById, loadNotesByIds, saveNoteData} from '../../data/notes.js'
import {initFavicons} from '../../utils/favicon.js'
import {escapeHtml} from '../../utils/html.js'
import {t} from '../../utils/i18n.js'
import {initFormDirtyState, updateFormDirtyState} from '../forms/actions.js'
import {buildNotePayload} from '../modules/note-form.js'
import {getHtmlNoteSubtype, normalizeNoteStyleToken, parseNoteMeta} from '../modules/notes-shared.js'
import {getValidTimeZone} from '../note-widgets/clock.js'
import {syncNoteWidgets} from '../note-widgets/index.js'
import {renderLocalToolsRoot, renderQuicknoteWindow, renderWorldClockDefaultTimezoneOptions} from './render.js'

const WINDOW_ROOT_ATTR = 'data-floating-windows'
const MIN_WIDTH = 240
const MIN_HEIGHT = 140
const NOTE_MIN_WIDTH = 100
const NOTE_MIN_HEIGHT = 40
const NOTE_VISIBLE_WIDTH = 72
const NOTE_VISIBLE_HEADER_HEIGHT = 40
const DEFAULT_NOTE_LAYOUT = {
  x: 40,
  y: 72,
  width: 420,
  height: 320,
  z: 221,
}

let root = null
let appRoot = null
let activePageSlug = ''
let state = normalizeLocalToolsState()
let saveTimer = null
let session = null
let bound = false
let initialized = false
const cryptSessions = new Map()
const editorSessions = new Map()
const noteRecords = new Map()
const virtualNoteIds = new Set()
let virtualNoteSequence = 0
const enteringWindowIds = new Set()
const closingWindowIds = new Set()
const WINDOW_CLOSE_ANIMATION_MS = 180
const noteHtmlRenderRevokes = new Map()
const MOBILE_NOTE_BREAKPOINT = 900
const DEFAULT_WORLD_CLOCK_ZONES = [
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Europe/Paris',
  'Europe/Madrid',
  'Europe/London',
  'Europe/Istanbul',
  'Europe/Moscow',
  'Asia/Calcutta',
  'Asia/Shanghai',
  'America/New_York',
].join('\n')
const WORLD_CLOCK_SECTION_PATTERN = /<section\b(?=[^>]*\bdata-world-clock(?:\s|=|>))[^>]*>[\s\S]*?<\/section>/i

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
  if (virtualNoteIds.has(noteId)) return
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
    width: Number.isFinite(width) && width >= NOTE_MIN_WIDTH ? width : null,
    height: Number.isFinite(height) && height >= NOTE_MIN_HEIGHT ? height : null,
  }
}

function saveNoteLayout(layout) {
  if (!layout?.noteId) return
  const existingIndex = state.noteLayouts.findIndex((entry) => entry.noteId === layout.noteId)
  if (existingIndex === -1) {
    state.noteLayouts = [...state.noteLayouts, layout]
    return
  }
  state.noteLayouts = state.noteLayouts.map((entry, index) => (
    index === existingIndex ? {...entry, ...layout} : entry
  ))
}

function hasUserAdjustedNoteLayout(windowState) {
  return windowState?.userAdjustedLayout === true
}

function isNoteWindowInEditMode(windowId) {
  const parsed = parseWindowId(windowId)
  return parsed.type === 'note' && editorSessions.has(parsed.key)
}

function expandFloatingNoteEditor(noteId) {
  const windowState = getWindowState(`note:${noteId}`)
  if (!windowState) return
  setEditorSession(noteId, {
    editorWidth: windowState.width,
    editorHeight: windowState.height,
  })
  applyWindowPatch(`note:${noteId}`, {}, {persist: false, rerender: false})
}

function restoreFloatingNoteEditorSize(noteId, editor = {}) {
  const width = Number(editor?.editorWidth)
  const height = Number(editor?.editorHeight)
  if (!Number.isFinite(width) || !Number.isFinite(height)) return
  applyWindowPatch(`note:${noteId}`, {width, height}, {persist: false, rerender: false})
}

function saveNoteLayoutPatch(windowState, patch = {}) {
  if (!windowState?.noteId || virtualNoteIds.has(windowState.noteId)) return
  saveNoteLayout({
    noteId: windowState.noteId,
    ...patch,
  })
}

function getRenderableNotes(notesById) {
  return state.noteWindows.map((windowState) => {
    const note = notesById.get(windowState.noteId)
    const windowMeta = parseNoteMeta(note?.meta_json ?? null)?.window ?? {}
    return {
      ...note,
      ...windowState,
      noteHideHeader: windowMeta.hide_header === true,
      noteResetPadding: windowMeta.reset_padding === true,
      noteBare: windowMeta.bare === true,
      noteNailed: windowMeta.nailed === true,
      noteShowOnAllPages: windowMeta.show_on_all_pages === true,
      notePageHidden: Boolean(activePageSlug) && Boolean(windowState.pageSlug) && windowState.pageSlug !== activePageSlug && windowMeta.show_on_all_pages !== true,
      virtualNote: virtualNoteIds.has(windowState.noteId),
      virtualMarkup: windowState.virtualMarkup === true,
      ...cryptSessions.get(windowState.noteId),
      ...editorSessions.get(windowState.noteId),
      hasSavedLayout: !!getSavedNoteLayout(windowState.noteId),
      module_sync_id: document.querySelector(`[data-note-sync-id="${CSS.escape(note?.sync_id ?? '')}"]`)
      ?.getAttribute?.('data-module-sync-id') ?? '',
    }
  })
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
  virtualNoteIds.delete(noteId)
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
  syncOpenNotesMap()
}

function syncOpenNotesMap() {
  const host = document.querySelector('[data-open-notes-map]')
  if (!(host instanceof HTMLElement)) return

  const notes = state.noteWindows.map((windowState) => ({
    id: windowState.noteId,
    pageSlug: windowState.pageSlug ?? '',
    title: noteRecords.get(windowState.noteId)?.title?.trim() || t('openNotes.noteTitle'),
    styleToken: normalizeNoteStyleToken(noteRecords.get(windowState.noteId)?.style_token),
  }))

  host.toggleAttribute('data-notes-opened', notes.length > 0)
  host.innerHTML = notes.length ? `
    <div data-open-notes-map-content>
      ${notes.map((note) => `
        <button
          type="button"
          data-click="focusFloatingNote"
          data-note-id="${escapeHtml(String(note.id))}"
          data-note-reference="note:${escapeHtml(String(note.id))}"
          data-page-slug="${escapeHtml(note.pageSlug)}"
        ><span data-open-notes-map-marker data-note-style-token="${escapeHtml(note.styleToken)}" aria-hidden="true"></span>${escapeHtml(note.title)}</button>
      `).join('')}
    </div>
  ` : ''
}

function getActivePageSlug() {
  return document.querySelector('[data-yai-tabs][data-ref-path="pages"]')?.dataset.lastActive || activePageSlug
}

export function syncFloatingNotePageScope(pageSlug = getActivePageSlug()) {
  activePageSlug = pageSlug || activePageSlug
  root?.querySelectorAll?.('[data-floating-window][data-note-page]').forEach((note) => {
    note.toggleAttribute('hidden', Boolean(activePageSlug) && note.dataset.notePage !== activePageSlug)
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
    const virtualWindows = state.noteWindows.filter((entry) => virtualNoteIds.has(entry.noteId))
    const persistedState = {
      ...state,
      noteWindows: state.noteWindows.filter((entry) => !virtualNoteIds.has(entry.noteId)),
    }
    const savedState = await saveLocalToolsState(persistedState)
    state = {...savedState, noteWindows: [...savedState.noteWindows, ...virtualWindows]}
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
    const persistentNoteIds = openNoteIds.filter((noteId) => !virtualNoteIds.has(noteId))
    const notes = persistentNoteIds.length ? await loadNotesByIds(persistentNoteIds) : []
    persistentNoteIds.forEach((noteId) => noteRecords.delete(noteId))
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
  syncNoteWidgets(el)
  autoFitNoteWindows()
  syncZTracker()
  syncOpenNotePreviewState()
  syncFloatingNotePageScope()
  enteringWindowIds.clear()
}

function normalizeEditorSession(note = {}, session = {}) {
  let language = 'auto'
  let meta = {}
  try {
    meta = note?.meta_json ? JSON.parse(note.meta_json) : {}
    if (typeof meta?.language === 'string') language = meta.language
  } catch {
    // ignore invalid meta
  }
  const windowMeta = meta?.window && typeof meta.window === 'object' ? meta.window : {}

  return {
    editMode: true,
    editTitle: session.editTitle ?? note.title ?? '',
    editContent: session.editContent ?? (note.type === 'crypt'
      ? (cryptSessions.get(note.id)?.unlockedContent ?? '')
      : (note.content ?? '')),
    editLanguage: session.editLanguage ?? language,
    editStyleToken: session.editStyleToken ?? note.style_token ?? 'primary',
    editPreview: session.editPreview ?? (typeof meta.preview === 'string' ? meta.preview : ''),
    previewMode: session.previewMode ?? (note.type === 'html'),
    editError: session.editError ?? '',
    noteHideHeader: session.noteHideHeader ?? (windowMeta.hide_header === true),
    noteResetPadding: session.noteResetPadding ?? (windowMeta.reset_padding === true),
    noteBare: session.noteBare ?? (windowMeta.bare === true),
    noteNailed: session.noteNailed ?? (windowMeta.nailed === true),
    noteShowOnAllPages: session.noteShowOnAllPages ?? (windowMeta.show_on_all_pages === true),
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
  updateFormDirtyState(textarea.form)
}

function buildWorldClockMarkup(zones = [], {
  display = 'digital',
  analogSize = 100,
  defaultTimeZone = zones[0],
  topDateFormat = '',
  itemDateFormat = '',
} = {}) {
  const defaultZone = zones.includes(defaultTimeZone) ? defaultTimeZone : zones[0]
  const topDate = String(topDateFormat ?? '').trim()
  const itemDate = String(itemDateFormat ?? '').trim()
  const clockMarkup = display === 'analog'
    ? `data-clock data-analog data-seconds data-st-width="${analogSize}px" data-st-height="${analogSize}px"`
    : 'data-clock data-digital data-seconds'
  return [
    '<section data-world-clock data-world-clock-theme="default" data-swipe-ignore>',
    ...(topDate ? [`  <div data-clock-zone><h3><b data-date data-date-format="${escapeHtml(topDate)}"></b></h3></div>`] : []),
    `  <div data-world-clock-items data-world-clock-default-timezone="${defaultZone}">`,
    ...zones.map((timeZone) => [
      `    <div data-world-clock-item data-clock-zone="${timeZone}">`,
      '      <h3 data-clock-zone></h3>',
      `      <h4 ${clockMarkup}></h4>`,
      ...(itemDate ? [`      <small data-date data-date-format="${escapeHtml(itemDate)}"></small>`] : []),
      '    </div>',
    ].join('\n')),
    `  </div>\n</section>`,
  ].join('\n')
}

function getWorldClockConfig(source = '') {
  const document = new DOMParser().parseFromString(source, 'text/html')
  const worldClock = document.body.querySelector('section[data-world-clock]')
  if (!(worldClock instanceof HTMLElement)) return null

  const items = worldClock.querySelectorAll('[data-world-clock-item][data-clock-zone]')
  const zones = [...(items.length ? items : worldClock.querySelectorAll('[data-clock-zone]'))]
    .map((element) => getValidTimeZone(element.dataset.clockZone))
    .filter(Boolean)
  if (!zones.length) return null

  const clock = worldClock.querySelector('[data-clock]')
  const analogSize = parseInt(clock?.dataset.stWidth, 10)
  const configuredDefault = getValidTimeZone(worldClock.querySelector('[data-world-clock-items]')?.dataset.worldClockDefaultTimezone)
  const topDateFormat = [...worldClock.children]
    .find((child) => child.matches?.('[data-clock-zone]'))
    ?.querySelector('h3 > [data-date]')?.dataset.dateFormat ?? ''
  const itemDateFormat = worldClock.querySelector('[data-world-clock-item] [data-date]')?.dataset.dateFormat ?? ''

  return {
    zones: [...new Set(zones)],
    display: clock?.hasAttribute('data-analog') ? 'analog' : 'digital',
    analogSize: Number.isFinite(analogSize) ? analogSize : 100,
    defaultTimeZone: zones.includes(configuredDefault) ? configuredDefault : zones[0],
    topDateFormat,
    itemDateFormat,
  }
}

function replaceFloatingNoteWorldClock(noteId, markup) {
  const textarea = root?.querySelector?.(
    `[data-note-window-id="${noteId}"] textarea[name="content"][data-editor-field="content"]`,
  )
  if (!(textarea instanceof HTMLTextAreaElement)) return false

  const nextValue = textarea.value.replace(WORLD_CLOCK_SECTION_PATTERN, markup)
  if (nextValue === textarea.value) return false
  textarea.value = nextValue
  syncFloatingNoteEditorField(noteId, 'content', nextValue)
  updateFormDirtyState(textarea.form)
  return true
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
    syncNoteWidgets(el)
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
  if (parsed.type !== 'note') return MIN_HEIGHT
  return isNoteWindowInEditMode(windowId)
    ? Math.max(NOTE_MIN_HEIGHT, Math.ceil(window.innerHeight * 0.5))
    : NOTE_MIN_HEIGHT
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
  const minWidth = parsed.type === 'note'
    ? (isNoteWindowInEditMode(windowState?.windowId || `note:${windowState?.noteId ?? ''}`)
      ? Math.max(NOTE_MIN_WIDTH, Math.ceil(window.innerWidth * 0.5))
      : NOTE_MIN_WIDTH)
    : MIN_WIDTH
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const maxWidth = parsed.type === 'note'
    ? Math.max(minWidth, viewportWidth)
    : Math.max(MIN_WIDTH, viewportWidth - 16)
  const maxHeight = parsed.type === 'note'
    ? Math.max(minHeight, viewportHeight)
    : Math.max(minHeight, viewportHeight - 16)
  const width = Math.max(minWidth, Math.min(windowState.width, maxWidth))
  const height = Math.max(minHeight, Math.min(windowState.height, maxHeight))
  const minX = parsed.type === 'note' ? NOTE_VISIBLE_WIDTH - width : 0
  const minY = 0
  const maxX = parsed.type === 'note' ? viewportWidth - NOTE_VISIBLE_WIDTH : Math.max(0, viewportWidth - width)
  const maxY = parsed.type === 'note' ? viewportHeight - NOTE_VISIBLE_HEADER_HEIGHT : Math.max(0, viewportHeight - height)
  const x = Math.max(minX, Math.min(windowState.x, maxX))
  const y = Math.max(minY, Math.min(windowState.y, maxY))

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
  const previousDropdown = existing?.querySelector?.('[data-note-options-dropdown]')
  if (existing instanceof HTMLElement) existing.remove()

  el.insertAdjacentHTML('beforeend', noteHtml)
  const windowEl = el.querySelector(`[data-window-id="note:${CSS.escape(String(noteId))}"]`)
  if (!(windowEl instanceof HTMLElement)) return
  if (previousDropdown instanceof HTMLElement) {
    rebindOpenDropdownRoot(previousDropdown, windowEl.querySelector('[data-note-options-dropdown]'))
  }

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
  syncNoteWidgets(windowEl)
  syncPictureInPicture()
  autoFitSingleNoteWindow(noteId)
  syncZTracker()
  syncOpenNotePreviewState()
  syncFloatingNotePageScope()
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
    const dropdown = windowEl.querySelector('[data-note-options-dropdown]')
    if (dropdown instanceof HTMLElement) closeDropdown(dropdown)
    windowEl.remove()
  }
  syncNoteWidgets()
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

  if (windowEl.hasAttribute('data-note-nailed')) {
    return
  }

  const grabArea = target.closest('[data-note-window-grab]')
  if (grabArea) {
    event.preventDefault()
    startSession('move', windowEl, event)
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
    if (target.closest('button, input, textarea, select, a, summary')) return
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

export async function initializeLocalTools(appEl, pageSlug = '') {
  appRoot = appEl || appRoot
  activePageSlug = pageSlug || activePageSlug
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
  const hasTransientWidth = Number.isFinite(transientWidth) && transientWidth >= NOTE_MIN_WIDTH
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
  const hasSavedWidth = Number.isFinite(savedLayout?.width)
  const hasSavedHeight = Number.isFinite(savedLayout?.height)
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
        width: hasSavedWidth ? savedLayout.width : (
          hasTransientWidth
            ? transientWidth
            : (defaultMetaWindow.width ?? defaultWidth)
        ),
        height: hasSavedHeight ? savedLayout.height : (
          hasTransientHeight
            ? transientHeight
            : (defaultMetaWindow.height ?? 320)
        ),
        z: nextZ,
        pageSlug: getActivePageSlug(),
        autoHeight: !hasSavedHeight && !hasTransientHeight && !defaultMetaWindow.height,
        autoWidth: note.type !== 'crypt' && !hasSavedWidth && !hasTransientWidth && !defaultMetaWindow.width,
        transientInitialLayout: !hasSavedWidth && !hasSavedHeight && (hasTransientWidth || hasTransientHeight || !!defaultMetaWindow.width || !!defaultMetaWindow.height),
      },
    ]
    await mountSingleFloatingNoteWindow(parsedNoteId)
    queueSave()
  })()
}

export function focusFloatingNote(noteId) {
  const parsedNoteId = parseInt(String(noteId), 10)
  if (!Number.isInteger(parsedNoteId) || parsedNoteId <= 0) return
  const windowState = state.noteWindows.find((entry) => entry.noteId === parsedNoteId)
  if (!windowState) return

  const pageSlug = windowState.pageSlug
  if (pageSlug && pageSlug !== getActivePageSlug()) {
    document.querySelector(`[data-yai-tabs][data-ref-path="pages"] > [data-controller] [data-tab-action="open"][data-open="${CSS.escape(pageSlug)}"]`)?.click()
  }
  bringToFront(`note:${parsedNoteId}`, {persist: true, rerender: false})
}

function getVirtualNotePayload(target) {
  const raw = target?.dataset?.noteJson ?? target?.dataset?.json ?? ''
  try {
    const payload = JSON.parse(raw)
    if (!payload || Array.isArray(payload) || typeof payload.content !== 'string') return null
    return {
      title: typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim() : t('openNotes.noteTitle'),
      content: payload.content,
      type: ['html', 'code', 'links', 'text'].includes(payload.type) ? payload.type : 'html',
      style_token: normalizeNoteStyleToken(payload.style_token),
      preview: typeof payload.preview === 'string' ? payload.preview.trim() : '',
      source_url: typeof payload.source_url === 'string' ? payload.source_url : null,
      source_title: typeof payload.source_title === 'string' ? payload.source_title : null,
      width: Number(payload.width),
      height: Number(payload.height),
    }
  } catch {
    return null
  }
}

export function openVirtualNote(target) {
  const payload = getVirtualNotePayload(target)
  if (!payload) return

  const existingId = Number(target?.dataset?.virtualNoteId)
  if (virtualNoteIds.has(existingId) && state.noteWindows.some((entry) => entry.noteId === existingId)) {
    bringToFront(`note:${existingId}`, {persist: false, rerender: false})
    return
  }

  const noteId = 9_000_000_000 + ++virtualNoteSequence
  const nextZ = Math.max(state.zIndexTracker + 1, 221)
  const offset = isMobileNoteViewport() ? 0 : state.noteWindows.length * 20
  const width = Number.isFinite(payload.width) && payload.width >= NOTE_MIN_WIDTH ? payload.width : 420
  const height = Number.isFinite(payload.height) && payload.height >= NOTE_MIN_HEIGHT ? payload.height : 320
  virtualNoteIds.add(noteId)
  noteRecords.set(noteId, {id: noteId, ...payload, virtual: true})
  state.zIndexTracker = nextZ
  state.noteWindows = [...state.noteWindows, {
    noteId,
    x: 40 + offset,
    y: 72 + offset,
    width,
    height,
    z: nextZ,
    pageSlug: getActivePageSlug(),
    autoHeight: !Number.isFinite(payload.height),
    autoWidth: !Number.isFinite(payload.width),
  }]
  if (target?.dataset) target.dataset.virtualNoteId = String(noteId)
  void mountSingleFloatingNoteWindow(noteId)
}

export async function toggleVirtualNoteMarkup(noteId) {
  const parsedNoteId = Number(noteId)
  if (!virtualNoteIds.has(parsedNoteId)) return
  const current = getWindowState(`note:${parsedNoteId}`)
  if (!current) return
  setWindowState(`note:${parsedNoteId}`, {virtualMarkup: current.virtualMarkup !== true})
  await mountSingleFloatingNoteWindow(parsedNoteId)
}

export async function saveVirtualNoteToInbox(noteId) {
  const parsedNoteId = Number(noteId)
  if (!virtualNoteIds.has(parsedNoteId)) return
  const note = noteRecords.get(parsedNoteId)
  if (!note) return
  const result = await createCaptureInboxItem({
    kind: 'note',
    title: note.title ?? null,
    text: note.content ?? '',
    url: null,
    source_url: note.source_url ?? null,
    source_title: note.source_title ?? note.title ?? null,
    meta_json: JSON.stringify({
      note_type: note.type,
      style_token: note.style_token,
      preview: note.preview || undefined,
    }),
  })
  const {syncCaptureInboxChrome} = await import('../../app/bootstrap.js')
  syncCaptureInboxChrome(result.count)
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

export async function saveFloatingNoteWindowOption(noteId, field, value) {
  const parsedNoteId = parseInt(String(noteId), 10)
  const metaKey = {
    note_hide_header: 'hide_header',
    note_reset_padding: 'reset_padding',
    note_bare: 'bare',
    note_nailed: 'nailed',
    note_show_on_all_pages: 'show_on_all_pages',
  }[field]
  if (!Number.isInteger(parsedNoteId) || parsedNoteId <= 0 || !metaKey) return

  const note = await loadNoteById(parsedNoteId)
  if (!note) return

  const meta = parseNoteMeta(note.meta_json ?? null)
  const windowMeta = meta.window && typeof meta.window === 'object' ? {...meta.window} : {}
  if (value === true) windowMeta[metaKey] = true
  else delete windowMeta[metaKey]
  if (Object.keys(windowMeta).length) meta.window = windowMeta
  else delete meta.window

  const meta_json = Object.keys(meta).length ? JSON.stringify(meta) : null
  await saveNoteData(parsedNoteId, {meta_json})
  noteRecords.set(parsedNoteId, {...note, meta_json})
  if (field === 'note_show_on_all_pages' && value !== true) {
    const dropdown = root?.querySelector?.(`[data-note-window-id="${parsedNoteId}"] [data-note-options-dropdown]`)
    if (dropdown instanceof HTMLElement) closeDropdown(dropdown)
  }
  await mountSingleFloatingNoteWindow(parsedNoteId)
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
    expandFloatingNoteEditor(parsedNoteId)
    await mountSingleFloatingNoteWindow(parsedNoteId)
    return
  }
  setEditorSession(parsedNoteId, normalizeEditorSession(note))
  syncShellTabsEditorMode()
  expandFloatingNoteEditor(parsedNoteId)
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
  const editor = getEditorSession(parsedNoteId)
  editorSessions.delete(parsedNoteId)
  restoreFloatingNoteEditorSize(parsedNoteId, editor)
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
  if (field === 'preview') patch.editPreview = String(value ?? '')
  if (field === 'note_hide_header') patch.noteHideHeader = value === true
  if (field === 'note_reset_padding') patch.noteResetPadding = value === true
  if (field === 'note_bare') patch.noteBare = value === true
  if (field === 'note_nailed') patch.noteNailed = value === true
  if (field === 'note_show_on_all_pages') patch.noteShowOnAllPages = value === true
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

export async function toggleFloatingNoteWorldClockGenerator(noteId) {
  const parsedNoteId = parseInt(String(noteId), 10)
  const current = getEditorSession(parsedNoteId)
  if (!current) return
  const openingGenerator = current.worldClockGenerator !== true
  const existingClock = openingGenerator ? getWorldClockConfig(current.editContent) : null
  setEditorSession(parsedNoteId, {
    worldClockGenerator: openingGenerator,
    worldClockZones: existingClock?.zones.join('\n') || current.worldClockZones || DEFAULT_WORLD_CLOCK_ZONES,
    worldClockDisplay: existingClock?.display || current.worldClockDisplay || 'digital',
    worldClockAnalogSize: existingClock?.analogSize || current.worldClockAnalogSize || 100,
    worldClockDefaultTimezone: existingClock?.defaultTimeZone || current.worldClockDefaultTimezone || DEFAULT_WORLD_CLOCK_ZONES.split('\n')[0],
    worldClockTopDateFormat: existingClock?.topDateFormat ?? current.worldClockTopDateFormat ?? '',
    worldClockItemDateFormat: existingClock?.itemDateFormat ?? current.worldClockItemDateFormat ?? '',
  })
  await mountSingleFloatingNoteWindow(parsedNoteId)
}

export function toggleFloatingNoteWorldClockAnalogSize(target) {
  target?.closest?.('[data-world-clock-generator]')
    ?.querySelector?.('[data-world-clock-analog-size]')
    ?.toggleAttribute('hidden', target.value !== 'analog')
}

export function filterFloatingNoteWorldClockZones(target) {
  const query = String(target?.value ?? '').trim().toLowerCase()
  const generator = target?.closest?.('[data-world-clock-generator]')
  generator
    ?.querySelectorAll?.('[data-world-clock-zone-group]')
    .forEach((group) => {
      const matches = [...group.querySelectorAll('[data-world-clock-zone-option]')]
        .filter((option) => option.dataset.worldClockZoneOption.toLowerCase().includes(query))
      group.toggleAttribute('hidden', Boolean(query) && !matches.length)
      if (query && matches.length) group.open = true
      group.querySelectorAll('[data-world-clock-zone-option]').forEach((option) => {
        option.toggleAttribute('hidden', Boolean(query) && !option.dataset.worldClockZoneOption.toLowerCase().includes(query))
      })
    })
  filterFloatingNoteWorldClockDefaultTimezoneOptions(generator, query)
}

function filterFloatingNoteWorldClockDefaultTimezoneOptions(generator, query = '') {
  generator?.querySelectorAll?.('[data-world-clock-default-zone]').forEach((option) => {
    const timeZone = option.querySelector('input')?.value?.toLowerCase() ?? ''
    option.toggleAttribute('hidden', Boolean(query) && !timeZone.includes(query))
  })
}

export function syncFloatingNoteWorldClockDefaultTimezone(target) {
  const generator = target?.closest?.('[data-world-clock-generator]')
  const option = target?.closest?.('[data-world-clock-zone-option]')
  option?.toggleAttribute('data-tz-selected', target.checked === true)
  generator?.querySelectorAll?.('[data-world-clock-zone-group]').forEach((group) => {
    const zones = group.querySelectorAll('[name="worldclock_zone"]')
    const selected = group.querySelectorAll('[name="worldclock_zone"]:checked')
    const summary = group.querySelector('summary')
    if (summary) summary.textContent = `${group.dataset.worldClockZoneGroup} (${selected.length}/${zones.length})`
  })
  const selectedZones = [...generator?.querySelectorAll?.('[name="worldclock_zone"]:checked') ?? []].map((input) => input.value)
  const selectedDefault = generator?.querySelector?.('[name="worldclock_default_timezone"]:checked')?.value
  const options = generator?.querySelector?.('[data-world-clock-default-timezone-options]')
  if (options instanceof HTMLElement) {
    options.outerHTML = renderWorldClockDefaultTimezoneOptions(selectedZones, selectedDefault)
    filterFloatingNoteWorldClockDefaultTimezoneOptions(generator, String(generator.querySelector('[name="worldclock_filter"]')?.value ?? '').trim().toLowerCase())
  }
}

export function generateFloatingNoteWorldClock(noteId, zones = [], options = {}) {
  const parsedNoteId = parseInt(String(noteId), 10)
  const current = getEditorSession(parsedNoteId)
  const existingClock = getWorldClockConfig(current?.editContent)
  const selectedZones = [...new Set(zones
    .map((value) => getValidTimeZone(value))
    .filter(Boolean))]
  if (!selectedZones.length) return

  const display = options.display === 'analog' ? 'analog' : 'digital'
  const analogSize = Math.min(500, Math.max(60, parseInt(options.analogSize, 10) || 100))
  const defaultTimeZone = selectedZones.includes(options.defaultTimeZone) ? options.defaultTimeZone : selectedZones[0]
  const topDateFormat = String(options.topDateFormat ?? '').trim()
  const itemDateFormat = String(options.itemDateFormat ?? '').trim()

  const markup = buildWorldClockMarkup(selectedZones, {display, analogSize, defaultTimeZone, topDateFormat, itemDateFormat})
  if (existingClock) replaceFloatingNoteWorldClock(parsedNoteId, markup)
  else insertFloatingNoteTemplate(parsedNoteId, () => markup)
  setEditorSession(parsedNoteId, {
    worldClockGenerator: false,
    worldClockZones: selectedZones.join('\n'),
    worldClockDisplay: display,
    worldClockAnalogSize: analogSize,
    worldClockDefaultTimezone: defaultTimeZone,
    worldClockTopDateFormat: topDateFormat,
    worldClockItemDateFormat: itemDateFormat,
  })
  root?.querySelector?.(`[data-note-window-id="${parsedNoteId}"] [data-world-clock-generator]`)?.remove()
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
  const notePreview = form.querySelector('[name="preview"]')?.value?.trim() ?? ''
  const noteHideHeader = form.elements.namedItem('note_hide_header')?.checked === true
  const noteResetPadding = form.elements.namedItem('note_reset_padding')?.checked === true
  const noteBare = form.elements.namedItem('note_bare')?.checked === true
  const noteNailed = form.elements.namedItem('note_nailed')?.checked === true
  const noteShowOnAllPages = form.elements.namedItem('note_show_on_all_pages')?.checked === true

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

  const existingMeta = parseNoteMeta(note.meta_json ?? null)
  const payloadMeta = parseNoteMeta(payload.meta_json ?? null)
  const windowMeta = {...(existingMeta.window && typeof existingMeta.window === 'object' ? existingMeta.window : {})}
  if (noteHideHeader) windowMeta.hide_header = true
  else delete windowMeta.hide_header
  if (noteResetPadding) windowMeta.reset_padding = true
  else delete windowMeta.reset_padding
  if (noteBare) windowMeta.bare = true
  else delete windowMeta.bare
  if (noteNailed) windowMeta.nailed = true
  else delete windowMeta.nailed
  if (noteShowOnAllPages) windowMeta.show_on_all_pages = true
  else delete windowMeta.show_on_all_pages
  const nextMeta = {...existingMeta, ...payloadMeta}
  if (notePreview) nextMeta.preview = notePreview
  else delete nextMeta.preview
  if (Object.keys(windowMeta).length) nextMeta.window = windowMeta
  else delete nextMeta.window
  payload.meta_json = Object.keys(nextMeta).length ? JSON.stringify(nextMeta) : null

  await saveNoteData(parsedNoteId, payload)
  noteRecords.set(parsedNoteId, {
    ...note,
    ...payload,
  })

  if (note.type === 'crypt') {
    cryptSessions.delete(parsedNoteId)
  }

  const editor = getEditorSession(parsedNoteId)
  editorSessions.delete(parsedNoteId)
  restoreFloatingNoteEditorSize(parsedNoteId, editor)
  syncShellTabsEditorMode()
  await mountSingleFloatingNoteWindow(parsedNoteId)
  const moduleSyncId = document.querySelector(`[data-note-id="${CSS.escape(String(parsedNoteId))}"][data-module-sync-id]`)?.getAttribute('data-module-sync-id')
  if (moduleSyncId) {
    const {refreshModuleContent} = await import('../../app/bootstrap.js')
    await refreshModuleContent(moduleSyncId)
  }
  return true
}
