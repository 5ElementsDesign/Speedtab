import {SPEEDTAB_SVG} from '../../../../components/icons.js';
import {TILE_H, TILE_W} from '../../../../data/assets.js';
import {escapeHtml} from '../../../../utils/html.js';
import {t} from '../../../../utils/i18n.js';

function getModuleBookmarkFlags(config = {}) {
  return {
    forceFavicon: config?.behavior?.['module-tabs-force-favicon'] === true,
    quicklinks: config?.behavior?.['module-tabs-quicklinks'] === true,
    showTitleBelow: config?.behavior?.['module-tabs-show-title-below'] === true,
  }
}

function renderBookmarkTile(bookmark, moduleSyncId = '', config = {}) {
  const {forceFavicon, quicklinks} = getModuleBookmarkFlags(config)
  const title = escapeHtml(bookmark.title || bookmark.url)
  const hasThumbnail = !!bookmark.preview_asset_id
  const showPreview = hasThumbnail && !forceFavicon
  const imageSize = showPreview
    ? {
      width: quicklinks ? 48 : TILE_W,
      height: quicklinks ? 48 : TILE_H,
    }
    : {
      width: quicklinks ? 32 : 36,
      height: quicklinks ? 32 : 36,
    }

  return `
    <div data-bookmark-tile>
      <a
        href="${escapeHtml(bookmark.url)}"
        class="st-trigger-tab st-trigger-tab-media"
        target="_blank"
        rel="noopener noreferrer"
        draggable="false"
        aria-label="${title}"
        data-bookmark-id="${escapeHtml(bookmark.id)}"
        data-bookmark-sync-id="${escapeHtml(bookmark.sync_id ?? '')}"
        data-bookmark-link
        ${hasThumbnail ? 'data-bookmark-has-preview' : ''}
      >
        <img
          data-bookmark-media
          width="${imageSize.width}"
          height="${imageSize.height}"
          ${showPreview ? `data-preview-asset-id="${escapeHtml(String(bookmark.preview_asset_id))}"` : ''}
          ${bookmark.preview_asset_id ? `data-preview-asset-id-original="${escapeHtml(String(bookmark.preview_asset_id))}"` : ''}
          ${bookmark.favicon_asset_id ? `data-favicon-asset-id="${escapeHtml(String(bookmark.favicon_asset_id))}"` : ''}
          ${bookmark.url ? `data-favicon-url="${escapeHtml(bookmark.url)}"` : ''}
          alt=""
          class="st-bookmark-media"
          draggable="false"
        >
      </a>
      <a
        href="${escapeHtml(bookmark.url)}"
        class="st-trigger-tab-title"
        target="_blank"
        rel="noopener noreferrer"
        draggable="false"
        tabindex="-1"
        aria-label="${title}"
        data-bookmark-id="${escapeHtml(bookmark.id)}"
        data-bookmark-sync-id="${escapeHtml(bookmark.sync_id ?? '')}"
        data-bookmark-link
      >
        <span data-title>${title}</span>
      </a>
      <div data-bookmark-actions data-swipe-ignore>
        <button
          type="button"
          class="st-btn"
          tabindex="-1"
          data-click="editModuleBookmark"
          data-bookmark-sync-id="${escapeHtml(bookmark.sync_id ?? '')}"
          data-module-sync-id="${escapeHtml(moduleSyncId)}"
          aria-label="${escapeHtml(t('modules.actions.editBookmark'))}"
          title="${escapeHtml(t('modules.actions.editBookmark'))}"
        >${SPEEDTAB_SVG.pencil}</button>
        <button
          type="button"
          class="st-btn"
          tabindex="-1"
          data-click="deleteModuleBookmark"
          data-bookmark-id="${escapeHtml(String(bookmark.id ?? ''))}"
          data-bookmark-title="${title}"
          aria-label="${escapeHtml(t('common.delete'))}"
          title="${escapeHtml(t('common.delete'))}"
        >${SPEEDTAB_SVG.x}</button>
      </div>
    </div>
  `
}

function renderBookmarkAddTile(moduleSyncId = '') {
  return `
    <div data-bookmark-tile data-bookmark-add-tile>
      <button
        type="button"
        class="st-trigger-tab st-btn"
        data-click="addModuleBookmark"
        data-swipe-allow
        data-sync-id="${escapeHtml(moduleSyncId)}"
        data-bookmark-inline-add
        title="${escapeHtml(t('modules.actions.addBookmark'))}"
        aria-label="${escapeHtml(t('modules.actions.addBookmark'))}"
      >${SPEEDTAB_SVG.plus}</button>
    </div>
  `
}

export function renderBookmarksGrid(bookmarks, moduleSyncId = '', config = {}) {
  const showAddTile = config?.behavior?.['module-tabs-show-add-tile'] !== false
  const bookmarkTiles = bookmarks.map((bookmark) => renderBookmarkTile(bookmark, moduleSyncId, config)).join('')
  return `
    <div
      class="st-module-content-wrapper"
      data-module-tabs-bookmarks
      ${bookmarks.length ? '' : 'data-bookmarks-empty'}
    >
      ${!bookmarks.length ? `<p class="st-bookmarks-empty m-0">${t('modules.empty.bookmarks')}</p>` : ''}
      ${bookmarkTiles}
      ${showAddTile ? renderBookmarkAddTile(moduleSyncId) : ''}
    </div>
  `
}

export function renderTabsModule(tabs = [], actionsHtml = '', moduleId = null, moduleSyncId = '', config = {}) {
  const actions = actionsHtml
    ? `<div data-module-actions data-swipe-ignore>${actionsHtml}</div>`
    : ''
  const cardActions = actionsHtml
    ? `<div data-module-card-actions-host data-swipe-ignore>${actionsHtml}</div>`
    : ''

  if (!tabs.length) {
    return `
      <div data-module-empty-state-wrap>
        ${actions}
        ${cardActions}
        <div data-swipe-ignore><p class="st-module-empty-state m-0">${t('modules.empty.tabs')}</p></div>
      </div>
    `
  }

  const refPathName = moduleId != null ? `m${moduleId}` : null

  let currentModulePage = refPathName ? new URLSearchParams(location.hash.slice(1)).get(refPathName) : null
  currentModulePage = currentModulePage ? currentModulePage.replace('tab-', '') : null

  const navBtns = tabs.map((tab,idx) => `
    <button
      data-tab-action="open"
      ${currentModulePage == tab.id ? 'data-inview-default' : ''}
      ${!currentModulePage && idx === 0 ? 'data-inview-default data-default' : ''}
      data-open="tab-${tab.id}"
      data-tab-id="${escapeHtml(String(tab.id ?? ''))}"
      data-tab-sync-id="${escapeHtml(tab.sync_id ?? '')}"
    >${escapeHtml(tab.title)}
    </button>
  `).join('')

  const panels = tabs.map((tab) => `
    <div data-tab="tab-${tab.id}" data-tab-id="${escapeHtml(String(tab.id ?? ''))}" data-tab-sync-id="${escapeHtml(tab.sync_id ?? '')}">
      ${renderBookmarksGrid(tab.bookmarks ?? [], moduleSyncId, config)}
    </div>
  `).join('')

  const refPath = moduleId != null ? ` data-ref-path="${refPathName}"` : ''
  const {forceFavicon, quicklinks, showTitleBelow} = getModuleBookmarkFlags(config)
  const quicklinksAttr = quicklinks ? ' data-bookmarks-quicklinks' : ''
  const forceFaviconAttr = forceFavicon ? ' data-bookmarks-force-favicon' : ''
  const showTitleBelowAttr = showTitleBelow ? ' data-bookmarks-show-title-below' : ''

  return `
    <div data-module-tabs-shell>
      <div data-yai-tabs data-swipe data-behavior="fade"${refPath}${quicklinksAttr}${forceFaviconAttr}${showTitleBelowAttr}>
        <nav data-controller>${navBtns}</nav>
        ${actions}
        <div data-content>${panels}</div>
      </div>
      ${cardActions}
    </div>
  `
}
