import {buildDropdown} from '../../components/dropdown.js'
import {SPEEDTAB_SVG} from '../../components/icons.js'
import {escapeHtml} from '../../utils/html.js'
import {t} from '../../utils/i18n.js'
import {renderLocalToolsDropdownTrigger} from '../local-tools/render.js'
import {renderSearchChrome, renderSearchPanel} from '../search/render.js'
import {renderPageGrid} from './modules/render.js'
import {renderOrphansPage} from './orphans/render.js'

export function renderPagePanelContent(page, modules = [], options = {}) {
  if (page?.virtualType === 'orphans') {
    return renderOrphansPage(options.orphanCandidates)
  }
  return renderPageGrid(page, modules, options)
}

function renderCaptureInboxButton(count = 0) {
  if (!count) return ''
  const itemLabel = count === 1 ? t('nav.inboxItemSingular') : t('nav.inboxItemPlural')
  return `
    <button
      type="button"
      class="st-app-header-inbox st-btn"
      data-click="openCaptureInbox"
      title="${escapeHtml(t('nav.inboxWaiting', {count, itemsLabel: itemLabel}))}"
    >
      ${escapeHtml(t('nav.inbox'))}
      <span data-app-header-inbox-count>${escapeHtml(String(count))}</span>
    </button>
  `
}

function renderPageNavButton(page, activePage) {
  const isActive = activePage?.id === page.id
  return `
    <button
      data-tab-action="open"
      data-open="${escapeHtml(page.slug)}"
      data-page-sync-id="${escapeHtml(page.sync_id)}"
      ${isActive ? 'data-default' : ''}
      type="button"
      class="st-next-page-button"
    >
      ${page.icon ? `<span aria-hidden="true" class="st-next-page-button-icon">${escapeHtml(page.icon)}</span>` : ''}
      <span class="st-next-page-button-label">${escapeHtml(page.title)}</span>
    </button>
  `
}

function renderHiddenPageNavButton(page, activePage) {
  const isActive = activePage?.id === page.id
  return `<button
    data-tab-action="open"
    data-open="${escapeHtml(page.slug)}"
    data-page-sync-id="${escapeHtml(page.sync_id)}"
    ${isActive ? 'data-default' : ''}
    type="button"
    class="st-next-page-button st-next-page-button-overflow-placeholder"
    hidden
  ></button>`
}

function renderOverflowDropdown(overflowPages, activePage) {
  if (!overflowPages.length) return ''
  const items = overflowPages.map((page) => ({
    label: `${page.icon ? page.icon + ' ' : ''}${page.title}`,
    action: 'navigateToPage',
    attributes: {
      'data-page-slug': page.slug,
      ...(activePage?.id === page.id ? {'data-overflow-active': ''} : {}),
    },
  }))
  return buildDropdown({
    trigger: `${escapeHtml(t('nav.more'))} ${SPEEDTAB_SVG.chevron}`,
    ariaLabel: t('nav.morePages'),
    align: 'left',
    items,
  })
}

function renderPagePanel(page, activePage, pageModules = [], {hydrateBodies = true, hydratedPageSlugs = null, orphanCandidates = null} = {}) {
  const isActive = activePage?.id === page.id
  const shouldHydrateBodies = hydratedPageSlugs instanceof Set
    ? hydratedPageSlugs.has(page.slug)
    : hydrateBodies
  return `
    <div
      data-tab="${escapeHtml(page.slug)}"
      data-app-tab-panel
      data-spaceless
      ${isActive ? '' : 'inert'}
    >
      <div data-app-tab-shell data-page-sync-id="${escapeHtml(page.sync_id)}">
        <div data-app-tab-content data-page-slug="${escapeHtml(page.slug)}">
          ${renderPagePanelContent(page, pageModules, {hydrateBodies: shouldHydrateBodies, orphanCandidates})}
        </div>
      </div>
    </div>
  `
}

export function renderRootShell({
  pages,
  activePage,
  pageModulesBySlug = new Map(),
  hydrateBodies = true,
  hydratedPageSlugs = null,
  orphanCandidates = null,
  captureInboxCount = 0,
  widgetRail = '',
  widgetRailPosition = 'bottom',
}) {
  const mainPages     = pages.filter((p) => p.nav_group !== 'overflow')
  const overflowPages = pages.filter((p) => p.nav_group === 'overflow')

  return `
    <div
      data-app
      data-yai-tabs
      data-ref-path="pages"
      data-history-mode="push"
      data-theme="default"
    >
      <header data-app-brand-wrap data-swipe-ignore>
        ${buildDropdown({
          trigger: renderLocalToolsDropdownTrigger(),
          ariaLabel: t('scratchpad.helpersTitle'),
          align: 'left',
          triggerClass: 'st-app-brand-trigger',
          items: [
            {label: t('scratchpad.openAction'), action: 'openQuicknote'},
          ],
        })}
      </header>

      <nav data-controller data-app-header-nav>
        ${mainPages.map((page) => renderPageNavButton(page, activePage)).join('')}
        ${overflowPages.map((page) => renderHiddenPageNavButton(page, activePage)).join('')}
        ${renderOverflowDropdown(overflowPages, activePage)}
      </nav>

      <div data-app-header-actions data-swipe-ignore>
        ${renderCaptureInboxButton(captureInboxCount)}
        ${renderSearchChrome()}
        ${buildDropdown({
          trigger: `${escapeHtml(t('nav.pages'))} ${SPEEDTAB_SVG.chevron}`,
          ariaLabel: t('nav.pageActions'),
          triggerClass: 'st-app-header-action',
          items: [
            {label: t('nav.actions.addPage'), action: 'addPage'},
            {label: t('nav.actions.editPage'), action: 'editActivePage'},
            {label: t('nav.actions.addModule'), action: 'addPageModule', dividerTop: true},
            {label: t('nav.actions.copyUrl'), action: 'copyPageUrl', dividerTop: true},
          ],
        })}
        ${buildDropdown({
          trigger: SPEEDTAB_SVG.cog,
          ariaLabel: t('common.settings'),
          triggerClass: 'st-app-header-action',
          items: [
            {label: t('common.customize'), action: 'openCustomizerList'},
            {label: t('common.settings'), action: 'openSettings'},
            {label: t('assets.title'), action: 'openAssetBrowser', dividerTop: true},
            {label: t('nav.actions.sortContents'), action: 'openSorter', dividerTop: true},
            {label: t('next.settings.importExportTitle'), action: 'openImportExport', dividerTop: true},
          ],
        })}
      </div>

      ${renderSearchPanel()}

      ${widgetRail && widgetRailPosition === 'top' ? widgetRail : ''}

      <main data-content data-app-content data-swipe>
        ${pages.map((page) => renderPagePanel(page, activePage, pageModulesBySlug.get(page.slug) ?? [], {hydrateBodies, hydratedPageSlugs, orphanCandidates})).join('')}
      </main>

      ${widgetRail && widgetRailPosition === 'bottom'
        ? `<footer data-app-footer data-swipe-ignore>${widgetRail}</footer>`
        : ''}
    </div>
  `
}
