import {sanitizeHtml} from '../../../composables/useSanitize.ts'
import {SPEEDTAB_SVG} from '../../components/icons.js'
import {getCachedAppSettings} from '../../data/app-settings.js'
import {initFavicons} from '../../utils/favicon.js'
import {escapeHtml} from '../../utils/html.js'
import {t} from '../../utils/i18n.js'

const feedUiStateByKey = new Map()
const FEED_FOCUS_STORAGE_KEY = 'speedtab.next.feed.focus'
const FEED_FOCUS_WIDTH_VALUES = ['320', '480', '740', '940', '1240', '1540', 'max']

function makeStateKey(moduleSyncId, collectionId) {
  return `${moduleSyncId || 'module'}::${collectionId || 'collection'}`
}

function readStoredFocusWidths() {
  try {
    return JSON.parse(localStorage.getItem(FEED_FOCUS_STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function readStoredFocusWidth(key) {
  const values = readStoredFocusWidths()
  const width = values?.[key]
  return FEED_FOCUS_WIDTH_VALUES.includes(width) ? width : ''
}

function storeFocusWidth(key, width) {
  if (!key || !FEED_FOCUS_WIDTH_VALUES.includes(width)) return
  const values = readStoredFocusWidths()
  values[key] = width
  try {
    localStorage.setItem(FEED_FOCUS_STORAGE_KEY, JSON.stringify(values))
  } catch {}
}

function createDefaultState(key = '') {
  return {
    activeSourceId: null,
    loadingSourceId: null,
    unreadOnly: false,
    showLoadedItems: true,
    expandedItemIds: [],
    focusWidth: readStoredFocusWidth(key),
    focusOpen: false,
  }
}

function parseFeedModuleConfig(configJson) {
  if (!configJson) return {feedItemLimit: 0}
  try {
    const parsed = JSON.parse(configJson)
    return {
      feedItemLimit: typeof parsed.feed_item_limit === 'number' ? parsed.feed_item_limit : 0,
    }
  } catch {
    return {feedItemLimit: 0}
  }
}

function cloneState(state) {
  return {
    activeSourceId: state.activeSourceId,
    loadingSourceId: state.loadingSourceId,
    unreadOnly: state.unreadOnly,
    showLoadedItems: state.showLoadedItems,
    expandedItemIds: [...state.expandedItemIds],
    focusWidth: state.focusWidth ?? '',
    focusOpen: state.focusOpen === true,
  }
}

export function getFeedUiState(moduleSyncId, collectionId) {
  const key = makeStateKey(moduleSyncId, collectionId)
  if (!feedUiStateByKey.has(key)) {
    feedUiStateByKey.set(key, createDefaultState(key))
  }
  return cloneState(feedUiStateByKey.get(key))
}

export function setFeedUiState(moduleSyncId, collectionId, nextState) {
  feedUiStateByKey.set(makeStateKey(moduleSyncId, collectionId), {
    ...createDefaultState(makeStateKey(moduleSyncId, collectionId)),
    ...nextState,
    expandedItemIds: [...(nextState.expandedItemIds ?? [])],
  })
}

function updateFeedUiState(moduleSyncId, collectionId, updater) {
  const key = makeStateKey(moduleSyncId, collectionId)
  const current = feedUiStateByKey.get(key) ?? createDefaultState()
  const next = updater(cloneState(current)) ?? current
  setFeedUiState(moduleSyncId, collectionId, next)
  return getFeedUiState(moduleSyncId, collectionId)
}

export function toggleFeedSourceState(moduleSyncId, collectionId, sourceId) {
  return updateFeedUiState(moduleSyncId, collectionId, (state) => {
    state.activeSourceId = state.activeSourceId === sourceId ? null : sourceId
    return state
  })
}

export function setFeedSourceLoadingState(moduleSyncId, collectionId, sourceId = null) {
  return updateFeedUiState(moduleSyncId, collectionId, (state) => {
    state.loadingSourceId = typeof sourceId === 'number' ? sourceId : null
    return state
  })
}

export function toggleFeedUnreadState(moduleSyncId, collectionId) {
  return updateFeedUiState(moduleSyncId, collectionId, (state) => {
    state.unreadOnly = !state.unreadOnly
    return state
  })
}

export function toggleFeedLoadedState(moduleSyncId, collectionId) {
  return updateFeedUiState(moduleSyncId, collectionId, (state) => {
    state.showLoadedItems = !state.showLoadedItems
    return state
  })
}

export function toggleFeedItemExpansionState(moduleSyncId, collectionId, itemId) {
  return updateFeedUiState(moduleSyncId, collectionId, (state) => {
    state.expandedItemIds = state.expandedItemIds.includes(itemId)
      ? state.expandedItemIds.filter((entry) => entry !== itemId)
      : [...state.expandedItemIds, itemId]
    return state
  })
}

export function collapseFeedItemState(moduleSyncId, collectionId, itemId) {
  return updateFeedUiState(moduleSyncId, collectionId, (state) => {
    state.expandedItemIds = state.expandedItemIds.filter((entry) => entry !== itemId)
    return state
  })
}

export function setFeedFocusWidth(moduleSyncId, collectionId, width) {
  const key = makeStateKey(moduleSyncId, collectionId)
  if (!FEED_FOCUS_WIDTH_VALUES.includes(width)) return getFeedUiState(moduleSyncId, collectionId)
  storeFocusWidth(key, width)
  return updateFeedUiState(moduleSyncId, collectionId, (state) => {
    state.focusWidth = width
    return state
  })
}

export function openFeedFocusState(moduleSyncId, collectionId, width = '') {
  return updateFeedUiState(moduleSyncId, collectionId, (state) => {
    if (FEED_FOCUS_WIDTH_VALUES.includes(width)) {
      state.focusWidth = width
      storeFocusWidth(makeStateKey(moduleSyncId, collectionId), width)
    }
    state.focusOpen = true
    return state
  })
}

export function closeFeedFocusState(moduleSyncId, collectionId) {
  return updateFeedUiState(moduleSyncId, collectionId, (state) => {
    state.focusOpen = false
    return state
  })
}

function formatFeedDate(item) {
  const stamp = item.published_at ?? item.fetched_at ?? null
  if (!stamp) return ''
  const date = new Date(stamp)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})
}

function formatFeedLongDate(item) {
  const stamp = item.published_at ?? item.fetched_at ?? null
  if (!stamp) return ''
  const date = new Date(stamp)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
}

function buildSearchUrl(title) {
  const query = encodeURIComponent(title || '')
  const template = getCachedAppSettings().feed_search_url_template?.trim() || 'https://www.google.com/search?q=%s'
  return template.includes('%s')
    ? template.replace(/%s/g, query)
    : `${template}${template.includes('?') ? '&' : '?'}q=${query}`
}

function getFocusSelectValue(state) {
  if (state.focusOpen && state.focusWidth) return state.focusWidth
  return 'expand'
}

function renderFeedFocusControls(moduleSyncId, collectionId, state) {
  const selectValue = getFocusSelectValue(state)
  const quickWidth = state.focusWidth
  const selectId = `feed-focus-width-${escapeHtml(moduleSyncId)}-${escapeHtml(String(collectionId))}`

  return `
    <div class="st-module-feed-focus-controls" data-swipe-ignore>
      <select
        id="${selectId}"
        name="feed_focus_width"
        data-change="changeFeedFocusWidth"
        data-feed-module-sync-id="${escapeHtml(moduleSyncId)}"
        data-feed-collection-id="${escapeHtml(String(collectionId))}"
        title="${escapeHtml(t('feeds.focusSelectTitle'))}"
      >
        <option value="expand"${selectValue === 'expand' ? ' selected' : ''}>${escapeHtml(t('feeds.focusExpand'))}</option>
        ${FEED_FOCUS_WIDTH_VALUES.map((value) => `
          <option value="${escapeHtml(value)}"${selectValue === value ? ' selected' : ''}>${escapeHtml(value === 'max' ? t('feeds.focusMax') : value)}</option>
        `).join('')}
      </select>
      ${quickWidth ? `
        <button
          type="button"
          class="st-module-feed-toolbar-button"
          data-click="openFeedFocusQuick"
          data-feed-module-sync-id="${escapeHtml(moduleSyncId)}"
          data-feed-collection-id="${escapeHtml(String(collectionId))}"
          title="${escapeHtml(t('feeds.focusQuickTitle', {width: quickWidth === 'max' ? t('feeds.focusMax') : quickWidth}))}"
        >${escapeHtml(quickWidth === 'max' ? t('feeds.focusMax') : quickWidth)}</button>
      ` : ''}
      ${state.focusOpen ? `
        <button
          type="button"
          class="st-module-feed-toolbar-button st-module-feed-focus-close"
          data-click="closeFeedFocusMode"
          data-feed-module-sync-id="${escapeHtml(moduleSyncId)}"
          data-feed-collection-id="${escapeHtml(String(collectionId))}"
          title="${escapeHtml(t('feeds.focusClose'))}"
          aria-label="${escapeHtml(t('feeds.focusClose'))}"
        >${SPEEDTAB_SVG.sidepanelClose}</button>
      ` : ''}
    </div>
  `
}

function isArchivedFeedItem(item, savedFeedItems = []) {
  return savedFeedItems.some((row) => {
    if (row.meta_json) {
      try {
        const parsed = JSON.parse(row.meta_json)
        if (parsed?.external_id && parsed.external_id === item.external_id) return true
      } catch {}
    }
    return row.title === item.title && row.url === item.url
  })
}

function renderFeedSourceIcon(source) {
  const faviconUrl = source.site_url || source.feed_url || ''
  return `
    <span class="st-module-feed-source-icon">
      <img data-favicon-url="${escapeHtml(faviconUrl)}" alt="" draggable="false" >
    </span>
  `
}

function renderFeedItemBody(item, sourceTitle, moduleSyncId, collectionId, isArchived = false) {
  const content = item.content ?? item.summary ?? ''
  const contentHtml = content ? sanitizeHtml(content) : ''
  const longDate = formatFeedLongDate(item)
  const searchUrl = buildSearchUrl(item.title)

  return `
    <div class="st-module-feed-item-body">
      <div class="st-module-feed-item-meta">
        <h3 class="st-module-feed-item-heading">${escapeHtml(item.title)}</h3>
        <p class="st-module-feed-item-byline">
          ${longDate ? `<span>${escapeHtml(longDate)}</span>` : ''}
          ${item.author ? `${longDate ? '<span> · </span>' : ''}${escapeHtml(item.author)}` : ''}
        </p>
      </div>

      ${contentHtml
        ? `<div class="st-module-feed-item-copy">${contentHtml}</div>`
        : `<p class="st-module-feed-item-empty">${escapeHtml(t('feedItem.noSummary'))}</p>`}

      <div class="st-module-feed-item-actions">
        ${item.url ? `
          <a
            href="${escapeHtml(item.url)}"
            target="_blank"
            rel="noopener noreferrer"
            class="st-module-feed-item-open button"
          >${escapeHtml(t('feedItem.open'))}</a>
        ` : ''}
        <a
          href="${escapeHtml(searchUrl)}"
          target="_blank"
          rel="noopener noreferrer"
          class="st-module-feed-item-action button"
        >${escapeHtml(t('feedItem.search'))}</a>
        <button
          type="button"
          data-click="archiveFeedItem"
          data-feed-item-id="${escapeHtml(String(item.id ?? ''))}"
          data-feed-source-id="${escapeHtml(String(item.feed_source_id ?? ''))}"
          data-feed-module-sync-id="${escapeHtml(moduleSyncId)}"
          data-feed-collection-id="${escapeHtml(String(collectionId))}"
          data-feed-title="${escapeHtml(item.title)}"
          data-feed-url="${escapeHtml(item.url ?? '')}"
          data-feed-source-title="${escapeHtml(sourceTitle)}"
          data-feed-author="${escapeHtml(item.author ?? '')}"
          data-feed-published-at="${escapeHtml(String(item.published_at ?? ''))}"
          data-feed-summary="${escapeHtml(item.summary ?? '')}"
          data-feed-content="${escapeHtml(item.content ?? '')}"
          data-feed-external-id="${escapeHtml(item.external_id ?? '')}"
          class="st-module-feed-item-action"
          title="${escapeHtml(isArchived ? t('feedItem.archived') : t('feedItem.archiveThisItem'))}"
          aria-label="${escapeHtml(isArchived ? t('feedItem.archived') : t('feedItem.archiveThisItem'))}"
          ${isArchived ? 'disabled' : ''}
        >${escapeHtml(isArchived ? t('feedItem.archived') : t('feedItem.save'))}</button>
      </div>
    </div>
  `
}

function renderFeedItem(item, source, moduleSyncId, collectionId, state, isArchived = false) {
  const itemId = typeof item.id === 'number' ? item.id : null
  const expanded = itemId != null && state.expandedItemIds.includes(itemId)
  const read = item.read_at != null
  const date = formatFeedDate(item)
  const sourceTitle = source?.title || t('feeds.filterAll')
  const sourceIconUrl = source?.site_url || source?.feed_url || ''

  return `
    <article class="st-module-feed-item" data-feed-item-id="${escapeHtml(String(item.id ?? ''))}" data-feed-source-id="${escapeHtml(String(item.feed_source_id ?? ''))}" data-read="${read ? 'true' : 'false'}" data-newly-fetched="false" data-expanded="${expanded ? 'true' : 'false'}">
      <div class="st-module-feed-item-header">
        <div class="st-module-feed-item-icon" title="${escapeHtml(sourceTitle)}">
          <img data-favicon-url="${escapeHtml(sourceIconUrl)}" alt="" draggable="false">
        </div>

        <button
          type="button"
          data-click="toggleFeedItem"
          data-feed-item-id="${escapeHtml(String(item.id ?? ''))}"
          data-feed-source-id="${escapeHtml(String(item.feed_source_id ?? ''))}"
          data-feed-module-sync-id="${escapeHtml(moduleSyncId)}"
          data-feed-collection-id="${escapeHtml(String(collectionId))}"
          class="st-module-feed-item-toggle"
          aria-expanded="${expanded ? 'true' : 'false'}"
          title="${escapeHtml(sourceTitle)} · ${escapeHtml(item.title)}"
        >
          <span class="st-module-feed-item-title" title="${escapeHtml(item.title)}" aria-hidden="true">${escapeHtml(item.title)}</span>
        </button>

        <span class="st-module-feed-item-read-indicator" aria-hidden="true">${escapeHtml(t('feedItem.read'))}</span>
        <span class="st-module-feed-item-date" title="${escapeHtml(formatFeedLongDate(item))}">${escapeHtml(date)}</span>

        <button
          type="button"
          data-click="archiveFeedItem"
          data-feed-item-id="${escapeHtml(String(item.id ?? ''))}"
          data-feed-source-id="${escapeHtml(String(item.feed_source_id ?? ''))}"
          data-feed-module-sync-id="${escapeHtml(moduleSyncId)}"
          data-feed-collection-id="${escapeHtml(String(collectionId))}"
          class="st-module-feed-item-save"
          title="${escapeHtml(isArchived ? t('feedItem.archived') : t('feedItem.archiveThisItem'))}"
          aria-label="${escapeHtml(isArchived ? t('feedItem.archived') : t('feedItem.archiveThisItem'))}"
          ${isArchived ? 'disabled' : ''}
        >${escapeHtml(isArchived ? t('feedItem.archived') : t('feedItem.save'))}</button>
      </div>

      ${expanded ? renderFeedItemBody(item, sourceTitle, moduleSyncId, collectionId, isArchived) : ''}
    </article>
  `
}

function filterFeedItems(items, state) {
  return items.filter((item) => {
    if (state.activeSourceId != null && item.feed_source_id !== state.activeSourceId) return false
    if (state.unreadOnly && item.read_at != null) return false
    return true
  })
}

export function renderFeedCollection(collection, moduleSyncId, moduleConfig = {}) {
  const sources = collection.feedSources ?? []
  const items = collection.feedItems ?? []
  const savedFeedItems = collection.savedFeedItems ?? []
  const sourceById = new Map(sources.filter((source) => typeof source.id === 'number').map((source) => [source.id, source]))
  const state = getFeedUiState(moduleSyncId, collection.id ?? 0)
  const itemLimit = Number.isInteger(moduleConfig.feedItemLimit) ? moduleConfig.feedItemLimit : 0
  const filteredItems = state.showLoadedItems ? filterFeedItems(items, state) : []
  const visibleItems = itemLimit > 0 ? filteredItems.slice(0, itemLimit) : filteredItems
  const unreadCount = visibleItems.filter((item) => item.read_at == null).length
  const selectedSource = state.activeSourceId != null
    ? sources.find((source) => source.id === state.activeSourceId)
    : null
  const title = state.unreadOnly ? t('feeds.filterUnread') : (selectedSource?.title || t('feeds.filterAll'))
  const showLoadedItemsButton = !state.showLoadedItems && items.length > 0
  const hasUnreadItems = items.some((item) => item.read_at == null)

  const setFocusWidth = state.focusOpen ? `data-focus-width="${escapeHtml(state.focusWidth)}"` : ``;

  return `
    <div class="st-module-feed st-feed-grid"
      data-feed-collection-id="${escapeHtml(String(collection.id ?? ''))}"
      data-feed-collection-title="${escapeHtml(collection.title ?? '')}"
      data-feed-module-sync-id="${escapeHtml(moduleSyncId)}"${state.focusOpen ? ' data-feed-focus-open' : ''}
      ${setFocusWidth}
    >
      <aside class="st-module-feed-sidebar st-feed-grid--sidebar">
        <div class="st-feed-grid--sidebar-content">
          <nav class="st-module-feed-sources" aria-label="${escapeHtml(t('feeds.feedSourcesAria'))}">
            ${sources.length ? sources.map((source) => {
              const isActive = state.activeSourceId === source.id
              const isLoading = state.loadingSourceId === source.id
              const rowClass = [
                'st-module-feed-source-row',
                isLoading ? 'is-loading' : '',
                source.last_error_at ? '' : '',
                isActive ? '' : '',
              ].filter(Boolean).join(' ')
              const buttonClass = [
                'st-module-feed-source-button',
                isActive ? '' : '',
              ].join(' ')
              return `
                <div class="${rowClass}" data-feed-source-id="${escapeHtml(String(source.id ?? ''))}">
                  <button
                    type="button"
                    data-click="toggleFeedSource"
                    data-feed-source-id="${escapeHtml(String(source.id ?? ''))}"
                    data-feed-collection-id="${escapeHtml(String(collection.id ?? ''))}"
                    data-feed-module-sync-id="${escapeHtml(moduleSyncId)}"
                    class="${buttonClass}"
                    aria-pressed="${isActive ? 'true' : 'false'}"
                    aria-busy="${isLoading ? 'true' : 'false'}"
                    title="${escapeHtml(source.title)}"
                  >
                    ${renderFeedSourceIcon(source)}
                    <span class="st-module-feed-source-label">${escapeHtml(source.title)}</span>
                  </button>
                  <button
                    type="button"
                    data-click="editFeedSource"
                    data-feed-source-id="${escapeHtml(String(source.id ?? ''))}"
                    data-feed-collection-id="${escapeHtml(String(collection.id ?? ''))}"
                    data-feed-module-sync-id="${escapeHtml(moduleSyncId)}"
                    class="st-module-feed-source-edit"
                    aria-label="${escapeHtml(t('feeds.editSourceAria', {title: source.title}))}"
                    title="${escapeHtml(t('feeds.editSource'))}"
                  >${SPEEDTAB_SVG.pencil}</button>
                </div>
              `
            }).join('') : `<div class="st-module-feed-empty"><p class="st-module-feed-empty-text">${escapeHtml(t('feeds.noFeedsInModule'))}</p></div>`}
          </nav>
          <div class="st-module-feed-sidebar-footer">
            <button
              type="button"
              data-click="openAddFeedSource"
              data-feed-collection-id="${escapeHtml(String(collection.id ?? ''))}"
              data-feed-module-sync-id="${escapeHtml(moduleSyncId)}"
              class="st-module-feed-add-source"
            >${escapeHtml(t('feeds.addSource'))}</button>
          </div>
        </div>
      </aside>

      <div class="st-module-feed-main st-feed-grid--content">
        <div class="st-module-feed-toolbar">
          <div class="st-module-feed-meta">
            <button
              type="button"
              data-click="toggleLoadedItemsVisibility"
              data-feed-collection-id="${escapeHtml(String(collection.id ?? ''))}"
              data-feed-module-sync-id="${escapeHtml(moduleSyncId)}"
              class="st-module-feed-title"
              title="${escapeHtml(state.showLoadedItems ? t('feeds.hideLoadedItems') : t('feeds.showLoadedItems'))}"
            >${escapeHtml(title)}</button>
            <button
              type="button"
              data-click="toggleUnreadFilter"
              data-feed-collection-id="${escapeHtml(String(collection.id ?? ''))}"
              data-feed-module-sync-id="${escapeHtml(moduleSyncId)}"
              class="st-module-feed-toolbar-badge"
              title="${escapeHtml(hasUnreadItems ? (state.unreadOnly ? t('feeds.showAllItems') : t('feeds.showUnreadItems')) : t('feeds.noUnreadItems'))}"
              ${hasUnreadItems ? '' : 'disabled'}
            >${escapeHtml(t('feeds.unreadLabel', {count: unreadCount}))}</button>
          </div>

          <div class="st-module-feed-actions">
            ${renderFeedFocusControls(moduleSyncId, collection.id ?? 0, state)}
            <button
              type="button"
              data-click="markAllAsRead"
              data-feed-collection-id="${escapeHtml(String(collection.id ?? ''))}"
              data-feed-module-sync-id="${escapeHtml(moduleSyncId)}"
              class="st-module-feed-toolbar-button"
              ${visibleItems.some((item) => item.read_at == null) ? '' : 'disabled'}
            >${escapeHtml(t('feeds.markRead'))}</button>
            <button
              type="button"
              data-click="refreshAllFeeds"
              data-feed-collection-id="${escapeHtml(String(collection.id ?? ''))}"
              data-feed-module-sync-id="${escapeHtml(moduleSyncId)}"
              class="st-module-feed-toolbar-button"
              ${sources.length ? '' : 'disabled'}
            >${escapeHtml(t('feeds.refresh'))}</button>
          </div>
        </div>

        ${showLoadedItemsButton ? `
          <div class="st-module-feed-empty">
            <div>
              <p class="st-module-feed-empty-text">${escapeHtml(t('feeds.loadedItemsHidden'))}</p>
              <button
                type="button"
                data-click="toggleLoadedItemsVisibility"
                data-feed-collection-id="${escapeHtml(String(collection.id ?? ''))}"
                data-feed-module-sync-id="${escapeHtml(moduleSyncId)}"
              >${escapeHtml(t('feeds.showLoadedItems'))}</button>
            </div>
          </div>
        ` : visibleItems.length ? `
          <div class="st-module-feed-list st-feed-grid--content-fetched">
            <div class="st-module-feed-list-inner st-feed-grid-ajax-response">
              ${visibleItems.map((item) => renderFeedItem(
                item,
                sourceById.get(item.feed_source_id),
                moduleSyncId,
                collection.id ?? 0,
                state,
                isArchivedFeedItem(item, savedFeedItems),
              )).join('')}
            </div>
          </div>
        ` : `
          <div class="st-module-feed-empty">
            <div>
              <p class="st-module-feed-empty-text">${escapeHtml(
                !sources.length
                  ? t('feeds.noFeedsInModule')
                  : state.unreadOnly
                    ? t('feeds.noUnreadItemsFound')
                    : state.activeSourceId != null
                      ? t('feeds.noItemsForSource')
                      : t('feeds.noItemsFound')
              )}</p>
              ${!sources.length ? `
                <button
                  type="button"
                  data-click="openAddFeedSource"
                  data-feed-collection-id="${escapeHtml(String(collection.id ?? ''))}"
                  data-feed-module-sync-id="${escapeHtml(moduleSyncId)}"
                >${escapeHtml(t('feeds.addSource'))}</button>
              ` : state.activeSourceId != null ? `
                <button
                  type="button"
                  data-click="toggleFeedSource"
                  data-feed-source-id="${escapeHtml(String(state.activeSourceId))}"
                  data-feed-collection-id="${escapeHtml(String(collection.id ?? ''))}"
                  data-feed-module-sync-id="${escapeHtml(moduleSyncId)}"
                >${escapeHtml(t('feeds.showAllSources'))}</button>
              ` : ''}
            </div>
          </div>
        `}
      </div>
    </div>
  `
}

export function renderFeedsModule(tabs = [], actionsHtml = '', moduleId = null, moduleSyncId = '', viewModel = {}) {
  const actions = actionsHtml ? `<div data-module-actions data-swipe-ignore>${actionsHtml}</div>` : ''
  const cardActions = actionsHtml ? `<div data-module-card-actions-host data-swipe-ignore>${actionsHtml}</div>` : ''
  const moduleConfig = parseFeedModuleConfig(viewModel.configJson)

  if (!tabs.length) {
    return `
      <div data-module-empty-state-wrap>
        ${actions}
        ${cardActions}
        <div data-swipe-ignore><p class="st-module-empty-state">${escapeHtml(t('feeds.noFeedsInModule'))}</p></div>
      </div>
    `
  }

  const refPathName = moduleId != null ? `m${moduleId}` : null
  let currentModulePage = refPathName ? new URLSearchParams(location.hash.slice(1)).get(refPathName) : null
  currentModulePage = currentModulePage ? currentModulePage.replace('tab-', '') : null

  const navBtns = tabs.map((tab, idx) => `
    <button
      data-tab-action="open"
      ${currentModulePage == tab.id ? 'data-inview-default' : ''}
      ${!currentModulePage && idx === 0 ? 'data-inview-default data-default' : ''}
      data-open="tab-${tab.id}"
      data-tab-id="${escapeHtml(String(tab.id ?? ''))}"
      data-tab-sync-id="${escapeHtml(tab.sync_id ?? '')}"
    >${escapeHtml(tab.title)}</button>
  `).join('')

  const panels = tabs.map((tab) => `
    <div
      data-tab="tab-${tab.id}"
      data-tab-id="${escapeHtml(String(tab.id ?? ''))}"
      data-tab-sync-id="${escapeHtml(tab.sync_id ?? '')}"
      data-spaceless
    >
      ${renderFeedCollection(tab, moduleSyncId, moduleConfig)}
    </div>
  `).join('')

  const refPath = moduleId != null ? ` data-ref-path="${refPathName}"` : ''

  return `
    <div data-module-tabs-shell data-swipe-ignore>
      <div data-yai-tabs data-behavior="fade"${refPath}>
        <nav data-controller>${navBtns}</nav>
        ${actions}
        <div data-content>${panels}</div>
      </div>
      ${cardActions}
    </div>
  `
}

export function initFeedFavicons(container) {
  if (!(container instanceof HTMLElement)) return
  initFavicons(container)
}
