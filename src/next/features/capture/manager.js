import {openModal, closeModal, isModalOpen} from '../../components/modal.js'
import {isBookmarkModuleType} from '../../config/module-types.js'
import {createBookmark} from '../../data/bookmarks.js'
import {deleteCaptureInboxItem, loadCaptureInboxContext, loadCaptureInboxItems} from '../../data/capture-inbox.js'
import {createNoteData, loadNoteById, saveNoteData} from '../../data/notes.js'
import {readActiveFieldState, replaceNode, restoreActiveFieldState} from '../../utils/dom-patch.js'
import {t} from '../../utils/i18n.js'
import {renderCaptureInboxModal} from './render.js'

const state = {
  items: [],
  pages: [],
  modules: [],
  collections: [],
  notes: [],
  activeItemId: null,
  selectedModuleId: null,
  selectedCollectionId: null,
  selectedNoteId: null,
  draftNoteText: '',
}

function buildModuleLabel(module) {
  return module.pageTitle ? `${module.pageTitle} › ${module.title}` : module.title
}

function getActiveItem() {
  return state.items.find((item) => item.id === state.activeItemId) ?? state.items[0] ?? null
}

function getEligibleModules(item = getActiveItem()) {
  if (!item) return []
  return state.modules
    .filter((module) => item.kind === 'note'
      ? module.type === 'notes'
      : isBookmarkModuleType(module.type))
    .map((module) => ({...module, label: buildModuleLabel(module)}))
}

function getEligibleCollections() {
  if (!state.selectedModuleId) return []
  return state.collections.filter((collection) => collection.module_id === state.selectedModuleId)
}

function getEligibleNotes(item = getActiveItem()) {
  if (item?.kind !== 'note' || !state.selectedCollectionId) return []
  return state.notes.filter((note) => note.collection_id === state.selectedCollectionId)
}

function initializeSelection(item = getActiveItem()) {
  const firstModule = getEligibleModules(item)[0] ?? null
  state.selectedModuleId = firstModule?.id ?? null
  const firstCollection = state.collections.find((collection) => collection.module_id === firstModule?.id) ?? null
  state.selectedCollectionId = firstCollection?.id ?? null
  state.selectedNoteId = null
  state.draftNoteText = item?.kind === 'note' ? (item.text ?? '') : ''
}

function buildRenderState() {
  const activeItem = getActiveItem()
  return {
    ...state,
    activeItem,
    eligibleModules: getEligibleModules(activeItem),
    eligibleCollections: getEligibleCollections(),
    eligibleNotes: getEligibleNotes(activeItem),
  }
}

function getSelectedModuleSyncId() {
  return state.modules.find((module) => module.id === state.selectedModuleId)?.sync_id ?? ''
}

function renderModalBody() {
  const modalBody = document.querySelector('[data-modal-body]')
  if (!(modalBody instanceof HTMLElement)) return
  const activeState = readActiveFieldState()
  const markup = renderCaptureInboxModal(buildRenderState())
  const current = modalBody.querySelector('[data-capture-inbox], [data-capture-empty]')

  if (current instanceof HTMLElement) {
    const next = replaceNode(current, markup)
    if (next instanceof HTMLElement) {
      restoreActiveFieldState(next, activeState)
      return
    }
  }

  modalBody.innerHTML = markup
  const next = modalBody.querySelector('[data-capture-inbox], [data-capture-empty]')
  if (next instanceof HTMLElement) {
    restoreActiveFieldState(next, activeState)
  }
}

async function refreshState() {
  const [items, context] = await Promise.all([
    loadCaptureInboxItems(),
    loadCaptureInboxContext(),
  ])
  const pageMap = new Map(context.pages.map((page) => [page.id, page.title]))

  state.items = items
  state.pages = context.pages
  state.modules = context.modules.map((module) => ({
    ...module,
    pageTitle: pageMap.get(module.page_id) ?? '',
  }))
  state.collections = context.collections
  state.notes = context.notes

  if (!items.length) {
    state.activeItemId = null
    state.selectedModuleId = null
    state.selectedCollectionId = null
    state.selectedNoteId = null
    state.draftNoteText = ''
    return
  }

  if (!items.some((item) => item.id === state.activeItemId)) {
    state.activeItemId = items[0]?.id ?? null
    initializeSelection()
  }
}

function buildMetaJson(item) {
  return JSON.stringify({
    capture_source_url: item.source_url,
    capture_source_title: item.source_title,
    capture_hash: item.external_hash,
  })
}

async function saveActiveItem() {
  const item = getActiveItem()
  if (!item || !state.selectedCollectionId) return

  const meta_json = buildMetaJson(item)

  if (item.kind === 'note') {
    if (state.selectedNoteId) {
      const existing = await loadNoteById(state.selectedNoteId)
      if (existing?.type === 'crypt') return
      if (existing) {
        const sourceLine = item.source_title || item.source_url
        const appendedParts = [existing.content]
        if (sourceLine) {
          appendedParts.push(`\n\n---\n\n${t('app.statuses.capturedFrom', {source: sourceLine})}`)
        } else {
          appendedParts.push('\n\n---')
        }
        if (item.source_url) appendedParts.push(`\n${item.source_url}`)
        if (state.draftNoteText) appendedParts.push(`\n\n${state.draftNoteText}`)

        await saveNoteData(existing.id, {
          content: appendedParts.join(''),
          meta_json,
          updated_at: Date.now(),
        })
      }
    } else {
      await createNoteData(state.selectedCollectionId, {
        title: item.title || t('app.statuses.capturedNoteTitle'),
        type: 'text',
        content: state.draftNoteText || '',
        style_token: null,
        meta_json,
      })
    }
  } else {
    await createBookmark(state.selectedCollectionId, {
      title: item.title || item.url || t('app.statuses.capturedBookmarkTitle'),
      url: item.url || '',
      description: item.text || item.source_title || null,
      favicon_asset_id: null,
      preview_asset_id: null,
      meta_json,
    })
  }

  await deleteCaptureInboxItem(item.id)
}

export async function openCaptureInbox() {
  await refreshState()
  openModal({
    title: t('capture.inboxTitle'),
    content: renderCaptureInboxModal(buildRenderState()),
    panelClass: 'st-capture-modal',
  })
}

export function selectCaptureItem(itemId) {
  if (!itemId) return
  state.activeItemId = Number(itemId)
  initializeSelection()
  renderModalBody()
}

export function updateCaptureDraft(value = '') {
  state.draftNoteText = value
}

export function selectCaptureModule(moduleId) {
  state.selectedModuleId = moduleId ? Number(moduleId) : null
  const firstCollection = state.collections.find((collection) => collection.module_id === state.selectedModuleId) ?? null
  state.selectedCollectionId = firstCollection?.id ?? null
  state.selectedNoteId = null
  renderModalBody()
}

export function selectCaptureCollection(collectionId) {
  state.selectedCollectionId = collectionId ? Number(collectionId) : null
  state.selectedNoteId = null
  renderModalBody()
}

export function selectCaptureNote(noteId) {
  state.selectedNoteId = noteId ? Number(noteId) : null
}

export async function discardCaptureItem(itemId) {
  if (!itemId) return
  await deleteCaptureInboxItem(itemId)
  await refreshState()
  if (!state.items.length) {
    closeModal()
  } else if (isModalOpen()) {
    renderModalBody()
  }
  const {syncCaptureInboxChrome} = await import('../../app/bootstrap.js')
  syncCaptureInboxChrome(state.items.length)
}

export async function saveCaptureItem() {
  const moduleSyncId = getSelectedModuleSyncId()
  await saveActiveItem()
  await refreshState()
  if (!state.items.length) {
    closeModal()
  } else if (isModalOpen()) {
    renderModalBody()
  }
  const {refreshModuleContent, syncCaptureInboxChrome} = await import('../../app/bootstrap.js')
  syncCaptureInboxChrome(state.items.length)
  if (moduleSyncId) {
    await refreshModuleContent(moduleSyncId)
  }
}
