import {db, isActiveRecord} from '../../../db/db.ts'
import {on} from '../../app/dispatch.js'
import {renderSearchChrome, renderSearchPanel} from './render.js'
import {t} from '../../utils/i18n.js'

const SEARCH_RESULT_LIMIT = 80
const SEARCH_HIGHLIGHT_MS = 4200

const state = {
  open: false,
  panelVisible: false,
  query: '',
  results: [],
  expandedIds: new Set(),
}

let hydratedListenerCleanup = null
let searchHighlightResetHandle = null

function getKindLabels() {
  return {
    bookmark: t('app.searchKinds.bookmark'),
    note: t('app.searchKinds.note'),
    feed_source: t('app.searchKinds.feedSource'),
    archived_feed_item: t('app.searchKinds.archivedFeedItem'),
  }
}

function replaceNode(selector, markup) {
  const node = document.querySelector(selector)
  if (!(node instanceof HTMLElement)) return null
  node.outerHTML = markup
  const attrName = selector.replace(/^[^[]*\[|\].*$/g, '')
  return document.querySelector(selector) ?? document.querySelector(`[${attrName}]`)
}

function renderSearchChromeUi() {
  replaceNode('[data-speedtab-search]', renderSearchChrome(state))
}

function renderSearchPanelUi() {
  replaceNode('[data-search-panel]', renderSearchPanel({
    ...state,
    kindLabels: getKindLabels(),
  }))
}

function renderSearchUi() {
  renderSearchChromeUi()
  renderSearchPanelUi()
}

function focusSearchInput({select = false} = {}) {
  requestAnimationFrame(() => {
    const input = document.querySelector('[data-search-input]')
    if (!(input instanceof HTMLInputElement)) return
    input.focus()
    if (select) input.select()
  })
}

function makeSnippet(value, max = 300) {
  if (!value) return null
  const normalized = String(value).replace(/\s+/g, ' ').trim()
  if (!normalized) return null
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized
}

function includesQuery(value, query) {
  return typeof value === 'string' && value.toLocaleLowerCase().includes(query)
}

function pathForCollection(collectionId, collectionById, moduleById, pageById) {
  const collection = collectionId != null ? collectionById.get(collectionId) : null
  const module = collection ? moduleById.get(collection.module_id) : null
  const page = module ? pageById.get(module.page_id) : null

  return {
    pageSlug: page?.slug ?? null,
    moduleId: module?.id ?? null,
    path: [page?.title, module?.title, collection?.title].filter(Boolean).join(' / '),
  }
}

async function runSearch(query) {
  const normalizedQuery = String(query ?? '').trim().toLocaleLowerCase()
  if (!normalizedQuery) {
    state.results = []
    state.expandedIds = new Set()
    renderSearchPanelUi()
    return
  }

  const [pages, modules, collections, bookmarks, notes, feedSources, savedFeedItems] = await Promise.all([
    db.pages.filter(isActiveRecord).toArray(),
    db.modules.filter(isActiveRecord).toArray(),
    db.collections.filter(isActiveRecord).toArray(),
    db.tabs.filter(isActiveRecord).toArray(),
    db.notes.filter(isActiveRecord).toArray(),
    db.feed_sources.filter(isActiveRecord).toArray(),
    db.saved_feed_items.filter(isActiveRecord).toArray(),
  ])

  if (normalizedQuery !== state.query.trim().toLocaleLowerCase()) return

  const pageById = new Map(pages.map((page) => [page.id, page]))
  const moduleById = new Map(modules.map((module) => [module.id, module]))
  const collectionById = new Map(collections.map((collection) => [collection.id, collection]))
  const results = []

  for (const tab of bookmarks) {
    const matchedFields = [tab.title, tab.url].filter((value) => includesQuery(value, normalizedQuery))
    if (!matchedFields.length) continue
    const pathInfo = pathForCollection(tab.collection_id, collectionById, moduleById, pageById)
    results.push({
      id: `bookmark:${tab.id}`,
      kind: 'bookmark',
      title: tab.title || tab.url || t('app.searchKinds.bookmark'),
      path: pathInfo.path,
      pageSlug: pathInfo.pageSlug,
      moduleId: pathInfo.moduleId,
      collectionId: tab.collection_id,
      entityId: tab.id ?? null,
      externalUrl: tab.url,
      snippet: makeSnippet(tab.description || tab.url),
      fields: matchedFields,
    })
  }

  for (const note of notes) {
    const matchedFields = [note.title, note.content].filter((value) => includesQuery(value, normalizedQuery))
    if (!matchedFields.length) continue
    const pathInfo = pathForCollection(note.collection_id, collectionById, moduleById, pageById)
    results.push({
      id: `note:${note.id}`,
      kind: 'note',
      title: note.title || t('openNotes.noteTitle'),
      path: pathInfo.path,
      pageSlug: pathInfo.pageSlug,
      moduleId: pathInfo.moduleId,
      collectionId: note.collection_id,
      entityId: note.id ?? null,
      externalUrl: null,
      snippet: makeSnippet(note.content),
      fields: matchedFields,
    })
  }

  for (const source of feedSources) {
    const matchedFields = [source.title, source.feed_url, source.site_url].filter((value) => includesQuery(value, normalizedQuery))
    if (!matchedFields.length) continue
    const pathInfo = pathForCollection(source.collection_id, collectionById, moduleById, pageById)
    results.push({
      id: `feed_source:${source.id}`,
      kind: 'feed_source',
      title: source.title || source.feed_url || t('app.searchKinds.feedSource'),
      path: pathInfo.path,
      pageSlug: pathInfo.pageSlug,
      moduleId: pathInfo.moduleId,
      collectionId: source.collection_id,
      entityId: source.id ?? null,
      externalUrl: source.site_url || source.feed_url,
      snippet: makeSnippet(source.feed_url),
      fields: matchedFields,
    })
  }

  for (const item of savedFeedItems) {
    const matchedFields = [item.title, item.comment, item.summary, item.url].filter((value) => includesQuery(value, normalizedQuery))
    if (!matchedFields.length) continue
    const pathInfo = pathForCollection(item.collection_id, collectionById, moduleById, pageById)
    results.push({
      id: `archived_feed_item:${item.id}`,
      kind: 'archived_feed_item',
      title: item.title || item.source_title || t('app.statuses.archivedFeedItemFallback'),
      path: pathInfo.path,
      pageSlug: pathInfo.pageSlug,
      moduleId: pathInfo.moduleId,
      collectionId: item.collection_id,
      entityId: item.id ?? null,
      externalUrl: item.url,
      snippet: makeSnippet(item.comment || item.summary || item.url),
      fields: matchedFields,
    })
  }

  state.results = results.slice(0, SEARCH_RESULT_LIMIT)
  state.expandedIds = new Set()
  renderSearchPanelUi()
}

function clearSearchHighlight() {
  document.querySelectorAll('[data-search-highlight]').forEach((element) => {
    element.removeAttribute('data-search-highlight')
  })
  if (searchHighlightResetHandle !== null) {
    window.clearTimeout(searchHighlightResetHandle)
    searchHighlightResetHandle = null
  }
}

function applySearchHighlight(moduleId, resultKind, entityId) {
  clearSearchHighlight()

  const selectors = []
  if (moduleId != null) selectors.push(`[data-module-card][data-module-id="${CSS.escape(String(moduleId))}"]`)
  if (entityId != null) {
    if (resultKind === 'bookmark') selectors.unshift(`[data-bookmark-id="${CSS.escape(String(entityId))}"]`)
    if (resultKind === 'note') selectors.unshift(`[data-note-id="${CSS.escape(String(entityId))}"]`)
    if (resultKind === 'feed_source') selectors.unshift(`[data-feed-source-id="${CSS.escape(String(entityId))}"]`)
  }

  const node = selectors
    .map((selector) => document.querySelector(selector))
    .find((element) => element instanceof HTMLElement)

  if (!(node instanceof HTMLElement)) return
  node.setAttribute('data-search-highlight', '')
  node.scrollIntoView({behavior: 'smooth', block: 'nearest', inline: 'nearest'})

  searchHighlightResetHandle = window.setTimeout(() => {
    node.removeAttribute('data-search-highlight')
    searchHighlightResetHandle = null
  }, SEARCH_HIGHLIGHT_MS)
}

function waitFor(check, timeout = 2400) {
  const start = performance.now()
  return new Promise((resolve) => {
    function step() {
      const value = check()
      if (value) {
        resolve(value)
        return
      }
      if (performance.now() - start >= timeout) {
        resolve(null)
        return
      }
      requestAnimationFrame(step)
    }
    step()
  })
}

async function ensurePageOpen(pageSlug) {
  const active = document.querySelector('[data-app-header-nav] [data-tab-action="open"][aria-selected="true"]')
  if (active instanceof HTMLElement && active.dataset.open === pageSlug) {
    return true
  }

  const trigger = document.querySelector(`[data-app-header-nav] [data-tab-action="open"][data-open="${CSS.escape(pageSlug)}"]`)
  if (!(trigger instanceof HTMLElement)) return false
  trigger.click()

  const hydrated = await waitFor(() =>
    document.querySelector(`[data-app-tab-content][data-page-slug="${CSS.escape(pageSlug)}"][data-page-hydrated]`)
  )

  return hydrated instanceof HTMLElement
}

async function ensureCollectionOpen(moduleId, collectionId) {
  if (moduleId == null || collectionId == null) return
  const moduleTabs = await waitFor(() =>
    document.querySelector(`[data-yai-tabs][data-ref-path="m${CSS.escape(String(moduleId))}"]`)
  )
  if (!(moduleTabs instanceof HTMLElement)) return

  const trigger = moduleTabs.querySelector(`:scope > nav[data-controller] [data-tab-id="${CSS.escape(String(collectionId))}"]`)
  if (trigger instanceof HTMLElement) trigger.click()
}

function ensureHydratedListenerBound() {
  hydratedListenerCleanup?.()
  hydratedListenerCleanup = on('page-hydrated', () => {
    if (!state.open && !state.query.trim()) return
    renderSearchUi()
  })
}

export function initializeSearch() {
  ensureHydratedListenerBound()
  renderSearchUi()
}

export function openSearch() {
  state.open = true
  state.panelVisible = true
  renderSearchUi()
  focusSearchInput({select: true})
}

function resetSearchState() {
  state.query = ''
  state.results = []
  state.expandedIds = new Set()
}

function collapseSearchPanel() {
  state.panelVisible = false
  renderSearchPanelUi()
}

export function closeSearch() {
  resetSearchState()
  state.open = false
  state.panelVisible = false
  renderSearchUi()
}

export function isSearchOpen() {
  return state.open === true
}

export function searchFocus() {
  if (!state.open) {
    state.open = true
    renderSearchChromeUi()
  }
  state.panelVisible = true
  renderSearchPanelUi()
}

export function updateSearchQuery(value) {
  state.query = String(value ?? '')
  state.open = true
  state.panelVisible = true
  renderSearchPanelUi()
  void runSearch(state.query)
}

export function toggleSearchResult(resultId) {
  if (!resultId) return
  if (state.expandedIds.has(resultId)) {
    state.expandedIds.delete(resultId)
  } else {
    state.expandedIds.add(resultId)
  }
  renderSearchPanelUi()
}

export async function locateSearchResult(resultId) {
  const result = state.results.find((entry) => entry.id === resultId)
  if (!result?.pageSlug) return

  await ensurePageOpen(result.pageSlug)
  await ensureCollectionOpen(result.moduleId, result.collectionId)
  state.open = false
  state.panelVisible = false
  renderSearchUi()
  applySearchHighlight(result.moduleId, result.kind, result.entityId)
}

export function handleOutsideSearchClick(target) {
  if (state.open !== true) return
  if (target?.closest?.('[data-speedtab-search], [data-search-panel]')) return
  collapseSearchPanel()
}
