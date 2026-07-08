import {useFeed} from '../../composables/useFeed.ts'
import {db} from '../../db/db.ts'
import {SPEEDTAB_SVG} from '../components/icons.js'
import {closeModal, openModal} from '../components/modal.js'
import {closeSidepanel, onSidepanelClose, openSidepanel} from '../components/sidepanel.js'
import {createBookmark, loadBookmarkBySyncId, saveBookmarkData, softDeleteBookmark} from '../data/bookmarks.js'
import {clearFeedItemsBySourceIds, createFeedSourceData, createSavedFeedItemData, loadFeedItemById, loadFeedItemsBySourceIds, loadFeedSourceById, loadFeedSourceBySyncId, loadFeedSourcesByCollectionId, loadSavedFeedItemsByCollectionId, saveFeedSourceData, softDeleteFeedSource, softDeleteSavedFeedItem} from '../data/feeds.js'
import {loadModuleBySyncId} from '../data/modules.js'
import {createNoteData, softDeleteNote} from '../data/notes.js'
import {createModuleTab, loadModuleTabById, loadModuleTabBySyncId, saveModuleTabData, softDeleteModuleTab} from '../data/tabs.js'
import {upsertUiConfig} from '../data/ui-config.js'
import {applyModuleUiConfig} from '../features/customizer/apply.js'
import {initFormDirtyState, renderSidepanelDeleteFooter, updateFormDirtyState} from '../features/forms/actions.js'
import {closeFloatingNote, openFloatingNote, startFloatingNoteEdit} from '../features/local-tools/manager.js'
import {
  afterBookmarkFormRender,
  applyBookmarkPreviewCrop,
  bookmarkCropFlipX,
  bookmarkCropFlipY,
  bookmarkCropMove,
  bookmarkCropZoom,
  buildBookmarkSavePayload,
  clearBookmarkFavicon,
  clearBookmarkPreview,
  initBookmarkFormState,
  renderBookmarkCrudForm,
  rerenderBookmarkForm,
  resetBookmarkFormState,
  selectBookmarkFaviconAsset,
  selectBookmarkPreviewAsset,
  syncBookmarkFormStateFromForm,
  testBookmarkUrl,
  toggleBookmarkFaviconPicker,
  toggleBookmarkPreviewPicker,
  uploadBookmarkFavicon,
  uploadBookmarkPreview,
} from '../features/modules/bookmark-form.js'
import {getCrudPanelTitle, renderModuleCrudForm} from '../features/modules/crud-form.js'
import {
  canSaveFeedSourceForm,
  getFeedFormState,
  initFeedFormState,
  lookupFeedSourceUrls,
  renderFeedSourceCrudForm,
  resetFeedFormState,
  syncFeedFormStateFromForm,
  testFeedSourceUrl,
  useDiscoveredFeedUrl,
} from '../features/modules/feed-form.js'
import {addFeedLatestItems, closeFeedFocusState, computeFeedCollectionViewModel, getFeedUiState, initFeedFavicons, openFeedFocusState, renderFeedCollection, renderFeedContentZone, renderFeedFocusControls, renderFeedItem, renderFeedItemBody, renderFeedSidebarFooter, renderFeedToolbar, setFeedFocusWidth, setFeedRefreshingState, setFeedSourceLoadingState, toggleFeedItemExpansionState, toggleFeedLatestState, toggleFeedLoadedState, toggleFeedSourceState, toggleFeedUnreadState} from '../features/modules/feeds.js'
import {
  afterNoteFormRender,
  buildNoteSavePayload,
  initNoteFormState,
  renderNoteCrudForm,
  rerenderNoteForm,
  setNoteFormStyle,
  setNoteFormType,
  syncNoteFormStateFromForm,
  unlockNoteForm,
} from '../features/modules/note-form.js'
import {getVisibleBookmarkMediaScope, initBookmarkMedia} from '../utils/bookmark-media.js'
import {escapeHtml} from '../utils/html.js'
import {t} from '../utils/i18n.js'

const feedApi = useFeed()

function getOpenSidepanelBody() {
  return document.querySelector('[data-sidepanel][data-sidepanel-open] [data-sidepanel-body]')
}

function getOpenModalBody() {
  return document.querySelector('[data-modal][data-modal-open] [data-modal-body]')
}

function rerenderFeedForm(body = null) {
  const target = body || getOpenSidepanelBody()
  const state = getFeedFormState()
  if (!target || !state) return
  target.innerHTML = renderFeedSourceCrudForm(state)
  initFormDirtyState(target, {useExistingBaseline: true})
}

function getFeedFocusWidthStyle(width) {
  if (width === 'max') return '100vw'
  const parsed = parseInt(String(width), 10)
  if (Number.isInteger(parsed) && parsed > 0) return `${parsed}px`
  return '740px'
}

function getFeedFocusElements(moduleSyncId) {
  const moduleCard = getModuleRoot(moduleSyncId)
  const gridCol = moduleCard?.closest?.('[data-grid-col]')
  const appContent = moduleCard?.closest?.('main[data-app-content]') || null
  const appRoot = moduleCard?.closest?.('[data-app]') || null
  return {moduleCard, gridCol, appContent, appRoot}
}

function primeFeedFocusPlaceholder(moduleSyncId) {
  const {gridCol} = getFeedFocusElements(moduleSyncId)
  if (!(gridCol instanceof HTMLElement)) return

  gridCol.setAttribute('data-feed-focus-placeholder', '')
  // IMPORTANT: capture the placeholder height from the wrapper itself, before
  // anything is moved into focus mode. Never derive this from the expanded feed.
  gridCol.style.setProperty('--st-feed-focus-placeholder-height', `${Math.ceil(gridCol.getBoundingClientRect().height)}px`)
}

function applyFeedFocusMode(moduleSyncId, collectionId) {
  const state = getFeedUiState(moduleSyncId, collectionId)
  const {moduleCard, gridCol, appContent, appRoot} = getFeedFocusElements(moduleSyncId)
  if (!(moduleCard instanceof HTMLElement) || !(gridCol instanceof HTMLElement)) return

  gridCol.setAttribute('data-feed-focus-placeholder', '')
  if (!gridCol.style.getPropertyValue('--st-feed-focus-placeholder-height')) {
    gridCol.style.setProperty('--st-feed-focus-placeholder-height', `${Math.ceil(gridCol.getBoundingClientRect().height)}px`)
  }
  appContent?.setAttribute?.('data-feed-focus-app-open', '')
  appContent?.setAttribute?.('data-swipe-ignore', '')
  appRoot?.setAttribute?.('data-feed-focus-root-open', '')
  moduleCard.setAttribute('data-feed-focus-open', '')
  moduleCard.style.setProperty('--st-feed-focus-width', getFeedFocusWidthStyle(state.focusWidth))
}

function clearFeedFocusMode(moduleSyncId) {
  const {moduleCard, gridCol, appContent, appRoot} = getFeedFocusElements(moduleSyncId)
  moduleCard?.removeAttribute('data-feed-focus-open')
  moduleCard?.style?.removeProperty('--st-feed-focus-width')
  appContent?.removeAttribute?.('data-feed-focus-app-open')
  appContent?.removeAttribute?.('data-swipe-ignore', '')
  appRoot?.removeAttribute?.('data-feed-focus-root-open')
  gridCol?.removeAttribute('data-feed-focus-placeholder')
  gridCol?.style?.removeProperty('--st-feed-focus-placeholder-height')
}

function formatArchivedFeedDate(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
}

function renderArchivedFeedItemsModal(collectionId, items = []) {
  if (!items.length) {
    return `
      <div data-feed-archived-items>
        <p class="st-module-empty-state">${escapeHtml(t('feeds.noArchivedFeedItems'))}</p>
        <div data-feed-archived-items-actions>
          <button type="button" class="st-btn" data-modal-close>${escapeHtml(t('common.close'))}</button>
        </div>
      </div>
    `
  }

  return `
    <div data-feed-archived-items data-feed-collection-id="${escapeHtml(String(collectionId))}">
      <div data-feed-archived-items-list>
        ${items.map((item) => {
          const title = item.title?.trim() || t('feeds.archivedItemFallback')
          const date = formatArchivedFeedDate(item.saved_at || item.published_at)
          return `
            <article data-feed-archived-item data-feed-archived-item-id="${escapeHtml(String(item.id ?? ''))}">
              <div data-feed-archived-item-main>
                <h3 data-feed-archived-item-title>${escapeHtml(title)}</h3>
                <p data-feed-archived-item-meta>
                  ${item.source_title ? `<span>${escapeHtml(item.source_title)}</span>` : ''}
                  ${date ? `${item.source_title ? '<span> · </span>' : ''}<span>${escapeHtml(date)}</span>` : ''}
                </p>
              </div>
              <div data-feed-archived-item-actions>
                ${item.url ? `
                  <a
                    href="${escapeHtml(item.url)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="st-btn"
                  >${escapeHtml(t('feedItem.open'))}</a>
                ` : ''}
                <button
                  type="button"
                  class="st-btn"
                  data-click="deleteArchivedFeedItem"
                  data-archived-feed-item-id="${escapeHtml(String(item.id ?? ''))}"
                  data-feed-collection-id="${escapeHtml(String(collectionId))}"
                  title="${escapeHtml(t('common.delete'))}"
                  aria-label="${escapeHtml(t('common.delete'))}"
                >${SPEEDTAB_SVG.x}</button>
              </div>
            </article>
          `
        }).join('')}
      </div>
      <div data-feed-archived-items-actions>
        <button type="button" class="st-btn" data-modal-close>${escapeHtml(t('common.close'))}</button>
      </div>
    </div>
  `
}

async function openArchivedFeedItemsModal(collectionId) {
  const items = await loadSavedFeedItemsByCollectionId(collectionId)
  openModal({
    title: t('feeds.archivedFeedItemsTitle'),
    content: renderArchivedFeedItemsModal(collectionId, items),
    panelClass: 'st-feed-archived-items-modal',
    panelStyle: '--st-modal-max-width: 52rem;',
  })
}

function getModuleRoot(moduleSyncId) {
  if (!moduleSyncId) return null
  return document.querySelector(`[data-module-card][data-sync-id="${CSS.escape(moduleSyncId)}"]`)
}

function getQuickModuleSettingValue(moduleRoot, key) {
  if (!(moduleRoot instanceof HTMLElement) || !key) return null
  const tabsRoot = moduleRoot.querySelector('[data-yai-tabs]')
  const gridCol = moduleRoot.closest('[data-grid-col]')

  if (key === 'module-tabs-quicklinks') return tabsRoot?.hasAttribute('data-bookmarks-quicklinks') === true
  if (key === 'module-tabs-force-favicon') return tabsRoot?.hasAttribute('data-bookmarks-force-favicon') === true
  if (key === 'module-tabs-show-add-tile') return tabsRoot?.hasAttribute('data-bookmarks-inline-add-tile') === true
  if (key === 'module-hide-header') return moduleRoot.hasAttribute('data-hide-header')
  if (key === 'module-column-span') {
    const raw = gridCol?.style?.getPropertyValue('--st-grid-col-span')?.trim()
      || gridCol?.getAttribute('style')?.match(/--st-grid-col-span:\s*([0-9]+)/)?.[1]
      || '12'
    const value = parseInt(raw, 10)
    return Number.isInteger(value) ? value : 12
  }
  return null
}

async function persistModuleQuickConfig(moduleSyncId, moduleType, patch) {
  if (!moduleSyncId || !moduleType || !patch) return null
  const effectiveConfig = await upsertUiConfig({
    entityType: 'module',
    entitySubtype: moduleType,
    entitySyncId: moduleSyncId,
    patch,
  })

  const moduleRoot = getModuleRoot(moduleSyncId)
  if (moduleRoot) {
    applyModuleUiConfig(moduleRoot, effectiveConfig)
    if (moduleType === 'tabs') {
      const mediaScope = getVisibleBookmarkMediaScope(moduleRoot.querySelector('[data-yai-tabs]') ?? moduleRoot)
      if (mediaScope) initBookmarkMedia(mediaScope)
    }
  }

  return effectiveConfig
}

function getCurrentModuleTabContext(moduleSyncId) {
  const moduleRoot = getModuleRoot(moduleSyncId)
  const activeButton = moduleRoot?.querySelector('[data-yai-tabs] > [data-controller] [data-open].active')
  const tabId = parseInt(activeButton?.dataset?.tabId ?? '', 10)
  const tabSyncId = activeButton?.dataset?.tabSyncId ?? ''
  const title = activeButton?.textContent?.trim() ?? ''

  if (!tabId || !tabSyncId) return null
  return {tabId, tabSyncId, title}
}

function getFeedCollectionContext(target) {
  const collectionRoot = target?.closest?.('[data-feed-collection-id]') || document.querySelector('[data-feed-collection-id]')
  const collectionId = parseInt(collectionRoot?.dataset?.feedCollectionId ?? '', 10)
  const moduleSyncId = collectionRoot?.dataset?.feedModuleSyncId ?? target?.dataset?.feedModuleSyncId ?? ''
  const collectionTitle = collectionRoot?.dataset?.feedCollectionTitle ?? ''
  if (!collectionId || !moduleSyncId) return null
  return {collectionId, moduleSyncId, collectionRoot, collectionTitle}
}

async function refreshFeedSourceRecord(source) {
  if (!source?.id) return 0
  const insertedItemIds = []
  try {
    const xml = await feedApi.fetchFeed(source.feed_url)
    const parsedItems = feedApi.parseFeed(xml, source.id)
    await db.transaction('rw', db.feed_items, db.feed_sources, async () => {
      for (const item of parsedItems) {
        const existing = item.external_id
          ? await db.feed_items.where('[feed_source_id+external_id]').equals([source.id, item.external_id]).first()
          : await db.feed_items
            .where('feed_source_id')
            .equals(source.id)
            .filter((row) => row.title === item.title && row.url === item.url)
            .first()
        if (!existing) {
          insertedItemIds.push(await db.feed_items.add(item))
        }
      }
      await saveFeedSourceData(source.id, {
        last_fetched_at: Date.now(),
        last_error_at: null,
        last_error_message: null,
      })
    })
  } catch (error) {
    await saveFeedSourceData(source.id, {
      last_error_at: Date.now(),
      last_error_message: error instanceof Error ? error.message : t('feeds.refreshFailed'),
    })
  }
  return insertedItemIds
}

/**
 * Surgically patch a live feed collection DOM node without destroying it.
 * Only the zones that can change are updated:
 *   - collection-root data attributes (refreshing, items-loaded, focus)
 *   - toolbar HTML
 *   - refresh-hint div (toggle)
 *   - sidebar source-button aria states + sidebar footer
 *   - item list (diff by item ID — new items prepended, gone items removed,
 *     attribute-level state updated on surviving nodes)
 *
 * Existing <img> nodes are never destroyed, so browsers do not re-request
 * favicons or feed-content images.
 */
function patchFeedCollectionView(collectionRoot, collectionData, moduleSyncId, moduleConfig) {
  const collectionId = parseInt(collectionRoot.dataset.feedCollectionId ?? '', 10)
  if (!collectionId) return

  const vm = computeFeedCollectionViewModel(collectionData, moduleSyncId, moduleConfig)
  const {state, sources, visibleItems, sourceById, savedFeedItems, itemsLoaded, feedItemCount} = vm

  const syncToolbar = () => {
    const toolbar = collectionRoot.querySelector('.st-module-feed-toolbar')
    if (!(toolbar instanceof HTMLElement)) return

    const titleButton = toolbar.querySelector('[data-click="toggleLoadedItemsVisibility"]')
    if (titleButton instanceof HTMLButtonElement) {
      titleButton.textContent = vm.title
      titleButton.setAttribute('title', state.showLoadedItems ? t('feeds.hideLoadedItems') : t('feeds.showLoadedItems'))
    }

    const unreadButton = toolbar.querySelector('[data-click="toggleUnreadFilter"]')
    if (unreadButton instanceof HTMLButtonElement) {
      unreadButton.textContent = t('feeds.unreadLabel', {count: vm.unreadCount})
      unreadButton.setAttribute(
        'title',
        vm.hasUnreadItems
          ? (state.unreadOnly ? t('feeds.showAllItems') : t('feeds.showUnreadItems'))
          : t('feeds.noUnreadItems'),
      )
      unreadButton.disabled = !vm.hasUnreadItems
    }

    const refreshButton = toolbar.querySelector('[data-click="refreshAllFeeds"]')
    if (refreshButton instanceof HTMLButtonElement) {
      refreshButton.disabled = !sources.length
    }

    const actions = toolbar.querySelector('.st-module-feed-actions')
    if (actions instanceof HTMLElement) {
      const existingControls = actions.querySelector('.st-module-feed-focus-controls')
      const wrapper = document.createElement('div')
      wrapper.innerHTML = renderFeedFocusControls(moduleSyncId, collectionId, state).trim()
      const nextControls = wrapper.firstElementChild
      if (nextControls instanceof HTMLElement) {
        if (existingControls instanceof HTMLElement) {
          existingControls.replaceWith(nextControls)
        } else {
          actions.prepend(nextControls)
        }
      }
    }
  }

  const syncSidebarFooter = () => {
    const sidebarFooter = collectionRoot.querySelector('.st-module-feed-sidebar-footer')
    if (!(sidebarFooter instanceof HTMLElement)) return

    const latestButton = sidebarFooter.querySelector('[data-click="toggleLatestFeedItems"]')
    if (latestButton instanceof HTMLButtonElement) {
      latestButton.setAttribute('aria-pressed', state.latestOnly ? 'true' : 'false')
      latestButton.setAttribute('title', state.latestOnly ? t('feeds.showAllItems') : t('feeds.showNewItems'))
    }
  }

  // ── 1. Root attributes ───────────────────────────────────────────────────
  collectionRoot.dataset.feedItemsLoaded = itemsLoaded ? 'true' : 'false'
  collectionRoot.dataset.feedRefreshing = state.refreshing ? 'true' : 'false'
  collectionRoot.dataset.feedItemCount = String(feedItemCount)
  if (state.focusOpen) {
    collectionRoot.setAttribute('data-feed-focus-open', '')
    collectionRoot.setAttribute('data-focus-width', state.focusWidth)
  } else {
    collectionRoot.removeAttribute('data-feed-focus-open')
    collectionRoot.removeAttribute('data-focus-width')
  }

  // ── 2. Toolbar ───────────────────────────────────────────────────────────
  syncToolbar()

  // ── 3. Refresh hint ──────────────────────────────────────────────────────
  const main = collectionRoot.querySelector('.st-module-feed-main')
  if (main instanceof HTMLElement) {
    const existingHint = main.querySelector('.st-module-feed-refresh-hint')
    if (state.refreshing && !existingHint) {
      const newToolbar = main.querySelector('.st-module-feed-toolbar')
      newToolbar?.insertAdjacentHTML('afterend', `<div class="st-module-feed-refresh-hint">${t('feeds.refreshingFeedItems')}</div>`)
    } else if (!state.refreshing && existingHint) {
      existingHint.remove()
    }
  }

  // ── 4. Sidebar source buttons (aria state only, no DOM replacement) ───────
  const sourcesNav = collectionRoot.querySelector('.st-module-feed-sources')
  if (sourcesNav instanceof HTMLElement) {
    sources.forEach((source) => {
      const sourceId = source.id
      const row = sourcesNav.querySelector(`[data-feed-source-id="${CSS.escape(String(sourceId ?? ''))}"]`)
      if (!(row instanceof HTMLElement)) return
      const isActive = state.activeSourceId === sourceId
      const isLoading = state.loadingSourceId === sourceId
      const btn = row.querySelector('.st-module-feed-source-button')
      if (btn instanceof HTMLElement) {
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false')
        btn.setAttribute('aria-busy', isLoading ? 'true' : 'false')
      }
      row.classList.toggle('is-loading', isLoading)
    })
  }

  // ── 5. Sidebar footer (Latest toggle) ────────────────────────────────────
  syncSidebarFooter()

  // ── 6. Item list ──────────────────────────────────────────────────────────
  // Detect whether the content zone type changed (e.g., lazy-load → item list,
  // or filter turned list into empty state). If so, replace the content zone
  // wholesale — it has no existing loaded images to preserve.
  const existingListEl = collectionRoot.querySelector('.st-module-feed-list')
  const existingPendingEl = collectionRoot.querySelector('[data-feed-items-pending]')

  const wantsItemList = !vm.shouldLazyLoadItems && !vm.showLoadedItemsButton && visibleItems.length > 0
  const wantsLazy = vm.shouldLazyLoadItems
  const wantsShowButton = vm.showLoadedItemsButton
  const wantsEmpty = !wantsItemList && !wantsLazy && !wantsShowButton

  // If the type of content zone has to change, replace the whole zone
  if (
    (wantsItemList && !existingListEl) ||
    (wantsLazy && !existingPendingEl) ||
    ((wantsEmpty || wantsShowButton) && (existingListEl || existingPendingEl))
  ) {
    // Replace the content zone (toolbar was already updated above; hint handled above)
    // Find the insertion anchor: last child of .st-module-feed-main that is not toolbar/hint
    const contentZoneHtml = renderFeedContentZone(moduleSyncId, collectionId, vm).trim()
    if (main instanceof HTMLElement) {
      const oldZone = main.querySelector(
        '.st-module-feed-list, [data-feed-items-pending], .st-module-feed-empty'
      )
      if (oldZone) {
        const wrapper = document.createElement('div')
        wrapper.innerHTML = contentZoneHtml
        const newZone = wrapper.firstElementChild
        if (newZone) {
          oldZone.replaceWith(newZone)
          initFeedFavicons(newZone)
        }
      } else {
        main.insertAdjacentHTML('beforeend', contentZoneHtml)
        const newZone = main.lastElementChild
        if (newZone instanceof HTMLElement) initFeedFavicons(newZone)
      }
    }
    return
  }

  if (!wantsItemList || !existingListEl) return

  // ── Item list is present on both sides: surgical diff ────────────────────
  const innerList = existingListEl.querySelector('.st-module-feed-list-inner')
  if (!(innerList instanceof HTMLElement)) return

  const isSavedFeedItem = (item) => savedFeedItems.some((row) => {
    if (row.meta_json) {
      try {
        const parsed = JSON.parse(row.meta_json)
        if (parsed?.external_id && parsed.external_id === item.external_id) return true
      } catch {}
    }
    return row.title === item.title && row.url === item.url
  })

  const syncFeedArticleState = (article, item, isArchived) => {
    if (!(article instanceof HTMLElement)) return
    article.dataset.feedArchived = isArchived ? 'true' : 'false'
    article.dataset.newlyFetched = state.latestItemIds.includes(item.id) ? 'true' : 'false'
    article.dataset.read = item.read_at != null ? 'true' : 'false'

    article.querySelectorAll('.st-module-feed-item-save, .st-module-feed-item-action[data-click="archiveFeedItem"]').forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return
      const label = isArchived ? t('feedItem.archived') : t('feedItem.save')
      button.disabled = isArchived
      button.textContent = label
      button.setAttribute('title', isArchived ? t('feedItem.archived') : t('feedItem.archiveThisItem'))
      button.setAttribute('aria-label', isArchived ? t('feedItem.archived') : t('feedItem.archiveThisItem'))
    })
  }

  // Build a map of item ID → existing article element
  const existingArticleById = new Map()
  innerList.querySelectorAll('.st-module-feed-item[data-feed-item-id]').forEach((el) => {
    const id = parseInt(el.dataset.feedItemId ?? '', 10)
    if (id) existingArticleById.set(id, el)
  })

  const visibleIds = new Set(visibleItems.map((item) => item.id).filter(Boolean))

  // Remove articles that are no longer visible
  existingArticleById.forEach((el, id) => {
    if (!visibleIds.has(id)) el.remove()
  })

  let needsReorder = false
  const orderedArticles = []
  const newArticles = []
  visibleItems.forEach((item) => {
    if (!item.id) return
    let article = existingArticleById.get(item.id)
    const isArchived = isSavedFeedItem(item)

    if (!(article instanceof HTMLElement)) {
      const source = sourceById.get(item.feed_source_id)
      const wrapper = document.createElement('div')
      wrapper.innerHTML = renderFeedItem(item, source, moduleSyncId, collectionId, state, isArchived).trim()
      article = wrapper.firstElementChild
      if (!(article instanceof HTMLElement)) return
      newArticles.push(article)
    }

    syncFeedArticleState(article, item, isArchived)
    orderedArticles.push(article)
  })

  orderedArticles.forEach((article, index) => {
    if (innerList.children[index] !== article) needsReorder = true
  })

  if (innerList.childElementCount !== orderedArticles.length) needsReorder = true

  if (needsReorder) {
    const fragment = document.createDocumentFragment()
    orderedArticles.forEach((article) => fragment.appendChild(article))
    innerList.replaceChildren(fragment)
  }

  newArticles.forEach((article) => initFeedFavicons(article))
}

async function refreshFeedCollectionView(moduleSyncId, collectionId, options = {}) {
  if (!moduleSyncId || !collectionId) return
  const {anchorItemId = null} = options

  const collectionRoot = document.querySelector(
    `[data-feed-collection-id="${CSS.escape(String(collectionId))}"][data-feed-module-sync-id="${CSS.escape(moduleSyncId)}"]`
  )
  if (!(collectionRoot instanceof HTMLElement)) return

  const outerScrollHost = collectionRoot.querySelector('.st-module-feed-list')
  const innerScrollHost = collectionRoot.querySelector('.st-module-feed-list-inner')
  const outerScrollTop = outerScrollHost instanceof HTMLElement ? outerScrollHost.scrollTop : 0
  const innerScrollTop = innerScrollHost instanceof HTMLElement ? innerScrollHost.scrollTop : 0
  const anchorSelector = anchorItemId != null
    ? `[data-feed-item-id="${CSS.escape(String(anchorItemId))}"]`
    : ''
  const activeAnchorHost = innerScrollHost instanceof HTMLElement ? innerScrollHost : outerScrollHost
  const previousAnchorRectTop = anchorSelector && activeAnchorHost instanceof HTMLElement
    ? activeAnchorHost.querySelector(anchorSelector)?.getBoundingClientRect?.().top ?? null
    : null

  const [module, tab, feedSources, savedFeedItems] = await Promise.all([
    loadModuleBySyncId(moduleSyncId),
    loadModuleTabById(collectionId),
    loadFeedSourcesByCollectionId(collectionId),
    loadSavedFeedItemsByCollectionId(collectionId),
  ])
  if (!module || !tab) return

  const sourceIds = feedSources.map((source) => source.id).filter((id) => typeof id === 'number')
  const feedItems = await loadFeedItemsBySourceIds(sourceIds)
  const moduleConfig = module.config_json ? (() => {
    try {
      const parsed = JSON.parse(module.config_json)
      return {
        feedItemLimit: typeof parsed.feed_item_limit === 'number' ? parsed.feed_item_limit : 0,
      }
    } catch {
      return {feedItemLimit: 0}
    }
  })() : {feedItemLimit: 0}

  const collectionData = {
    ...tab,
    feedSources,
    feedItems,
    feedItemsLoaded: true,
    feedItemCount: feedItems.length,
    savedFeedItems,
  }

  // Use surgical patching when the collection root already exists in the DOM.
  // Fall back to a full replace for first renders or edge cases where the root
  // is somehow missing the expected structure.
  const hasItemListStructure = !!(collectionRoot.querySelector('.st-module-feed-main') && collectionRoot.querySelector('.st-module-feed-toolbar'))
  if (hasItemListStructure) {
    patchFeedCollectionView(collectionRoot, collectionData, moduleSyncId, moduleConfig)
  } else {
    // Full replace fallback (first render / structural mismatch)
    const wrapper = document.createElement('div')
    wrapper.innerHTML = renderFeedCollection(collectionData, moduleSyncId, moduleConfig).trim()
    const nextRoot = wrapper.firstElementChild
    if (!(nextRoot instanceof HTMLElement)) return
    collectionRoot.replaceWith(nextRoot)
    initFeedFavicons(nextRoot)

    const nextOuterScrollHost = nextRoot.querySelector('.st-module-feed-list')
    const nextInnerScrollHost = nextRoot.querySelector('.st-module-feed-list-inner')
    if (nextOuterScrollHost instanceof HTMLElement) nextOuterScrollHost.scrollTop = outerScrollTop
    if (nextInnerScrollHost instanceof HTMLElement) nextInnerScrollHost.scrollTop = innerScrollTop
    if (anchorSelector) {
      const nextActiveAnchorHost = nextInnerScrollHost instanceof HTMLElement ? nextInnerScrollHost : nextOuterScrollHost
      const nextAnchorRectTop = nextActiveAnchorHost instanceof HTMLElement
        ? nextActiveAnchorHost.querySelector(anchorSelector)?.getBoundingClientRect?.().top ?? null
        : null
      if (previousAnchorRectTop != null && nextAnchorRectTop != null && nextActiveAnchorHost instanceof HTMLElement) {
        nextActiveAnchorHost.scrollTop += nextAnchorRectTop - previousAnchorRectTop
      }
    }
    const state = getFeedUiState(moduleSyncId, collectionId)
    if (state.focusOpen) {
      applyFeedFocusMode(moduleSyncId, collectionId)
    } else {
      clearFeedFocusMode(moduleSyncId)
    }
    return
  }

  // Restore scroll position for the surgical patch path
  const nextOuterScrollHost = collectionRoot.querySelector('.st-module-feed-list')
  const nextInnerScrollHost = collectionRoot.querySelector('.st-module-feed-list-inner')
  if (nextOuterScrollHost instanceof HTMLElement) nextOuterScrollHost.scrollTop = outerScrollTop
  if (nextInnerScrollHost instanceof HTMLElement) nextInnerScrollHost.scrollTop = innerScrollTop
  if (anchorSelector) {
    const nextActiveAnchorHost = nextInnerScrollHost instanceof HTMLElement ? nextInnerScrollHost : nextOuterScrollHost
    const nextAnchorRectTop = nextActiveAnchorHost instanceof HTMLElement
      ? nextActiveAnchorHost.querySelector(anchorSelector)?.getBoundingClientRect?.().top ?? null
      : null
    if (previousAnchorRectTop != null && nextAnchorRectTop != null && nextActiveAnchorHost instanceof HTMLElement) {
      nextActiveAnchorHost.scrollTop += nextAnchorRectTop - previousAnchorRectTop
    }
  }

  const state = getFeedUiState(moduleSyncId, collectionId)
  if (state.focusOpen) {
    applyFeedFocusMode(moduleSyncId, collectionId)
  } else {
    clearFeedFocusMode(moduleSyncId)
  }
}

function updateFeedItemDom(article, item, context) {
  if (!(article instanceof HTMLElement) || !item) return

  const nextState = toggleFeedItemExpansionState(context.moduleSyncId, context.collectionId, item.id)
  const expanded = nextState.expandedItemIds.includes(item.id)
  const sourceTitle = article.dataset.feedSourceTitle || t('feeds.filterAll')
  const isArchived = article.dataset.feedArchived === 'true'
  const header = article.querySelector('.st-module-feed-item-header')
  const existingBody = article.querySelector('.st-module-feed-item-body')
  const toggleButton = article.querySelector('.st-module-feed-item-toggle')
  const saveButtons = article.querySelectorAll('.st-module-feed-item-save, .st-module-feed-item-action[data-click="archiveFeedItem"]')

  article.setAttribute('data-expanded', expanded ? 'true' : 'false')
  article.setAttribute('data-read', 'true')
  toggleButton?.setAttribute('aria-expanded', expanded ? 'true' : 'false')

  if (saveButtons.length) {
    saveButtons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return
      button.disabled = isArchived
      const label = isArchived ? t('feedItem.archived') : t('feedItem.save')
      button.textContent = label
      button.setAttribute('title', isArchived ? t('feedItem.archived') : t('feedItem.archiveThisItem'))
      button.setAttribute('aria-label', isArchived ? t('feedItem.archived') : t('feedItem.archiveThisItem'))
    })
  }

  if (!expanded) {
    existingBody?.remove()
    return
  }

  const bodyHtml = renderFeedItemBody(
    item.read_at == null ? {...item, read_at: Date.now()} : item,
    sourceTitle,
    context.moduleSyncId,
    context.collectionId,
    isArchived,
  ).trim()

  if (existingBody) {
    existingBody.outerHTML = bodyHtml
    return
  }

  header?.insertAdjacentHTML('afterend', bodyHtml)
}

export async function ensureFeedCollectionLoaded(moduleSyncId, collectionId) {
  if (!moduleSyncId || !collectionId) return

  const collectionRoot = document.querySelector(
    `[data-feed-collection-id="${CSS.escape(String(collectionId))}"][data-feed-module-sync-id="${CSS.escape(moduleSyncId)}"]`
  )
  if (!(collectionRoot instanceof HTMLElement)) return
  if (collectionRoot.dataset.feedItemsLoaded === 'true') return
  if (collectionRoot.hasAttribute('data-feed-items-loading')) return

  collectionRoot.setAttribute('data-feed-items-loading', '')
  try {
    await refreshFeedCollectionView(moduleSyncId, collectionId)
  } finally {
    collectionRoot.removeAttribute('data-feed-items-loading')
  }
}

async function openCrudPanel({entityType, record = null, moduleSyncId = '', parentId = '', parentSyncId = '', parentTitle = ''}) {
  const panelModuleType = entityType === 'feed-source' ? 'feeds' : 'tabs'
  const panelEl = openSidepanel({
    title: getCrudPanelTitle(entityType, record),
    syncId: moduleSyncId,
    moduleType: panelModuleType,
      footer: record?.id ? renderSidepanelDeleteFooter({
        action: 'moduleCrudDelete',
        label: t(
          entityType === 'tab'
             ? 'moduleCrud.deleteTab'
            : entityType === 'bookmark'
               ? 'moduleCrud.deleteBookmark'
            : 'common.delete'
        ),
      attrs: {
        'data-record-id': record.id,
        'data-entity-type': entityType,
      },
    }) : '',
  })
  onSidepanelClose(() => {
    resetBookmarkFormState()
    resetFeedFormState()
  })
  const body = panelEl.querySelector('[data-sidepanel-body]')
  if (body) {
    if (entityType === 'bookmark') {
      const state = await initBookmarkFormState({record, moduleSyncId, parentId, parentSyncId, parentTitle})
      body.innerHTML = renderBookmarkCrudForm(state)
      await afterBookmarkFormRender(body)
      initFormDirtyState(body)
      return
    }

    if (entityType === 'feed-source') {
      const state = initFeedFormState({record, moduleSyncId, parentId, parentSyncId, parentTitle})
      body.innerHTML = renderFeedSourceCrudForm(state)
      initFormDirtyState(body)
      return
    }

    resetBookmarkFormState()
    body.innerHTML = renderModuleCrudForm({
      entityType,
      record,
      moduleSyncId,
      parentId,
      parentSyncId,
      parentTitle,
    })
    initFormDirtyState(body)
    if (entityType === 'tab') {
      requestAnimationFrame(() => {
        const input = body.querySelector('[name="title"]')
        input?.focus?.()
        input?.select?.()
      })
    }
  }
}

async function openNoteModal({record = null, moduleSyncId = '', parentId = '', parentSyncId = '', parentTitle = ''} = {}) {
  const state = initNoteFormState({record, moduleSyncId, parentId, parentSyncId, parentTitle})
  openModal({
    title: getCrudPanelTitle('note', record),
    content: renderNoteCrudForm(state),
  })

  const body = getOpenModalBody()
  if (!body) return
  afterNoteFormRender(body)
  initFormDirtyState(body)
}

async function rerenderAndReopen(entityType, recordSyncId = '', moduleSyncId = '') {
  const bootstrap = await import('../app/bootstrap.js')
  await bootstrap.renderNextRoot()
  if (!recordSyncId) {
    closeSidepanel()
    return
  }

  if (entityType === 'tab') {
    const record = await loadModuleTabBySyncId(recordSyncId)
    if (!record) return
    const parentModule = await loadModuleBySyncId(moduleSyncId)
    await openCrudPanel({
      entityType,
      record,
      moduleSyncId,
      parentId: record.module_id,
      parentTitle: parentModule?.title ?? '',
    })
    return
  }

  if (entityType === 'bookmark') {
    const record = await loadBookmarkBySyncId(recordSyncId)
    if (!record) return
    const parentTab = await loadModuleTabById(record.collection_id)
    await openCrudPanel({
      entityType,
      record,
      moduleSyncId,
      parentId: record.collection_id,
      parentSyncId: parentTab?.sync_id ?? '',
      parentTitle: parentTab?.title ?? '',
    })
    return
  }

  if (entityType === 'feed-source') {
    const record = await loadFeedSourceBySyncId(recordSyncId)
    if (!record) return
    const parentTab = await loadModuleTabById(record.collection_id)
    await openCrudPanel({
      entityType,
      record,
      moduleSyncId,
      parentId: record.collection_id,
      parentSyncId: parentTab?.sync_id ?? '',
      parentTitle: parentTab?.title ?? '',
    })
  }
}

function normalizeTabPayload(form) {
  return {
    title: form.querySelector('[name="title"]')?.value?.trim(),
  }
}

function getFormContext(target) {
  const form = target?.matches?.('[data-module-crud-form]')
    ? target
    : target?.closest?.('[data-module-crud-form]')
      || document.querySelector('[data-sidepanel][data-sidepanel-open] [data-module-crud-form]')
  if (!form) return null
  return {
    form,
    entityType: target?.dataset?.entityType || form.dataset.entityType,
    recordId: parseInt(target?.dataset?.recordId ?? form.dataset.recordId ?? '', 10),
    recordSyncId: form.dataset.recordSyncId ?? '',
    moduleSyncId: form.dataset.moduleSyncId ?? '',
    parentId: parseInt(form.dataset.parentId ?? '', 10),
    parentSyncId: form.dataset.parentSyncId ?? '',
  }
}

export const moduleCrudActions = {
  async toggleQuickModuleSetting(target) {
    const moduleSyncId = target.dataset.syncId || ''
    const moduleType = target.dataset.moduleType || ''
    const key = target.dataset.quickSettingKey || ''
    const moduleRoot = getModuleRoot(moduleSyncId)
    if (!moduleSyncId || !moduleType || !key || !(moduleRoot instanceof HTMLElement)) return

    const currentValue = getQuickModuleSettingValue(moduleRoot, key)
    await persistModuleQuickConfig(moduleSyncId, moduleType, {
      behavior: {
        [key]: currentValue !== true,
      },
    })
  },

  async setQuickModuleColumnSpan(target) {
    const moduleSyncId = target.dataset.syncId || ''
    const moduleType = target.dataset.moduleType || ''
    const columnSpan = parseInt(target.dataset.columnSpan ?? target.dataset.quickSettingValue ?? '', 10)
    if (!moduleSyncId || !moduleType || !Number.isInteger(columnSpan)) return

    await persistModuleQuickConfig(moduleSyncId, moduleType, {
      layout: {
        'module-column-span': Math.max(1, Math.min(12, columnSpan)),
      },
    })
  },

  async addModuleTab(target) {
    const moduleSyncId = target.dataset.syncId
    const moduleId = parseInt(target.dataset.moduleId ?? '', 10)
    if (!moduleSyncId || !moduleId) return
    const module = await loadModuleBySyncId(moduleSyncId)
    await openCrudPanel({
      entityType: 'tab',
      moduleSyncId,
      parentId: moduleId,
      parentTitle: module?.title ?? '',
    })
  },

  async editCurrentModuleTab(target) {
    const moduleSyncId = target.dataset.syncId
    const currentTab = getCurrentModuleTabContext(moduleSyncId)
    if (!moduleSyncId || !currentTab?.tabSyncId) return
    const record = await loadModuleTabBySyncId(currentTab.tabSyncId)
    if (!record) return
    await openCrudPanel({
      entityType: 'tab',
      record,
      moduleSyncId,
      parentId: record.module_id,
      parentSyncId: record.sync_id,
      parentTitle: currentTab.title,
    })
  },

  async deleteCurrentModuleTab(target) {
    const moduleSyncId = target.dataset.syncId
    const currentTab = getCurrentModuleTabContext(moduleSyncId)
    if (!currentTab) return
    if (!confirm(t('moduleCrud.confirmDeleteTab', {title: currentTab.title || t('nav.page')}))) return
    await softDeleteModuleTab(currentTab.tabId)
    const {renderNextRoot} = await import('../app/bootstrap.js')
    await renderNextRoot()
  },

  async addModuleBookmark(target) {
    const moduleSyncId = target.dataset.syncId
    if (!moduleSyncId) return
    const currentTab = getCurrentModuleTabContext(moduleSyncId)
    if (!currentTab) {
      await moduleCrudActions.addModuleTab(target)
      return
    }
    await openCrudPanel({
      entityType: 'bookmark',
      moduleSyncId,
      parentId: currentTab.tabId,
      parentSyncId: currentTab.tabSyncId,
      parentTitle: currentTab.title,
    })
  },

  async addModuleFeed(target) {
    const moduleSyncId = target.dataset.syncId
    if (!moduleSyncId) return
    const currentTab = getCurrentModuleTabContext(moduleSyncId)
    if (!currentTab) {
      await moduleCrudActions.addModuleTab(target)
      return
    }
    await openCrudPanel({
      entityType: 'feed-source',
      moduleSyncId,
      parentId: currentTab.tabId,
      parentSyncId: currentTab.tabSyncId,
      parentTitle: currentTab.title,
    })
  },

  async openAddFeedSource(target) {
    const context = getFeedCollectionContext(target)
    if (!context) return
    await openCrudPanel({
      entityType: 'feed-source',
      moduleSyncId: context.moduleSyncId,
      parentId: context.collectionId,
      parentTitle: context.collectionTitle || t('app.title'),
    })
  },

  async editModuleBookmark(target) {
    const bookmarkSyncId = target.dataset.bookmarkSyncId
    const moduleSyncId = target.dataset.moduleSyncId
    if (!bookmarkSyncId || !moduleSyncId) return
    const record = await loadBookmarkBySyncId(bookmarkSyncId)
    if (!record) return
    const parentTab = await loadModuleTabById(record.collection_id)
    await openCrudPanel({
      entityType: 'bookmark',
      record,
      moduleSyncId,
      parentId: record.collection_id,
      parentSyncId: parentTab?.sync_id ?? '',
      parentTitle: parentTab?.title ?? '',
    })
  },

  async editFeedSource(target) {
    const feedSourceId = parseInt(target.dataset.feedSourceId ?? '', 10)
    const moduleSyncId = target.dataset.feedModuleSyncId || ''
    if (!feedSourceId || !moduleSyncId) return
    const record = await loadFeedSourceById(feedSourceId)
    if (!record) return
    const parentTab = await loadModuleTabById(record.collection_id)
    await openCrudPanel({
      entityType: 'feed-source',
      record,
      moduleSyncId,
      parentId: record.collection_id,
      parentSyncId: parentTab?.sync_id ?? '',
      parentTitle: parentTab?.title ?? '',
    })
  },

  async toggleFeedSource(target) {
    const context = getFeedCollectionContext(target)
    const sourceId = parseInt(target.dataset.feedSourceId ?? '', 10)
    if (!context || !sourceId) return
    toggleFeedSourceState(context.moduleSyncId, context.collectionId, sourceId)
    await refreshFeedCollectionView(context.moduleSyncId, context.collectionId)
  },

  async toggleUnreadFilter(target) {
    const context = getFeedCollectionContext(target)
    if (!context) return
    toggleFeedUnreadState(context.moduleSyncId, context.collectionId)
    await refreshFeedCollectionView(context.moduleSyncId, context.collectionId)
  },

  async toggleLoadedItemsVisibility(target) {
    const context = getFeedCollectionContext(target)
    if (!context) return
    toggleFeedLoadedState(context.moduleSyncId, context.collectionId)
    await refreshFeedCollectionView(context.moduleSyncId, context.collectionId)
  },

  async toggleLatestFeedItems(target) {
    const context = getFeedCollectionContext(target)
    if (!context) return
    toggleFeedLatestState(context.moduleSyncId, context.collectionId)
    await refreshFeedCollectionView(context.moduleSyncId, context.collectionId)
  },

  async changeFeedFocusWidth(target) {
    const moduleSyncId = target.dataset.feedModuleSyncId || ''
    const collectionId = parseInt(target.dataset.feedCollectionId ?? '', 10)
    const value = String(target.value || '').toLowerCase()
    if (!moduleSyncId || !collectionId) return

    if (value === 'expand') {
      closeFeedFocusState(moduleSyncId, collectionId)
      await refreshFeedCollectionView(moduleSyncId, collectionId)
      return
    }

    primeFeedFocusPlaceholder(moduleSyncId)
    setFeedFocusWidth(moduleSyncId, collectionId, value)
    openFeedFocusState(moduleSyncId, collectionId, value)
    await refreshFeedCollectionView(moduleSyncId, collectionId)
  },

  async openFeedFocusQuick(target) {
    const moduleSyncId = target.dataset.feedModuleSyncId || ''
    const collectionId = parseInt(target.dataset.feedCollectionId ?? '', 10)
    if (!moduleSyncId || !collectionId) return
    const state = getFeedUiState(moduleSyncId, collectionId)
    if (!state.focusWidth) return
    primeFeedFocusPlaceholder(moduleSyncId)
    openFeedFocusState(moduleSyncId, collectionId, state.focusWidth)
    await refreshFeedCollectionView(moduleSyncId, collectionId)
  },

  async closeFeedFocusMode(target) {
    const moduleSyncId = target.dataset.feedModuleSyncId || ''
    const collectionId = parseInt(target.dataset.feedCollectionId ?? '', 10)
    if (!moduleSyncId || !collectionId) return
    closeFeedFocusState(moduleSyncId, collectionId)
    await refreshFeedCollectionView(moduleSyncId, collectionId)
  },

  async toggleFeedItem(target) {
    const context = getFeedCollectionContext(target)
    const itemId = parseInt(target.dataset.feedItemId ?? '', 10)
    if (!context || !itemId) return
    const item = await loadFeedItemById(itemId)
    if (!item) return
    const article = target.closest('.st-module-feed-item[data-feed-item-id]')
    updateFeedItemDom(article, item, context)
    if (item.read_at == null) {
      await db.feed_items.update(itemId, {read_at: Date.now()})
    }
  },

  async markAllAsRead(target) {
    const context = getFeedCollectionContext(target)
    if (!context) return
    const state = getFeedUiState(context.moduleSyncId, context.collectionId)
    const sourceIds = (await loadFeedSourcesByCollectionId(context.collectionId))
      .map((source) => source.id)
      .filter((id) => typeof id === 'number')
    if (!sourceIds.length) return
    const unreadItems = await loadFeedItemsBySourceIds(sourceIds)
    const visibleItems = unreadItems.filter((item) => {
      if (state.activeSourceId != null && item.feed_source_id !== state.activeSourceId) return false
      if (state.unreadOnly && item.read_at != null) return false
      return true
    })
    const now = Date.now()
    await db.transaction('rw', db.feed_items, async () => {
      for (const item of visibleItems) {
        if (item.id && item.read_at == null) {
          await db.feed_items.update(item.id, {read_at: now})
        }
      }
    })
    await refreshFeedCollectionView(context.moduleSyncId, context.collectionId)
  },

  async refreshAllFeeds(target) {
    const context = getFeedCollectionContext(target)
    if (!context) return
    const sources = await loadFeedSourcesByCollectionId(context.collectionId)
    setFeedRefreshingState(context.moduleSyncId, context.collectionId, true)
    await refreshFeedCollectionView(context.moduleSyncId, context.collectionId)
    try {
      for (const source of sources) {
        setFeedSourceLoadingState(context.moduleSyncId, context.collectionId, source.id)
        await refreshFeedCollectionView(context.moduleSyncId, context.collectionId)
        const insertedItemIds = await refreshFeedSourceRecord(source)
        if (insertedItemIds.length) {
          addFeedLatestItems(context.moduleSyncId, context.collectionId, insertedItemIds)
        }
        setFeedSourceLoadingState(context.moduleSyncId, context.collectionId, null)
        await refreshFeedCollectionView(context.moduleSyncId, context.collectionId)
      }
      setFeedSourceLoadingState(context.moduleSyncId, context.collectionId, null)
      const cutoff = Date.now() - (90 * 24 * 60 * 60 * 1000)
      await db.feed_items.where('fetched_at').below(cutoff).delete()
    } finally {
      setFeedSourceLoadingState(context.moduleSyncId, context.collectionId, null)
      setFeedRefreshingState(context.moduleSyncId, context.collectionId, false)
      await refreshFeedCollectionView(context.moduleSyncId, context.collectionId)
    }
  },

  async clearModuleFeedItems(target) {
    const moduleSyncId = target.dataset.syncId || target.dataset.moduleSyncId || ''
    if (!moduleSyncId) return

    const currentTab = getCurrentModuleTabContext(moduleSyncId)
    if (!currentTab?.tabId) return

    const scope = t('feeds.clearLoadedAll')
    if (!confirm(t('feeds.clearLoadedConfirm', {scope}))) return

    const sourceIds = (await loadFeedSourcesByCollectionId(currentTab.tabId))
      .map((source) => source.id)
      .filter((id) => typeof id === 'number')

    if (!sourceIds.length) return

    await clearFeedItemsBySourceIds(sourceIds)
    await refreshFeedCollectionView(moduleSyncId, currentTab.tabId)
  },

  async archiveFeedItem(target) {
    const context = getFeedCollectionContext(target)
    const itemId = parseInt(target.dataset.feedItemId ?? '', 10)
    if (!context || !itemId) return
    const item = await loadFeedItemById(itemId)
    if (!item) return
    const source = await loadFeedSourceById(item.feed_source_id)
    const existingSaved = await loadSavedFeedItemsByCollectionId(context.collectionId)
    const duplicate = existingSaved.find((row) => {
      if (row.meta_json) {
        try {
          const parsed = JSON.parse(row.meta_json)
          if (parsed?.external_id && parsed.external_id === item.external_id) return true
        } catch {}
      }
      return row.title === item.title && row.url === item.url
    })
    if (duplicate) return
    await createSavedFeedItemData(context.collectionId, {
      title: item.title,
      url: item.url,
      source_title: source?.title ?? null,
      author: item.author,
      published_at: item.published_at,
      summary: item.summary,
      content: item.content,
      comment: null,
      meta_json: item.external_id ? JSON.stringify({external_id: item.external_id}) : null,
    })
    await refreshFeedCollectionView(context.moduleSyncId, context.collectionId)
  },

  async openArchivedFeedItems(target) {
    const moduleSyncId = target.dataset.syncId || target.dataset.moduleSyncId || ''
    if (!moduleSyncId) return
    const currentTab = getCurrentModuleTabContext(moduleSyncId)
    if (!currentTab?.tabId) return
    await openArchivedFeedItemsModal(currentTab.tabId)
  },

  async deleteArchivedFeedItem(target) {
    const archivedItemId = parseInt(target.dataset.archivedFeedItemId ?? '', 10)
    const collectionId = parseInt(target.dataset.feedCollectionId ?? '', 10)
    if (!archivedItemId || !collectionId) return
    if (!confirm(t('feeds.deleteArchivedFeedItemConfirm'))) return
    await softDeleteSavedFeedItem(archivedItemId)
    await openArchivedFeedItemsModal(collectionId)
  },

  async addModuleNote(target) {
    const moduleSyncId = target.dataset.syncId || target.dataset.moduleSyncId
    if (!moduleSyncId) return
    const currentTab = getCurrentModuleTabContext(moduleSyncId)
    if (!currentTab) {
      await moduleCrudActions.addModuleTab(target)
      return
    }
    await openNoteModal({
      moduleSyncId,
      parentId: currentTab.tabId,
      parentSyncId: currentTab.tabSyncId,
      parentTitle: currentTab.title,
    })
  },

  openModuleNote(target) {
    openFloatingNote(target.dataset.noteId)
    target?.blur?.()
  },

  async deleteModuleBookmark(target) {
    const bookmarkId = parseInt(target.dataset.bookmarkId ?? '', 10)
    const label = target.dataset.bookmarkTitle || ''
    if (!bookmarkId) return
    if (!confirm(t('moduleCrud.confirmDeleteBookmark', {title: label || t('app.searchKinds.bookmark')}))) return
    await softDeleteBookmark(bookmarkId)
    const {renderNextRoot} = await import('../app/bootstrap.js')
    await renderNextRoot()
  },

  async deleteOpenNote(target) {
    const noteId = parseInt(target.dataset.noteId ?? '', 10)
    const label = target.dataset.noteTitle || ''
    const moduleSyncId = document.querySelector(`[data-note-id="${CSS.escape(String(noteId))}"][data-module-sync-id]`)?.getAttribute('data-module-sync-id') || ''
    if (!noteId) return
    if (!confirm(t('openNotes.deleteConfirm', {title: label || t('openNotes.noteTitle')}))) return
    await softDeleteNote(noteId)
    closeFloatingNote(noteId)
    if (moduleSyncId) {
      const {refreshModuleContent} = await import('../app/bootstrap.js')
      await refreshModuleContent(moduleSyncId)
      return
    }
    const {renderNextRoot} = await import('../app/bootstrap.js')
    await renderNextRoot()
  },

  async moduleCrudSave(target) {
    const context = getFormContext(target)
    if (!context) return
    if (typeof context.form.reportValidity === 'function' && !context.form.reportValidity()) return

    if (context.entityType === 'tab') {
      const payload = normalizeTabPayload(context.form)
      if (!payload.title) return

      const record = context.recordId
        ? await saveModuleTabData(context.recordId, {title: payload.title})
        : await createModuleTab(context.parentId, {title: payload.title})

      await rerenderAndReopen('tab', record?.sync_id ?? '', context.moduleSyncId)
      return
    }

    if (context.entityType === 'bookmark') {
      const payload = await buildBookmarkSavePayload(context.form)
      if (!payload?.title || !payload?.url) return

      const record = context.recordId
        ? await saveBookmarkData(context.recordId, {
          title: payload.title,
          url: payload.url,
          description: payload.description,
          favicon_asset_id: payload.favicon_asset_id,
          preview_asset_id: payload.preview_asset_id,
        })
        : await createBookmark(context.parentId, payload)

      await rerenderAndReopen('bookmark', record?.sync_id ?? '', context.moduleSyncId)
      return
    }

    if (context.entityType === 'note') {
      const payload = await buildNoteSavePayload(context.form)
      if (!payload?.title) {
        const body = getOpenModalBody()
        if (body) rerenderNoteForm(body)
        return
      }

      const record = await createNoteData(context.parentId, payload)
      closeModal()
      const {refreshModuleContent} = await import('../app/bootstrap.js')
      await refreshModuleContent(context.moduleSyncId)
      if (record?.id) {
        openFloatingNote(record.id, {
          initialWidth: 820,
          initialHeight: 360,
        })
        await startFloatingNoteEdit(record.id)
      }
      return
    }

    if (context.entityType === 'feed-source') {
      syncFeedFormStateFromForm(context.form)
      const title = context.form.querySelector('[name="title"]')?.value?.trim()
      const feedUrl = context.form.querySelector('[name="feed_url"]')?.value?.trim()
      const siteUrl = context.form.querySelector('[name="site_url"]')?.value?.trim() || null
      if (!title || !feedUrl || !canSaveFeedSourceForm()) {
        rerenderFeedForm(getOpenSidepanelBody())
        return
      }

      const payload = {
        title,
        feed_url: feedUrl,
        site_url: siteUrl,
      }

      const record = context.recordId
        ? await saveFeedSourceData(context.recordId, payload)
        : await createFeedSourceData(context.parentId, payload)

      await rerenderAndReopen('feed-source', record?.sync_id ?? '', context.moduleSyncId)
      return
    }
  },

  async moduleCrudDelete(target) {
    const context = getFormContext(target)
    if (!context || !context.recordId) return

    if (context.entityType === 'tab') {
      const label = context.form.querySelector('[name="title"]')?.value?.trim() || ''
      if (!confirm(t('moduleCrud.confirmDeleteTab', {title: label || t('moduleCrud.tab')}))) return
      await softDeleteModuleTab(context.recordId)
    } else if (context.entityType === 'bookmark') {
      const label = context.form.querySelector('[name="title"]')?.value?.trim() || ''
      if (!confirm(t('moduleCrud.confirmDeleteBookmark', {title: label || t('moduleCrud.bookmark')}))) return
      await softDeleteBookmark(context.recordId)
    } else if (context.entityType === 'feed-source') {
      const label = context.form.querySelector('[name="title"]')?.value?.trim() || ''
      if (!confirm(t('feedForm.deleteConfirm'))) return
      await softDeleteFeedSource(context.recordId)
    } else {
      return
    }

    // Let the original click cycle finish before removing the sidepanel,
    // otherwise the click can land on underlying bookmark actions.
    await new Promise((resolve) => setTimeout(resolve, 0))
    closeSidepanel()
    const {renderNextRoot} = await import('../app/bootstrap.js')
    await renderNextRoot()
  },

  async bookmarkFormTestUrl(target) {
    const form = target.closest('[data-module-crud-form]')
    if (target instanceof HTMLButtonElement) {
      target.classList.add('yai-loading')
      target.disabled = true
    }
    syncBookmarkFormStateFromForm(form)
    await testBookmarkUrl()
    await rerenderBookmarkForm(getOpenSidepanelBody())
  },

  async bookmarkFormToggleFaviconPicker(target) {
    syncBookmarkFormStateFromForm(target.closest('[data-module-crud-form]'))
    toggleBookmarkFaviconPicker()
    await rerenderBookmarkForm(getOpenSidepanelBody())
  },

  async bookmarkFormTriggerFaviconUpload(target) {
    target.closest('[data-bookmark-form-picker]')?.querySelector('[data-bookmark-favicon-file]')?.click()
  },

  async bookmarkFormFaviconFileChange(target) {
    const file = target.files?.[0]
    if (!file) return
    syncBookmarkFormStateFromForm(target.closest('[data-module-crud-form]'))
    await uploadBookmarkFavicon(file)
    target.value = ''
    await rerenderBookmarkForm(getOpenSidepanelBody())
  },

  async bookmarkFormSelectFaviconAsset(target) {
    syncBookmarkFormStateFromForm(target.closest('[data-module-crud-form]'))
    await selectBookmarkFaviconAsset(target.dataset.assetId)
    await rerenderBookmarkForm(getOpenSidepanelBody())
  },

  async bookmarkFormClearFavicon(target) {
    syncBookmarkFormStateFromForm(target.closest('[data-module-crud-form]'))
    await clearBookmarkFavicon()
    await rerenderBookmarkForm(getOpenSidepanelBody())
  },

  async bookmarkFormTogglePreviewPicker(target) {
    syncBookmarkFormStateFromForm(target.closest('[data-module-crud-form]'))
    toggleBookmarkPreviewPicker()
    await rerenderBookmarkForm(getOpenSidepanelBody())
  },

  bookmarkFormTriggerPreviewUpload(target) {
    target.closest('[data-bookmark-form-preview-empty]')?.querySelector('[data-bookmark-preview-file]')?.click()
  },

  async bookmarkFormPreviewFileChange(target) {
    const file = target.files?.[0]
    if (!file) return
    syncBookmarkFormStateFromForm(target.closest('[data-module-crud-form]'))
    await uploadBookmarkPreview(file)
    target.value = ''
    await rerenderBookmarkForm(getOpenSidepanelBody())
  },

  async bookmarkFormSelectPreviewAsset(target) {
    syncBookmarkFormStateFromForm(target.closest('[data-module-crud-form]'))
    await selectBookmarkPreviewAsset(target.dataset.assetId)
    await rerenderBookmarkForm(getOpenSidepanelBody())
  },

  async bookmarkFormClearPreview(target) {
    syncBookmarkFormStateFromForm(target.closest('[data-module-crud-form]'))
    clearBookmarkPreview()
    await rerenderBookmarkForm(getOpenSidepanelBody())
  },

  async bookmarkFormApplyCrop(target) {
    syncBookmarkFormStateFromForm(target.closest('[data-module-crud-form]'))
    await applyBookmarkPreviewCrop()
    await rerenderBookmarkForm(getOpenSidepanelBody())
  },

  async feedFormTestUrl(target) {
    const form = target.closest('[data-module-crud-form]')
    syncFeedFormStateFromForm(form)
    await testFeedSourceUrl()
    rerenderFeedForm(getOpenSidepanelBody())
  },

  async feedFormLookup(target) {
    const form = target.closest('[data-module-crud-form]')
    syncFeedFormStateFromForm(form)
    await lookupFeedSourceUrls()
    rerenderFeedForm(getOpenSidepanelBody())
  },

  async feedFormUseDiscovered(target) {
    const form = target.closest('[data-module-crud-form]')
    syncFeedFormStateFromForm(form)
    const url = target.dataset.discoveredFeedUrl || ''
    if (!url) return
    await useDiscoveredFeedUrl(url)
    rerenderFeedForm(getOpenSidepanelBody())
  },

  bookmarkFormCropZoomIn() {
    bookmarkCropZoom(0.1)
  },

  bookmarkFormCropZoomOut() {
    bookmarkCropZoom(-0.1)
  },

  bookmarkFormCropMoveLeft() {
    bookmarkCropMove(-20, 0)
  },

  bookmarkFormCropMoveRight() {
    bookmarkCropMove(20, 0)
  },

  bookmarkFormCropMoveUp() {
    bookmarkCropMove(0, -20)
  },

  bookmarkFormCropMoveDown() {
    bookmarkCropMove(0, 20)
  },

  bookmarkFormCropFlipX() {
    bookmarkCropFlipX()
  },

  bookmarkFormCropFlipY() {
    bookmarkCropFlipY()
  },

  noteFormSetType(target) {
    const form = target.closest('[data-module-crud-form]')
    syncNoteFormStateFromForm(form)
    setNoteFormType(target.dataset.noteType)
    form?.querySelector?.('[name="type"]')?.setAttribute('value', target.dataset.noteType || '')
    rerenderNoteForm(getOpenModalBody())
  },

  noteFormSetStyle(target) {
    const form = target.closest('[data-module-crud-form]')
    syncNoteFormStateFromForm(form)
    setNoteFormStyle(target.dataset.noteStyleToken)
    if (!(form instanceof HTMLFormElement)) {
      rerenderNoteForm(getOpenModalBody())
      return
    }

    const nextToken = target.dataset.noteStyleToken || ''
    const hiddenInput = form.querySelector('[name="style_token"]')
    if (hiddenInput instanceof HTMLInputElement) {
      hiddenInput.value = nextToken
      hiddenInput.setAttribute('value', nextToken)
    }

    form.querySelectorAll('[data-note-style-token]').forEach((button) => {
      if (!(button instanceof HTMLElement)) return
      const isActive = button.dataset.noteStyleToken === nextToken
      button.toggleAttribute('data-note-token-active', isActive)
      button.toggleAttribute('data-note-style-active', isActive)
    })

    updateFormDirtyState(form)
  },

  async noteFormUnlock(target) {
    const form = target.closest('[data-module-crud-form]')
    if (!(form instanceof HTMLFormElement)) return
    await unlockNoteForm(form)
    rerenderNoteForm(getOpenModalBody())
  },
}
