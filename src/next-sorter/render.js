import {SPEEDTAB_SVG} from '../next/components/icons.js'
import {escapeHtml} from '../next/utils/html.js'
import {t} from '../next/utils/i18n.js'

function region(name, content) {
  return `<div data-sorter-region="${escapeHtml(name)}">${content}</div>`
}

function renderModuleSpanOptions(selectedValue) {
  let options = ''
  for (let index = 1; index <= 12; index += 1) {
    options += `<option value="${index}"${selectedValue === index ? ' selected' : ''}>${escapeHtml(t('sorter.columnsOption', {count: index}))}</option>`
  }
  return options
}

function renderContentRows(module, tab, contentItems = [], contentSortActive = false, editor = null) {
  return `
    <div
      data-sorter-content-dropzone
      data-module-id="${escapeHtml(String(module.id))}"
      data-module-sync-id="${escapeHtml(module.syncId)}"
      data-module-type="${escapeHtml(module.type)}"
      data-tab-id="${escapeHtml(String(tab.id))}"
      data-tab-sync-id="${escapeHtml(tab.syncId)}"
    >
      ${contentItems.length ? `
        <div data-sorter-content-list>
          ${contentItems.map((item) => `
            <div
              data-sorter-content-row
              data-content-id="${escapeHtml(String(item.id))}"
              data-content-sync-id="${escapeHtml(item.syncId)}"
              data-content-type="${escapeHtml(module.type)}"
              data-tab-id="${escapeHtml(String(tab.id))}"
              data-tab-sync-id="${escapeHtml(tab.syncId)}"
              data-module-id="${escapeHtml(String(module.id))}"
              data-module-sync-id="${escapeHtml(module.syncId)}"
              data-module-type="${escapeHtml(module.type)}"
            >
              <button
                type="button"
                draggable="${contentSortActive ? 'true' : 'false'}"
                data-sorter-content-drag-handle
                data-content-id="${escapeHtml(String(item.id))}"
                data-content-sync-id="${escapeHtml(item.syncId)}"
                data-content-type="${escapeHtml(module.type)}"
                data-tab-id="${escapeHtml(String(tab.id))}"
                data-tab-sync-id="${escapeHtml(tab.syncId)}"
                data-module-id="${escapeHtml(String(module.id))}"
                data-module-sync-id="${escapeHtml(module.syncId)}"
                data-module-type="${escapeHtml(module.type)}"
                title="${escapeHtml(t('sorter.dragContent'))}"
                aria-label="${escapeHtml(t('sorter.dragContent'))}"
              >${SPEEDTAB_SVG.dashboard}</button>
              <span data-sorter-content-title>${escapeHtml(item.title || t('sorter.untitledContent'))}</span>
              <span data-sorter-content-subtitle>${escapeHtml(item.subtitle || '')}</span>
              <div data-sorter-row-actions>
                <button
                  type="button"
                  data-click="sorterOpenItemEditor"
                  data-sorter-kind="content"
                  data-sorter-module-type="${escapeHtml(module.type)}"
                  data-sorter-target-id="${escapeHtml(String(item.id))}"
                  data-sorter-parent-id="${escapeHtml(String(tab.id))}"
                  data-sorter-title="${escapeHtml(item.title || '')}"
                  title="${escapeHtml(t('sorter.editItem'))}"
                  aria-label="${escapeHtml(t('sorter.editItem'))}"
                >${SPEEDTAB_SVG.pencil}</button>
                <button
                  type="button"
                  data-click="sorterDeleteItem"
                  data-sorter-kind="content"
                  data-sorter-module-type="${escapeHtml(module.type)}"
                  data-sorter-target-id="${escapeHtml(String(item.id))}"
                  data-sorter-parent-id="${escapeHtml(String(tab.id))}"
                  data-sorter-title="${escapeHtml(item.title || '')}"
                  title="${escapeHtml(t('sorter.deleteItem'))}"
                  aria-label="${escapeHtml(t('sorter.deleteItem'))}"
                >${SPEEDTAB_SVG.x}</button>
              </div>
              ${editor?.kind === 'content' && editor?.targetId === item.id ? `
                <div data-sorter-inline-editor>
                  <input
                    type="text"
                    value="${escapeHtml(editor.title || item.title || '')}"
                    data-input="sorterEditorInput"
                    data-sorter-editor-input
                    autocomplete="off"
                  >
                  <div data-sorter-inline-editor-actions>
                    <button type="button" data-click="sorterSaveItemEditor" data-btn="danger">${escapeHtml(t('common.save'))}</button>
                    <button type="button" data-click="sorterCancelItemEditor" data-btn="ghost">${escapeHtml(t('common.cancel'))}</button>
                  </div>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      ` : `
        <div data-sorter-content-empty>${escapeHtml(contentSortActive ? t('sorter.dropContentHere') : t('sorter.noContent'))}</div>
      `}
    </div>
  `
}

function renderTabRows(module, tabs = [], options = {}) {
  const {
    tabSortActive = false,
    contentSortActive = false,
    contentsByTabSyncId = new Map(),
    editor = null,
  } = options

  return `
    <div
      data-sorter-tab-dropzone
      data-module-id="${escapeHtml(String(module.id))}"
      data-module-sync-id="${escapeHtml(module.syncId)}"
      data-module-type="${escapeHtml(module.type)}"
    >
      ${tabs.length ? `
        <div data-sorter-tab-list>
          ${tabs.map((tab) => `
            <div
              data-sorter-tab-row
              data-tab-id="${escapeHtml(String(tab.id))}"
              data-tab-sync-id="${escapeHtml(tab.syncId)}"
              data-module-id="${escapeHtml(String(module.id))}"
              data-module-sync-id="${escapeHtml(module.syncId)}"
              data-module-type="${escapeHtml(module.type)}"
            >
              <button
                type="button"
                draggable="${tabSortActive ? 'true' : 'false'}"
                data-sorter-tab-drag-handle
                ${contentSortActive ? 'disabled' : ''}
                data-tab-id="${escapeHtml(String(tab.id))}"
                data-tab-sync-id="${escapeHtml(tab.syncId)}"
                data-module-id="${escapeHtml(String(module.id))}"
                data-module-sync-id="${escapeHtml(module.syncId)}"
                data-module-type="${escapeHtml(module.type)}"
                title="${escapeHtml(t('sorter.dragTab'))}"
                aria-label="${escapeHtml(t('sorter.dragTab'))}"
              >${SPEEDTAB_SVG.dashboard}</button>
              <span data-sorter-tab-title>${escapeHtml(tab.title || t('moduleCard.newTabTitle'))}</span>
              <div data-sorter-row-actions>
                <button
                  type="button"
                  data-click="sorterOpenItemEditor"
                  data-sorter-kind="tab"
                  data-sorter-module-type="${escapeHtml(module.type)}"
                  data-sorter-target-id="${escapeHtml(String(tab.id))}"
                  data-sorter-parent-id="${escapeHtml(String(module.id))}"
                  data-sorter-title="${escapeHtml(tab.title || '')}"
                  title="${escapeHtml(t('sorter.editItem'))}"
                  aria-label="${escapeHtml(t('sorter.editItem'))}"
                >${SPEEDTAB_SVG.pencil}</button>
                <button
                  type="button"
                  data-click="sorterDeleteItem"
                  data-sorter-kind="tab"
                  data-sorter-module-type="${escapeHtml(module.type)}"
                  data-sorter-target-id="${escapeHtml(String(tab.id))}"
                  data-sorter-parent-id="${escapeHtml(String(module.id))}"
                  data-sorter-title="${escapeHtml(tab.title || '')}"
                  title="${escapeHtml(t('sorter.deleteItem'))}"
                  aria-label="${escapeHtml(t('sorter.deleteItem'))}"
                >${SPEEDTAB_SVG.x}</button>
              </div>
              ${editor?.kind === 'tab' && editor?.targetId === tab.id ? `
                <div data-sorter-inline-editor>
                  <input
                    type="text"
                    value="${escapeHtml(editor.title || tab.title || '')}"
                    data-input="sorterEditorInput"
                    data-sorter-editor-input
                    autocomplete="off"
                  >
                  <div data-sorter-inline-editor-actions>
                    <button type="button" data-click="sorterSaveItemEditor" data-btn="danger">${escapeHtml(t('common.save'))}</button>
                    <button type="button" data-click="sorterCancelItemEditor" data-btn="ghost">${escapeHtml(t('common.cancel'))}</button>
                  </div>
                </div>
              ` : ''}
              ${contentSortActive ? `
                <div data-sorter-tab-content-panel>
                  ${renderContentRows(module, tab, contentsByTabSyncId.get(tab.syncId) ?? [], contentSortActive, editor)}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      ` : `
        <div data-sorter-tabs-empty>${escapeHtml(tabSortActive ? t('sorter.dropTabHere') : t('sorter.noTabs'))}</div>
      `}
    </div>
  `
}

function renderModuleCard(module, options = {}) {
  const {
    expanded = false,
    tabSortActive = false,
    tabSortEnabled = false,
    tabSortDisabled = false,
    contentSortActive = false,
    contentSortEnabled = false,
    contentSortDisabled = false,
    contentsByTabSyncId = new Map(),
  } = options
  const structureSortActive = tabSortActive || contentSortActive
  const tabCountLabel = t('sorter.tabsCount', {count: module.tabs.length})
  return `
    <article
      data-sorter-module-card
      data-module-id="${escapeHtml(String(module.id))}"
      data-module-sync-id="${escapeHtml(module.syncId)}"
      data-module-type="${escapeHtml(module.type)}"
      ${tabSortActive ? 'data-tab-sort-mode=""' : ''}
      ${tabSortEnabled ? 'data-tab-sort-enabled=""' : ''}
      ${tabSortDisabled ? 'data-tab-sort-disabled=""' : ''}
      ${contentSortActive ? 'data-content-sort-mode=""' : ''}
      ${contentSortEnabled ? 'data-content-sort-enabled=""' : ''}
      ${contentSortDisabled ? 'data-content-sort-disabled=""' : ''}
    >
      <header data-sorter-module-header>
        <button
          type="button"
          draggable="${structureSortActive ? 'false' : 'true'}"
          data-sorter-drag-handle
          ${structureSortActive ? 'disabled' : ''}
          data-module-id="${escapeHtml(String(module.id))}"
          data-module-sync-id="${escapeHtml(module.syncId)}"
          title="${escapeHtml(t('sorter.dragModule'))}"
          aria-label="${escapeHtml(t('sorter.dragModule'))}"
        >${SPEEDTAB_SVG.dashboard}</button>
        <input
          type="text"
          name="module-title"
          value="${escapeHtml(module.title || t('sorter.untitled'))}"
          data-change="sorterModuleTitleChange"
          data-module-id="${escapeHtml(String(module.id))}"
          data-module-sync-id="${escapeHtml(module.syncId)}"
          ${structureSortActive ? 'disabled' : ''}
          autocomplete="off"
        >
        <span data-sorter-module-type>${escapeHtml(t(`app.moduleTypes.${module.type}`))}</span>
      </header>

      <div data-sorter-module-meta>
        <label data-sorter-inline-field>
          <span>${escapeHtml(t('sorter.width'))}</span>
          <select
            name="module-column-span"
            data-change="sorterModuleSpanChange"
            data-module-id="${escapeHtml(String(module.id))}"
            data-module-sync-id="${escapeHtml(module.syncId)}"
            data-module-type="${escapeHtml(module.type)}"
            ${structureSortActive ? 'disabled' : ''}
          >${renderModuleSpanOptions(module.columnSpan)}</select>
        </label>

        <div data-sorter-module-actions>
          <button
            type="button"
            data-click="sorterToggleTabs"
            data-module-sync-id="${escapeHtml(module.syncId)}"
            data-module-type="${escapeHtml(module.type)}"
            data-sorter-toggle-tabs
            ${contentSortActive && !contentSortEnabled ? 'disabled' : ''}
            aria-expanded="${expanded ? 'true' : 'false'}"
          >${escapeHtml(tabCountLabel)} ${SPEEDTAB_SVG.chevron}</button>
          <button
            type="button"
            data-click="sorterToggleContents"
            data-module-sync-id="${escapeHtml(module.syncId)}"
            data-module-type="${escapeHtml(module.type)}"
            data-sorter-toggle-contents
            ${tabSortActive && !tabSortEnabled ? 'disabled' : ''}
            aria-expanded="${expanded ? 'true' : 'false'}"
          >${escapeHtml(t('sorter.contents'))} ${SPEEDTAB_SVG.chevron}</button>
        </div>
      </div>

      ${expanded ? `<section data-sorter-module-tabs data-tab-sort-active="${tabSortEnabled ? 'true' : 'false'}" data-content-sort-active="${contentSortEnabled ? 'true' : 'false'}">${renderTabRows(module, module.tabs, {
        tabSortActive: tabSortEnabled,
        contentSortActive: contentSortEnabled,
        contentsByTabSyncId,
        editor: options.editor,
      })}</section>` : ''}
    </article>
  `
}

function renderGridSlot({pageSyncId, module = null, orphan = null, expandedModules, tabSort, contentSort, editor = null}) {
  const slotId = module?.syncId ? `slot:${pageSyncId}:${module.syncId}` : orphan?.id
  const span = module?.columnSpan ?? orphan?.columnSpan ?? 12
  const tabSortActive = !!tabSort?.moduleType
  const tabSortEnabled = !!module && tabSortActive && module.type === tabSort.moduleType
  const tabSortDisabled = !!module && tabSortActive && module.type !== tabSort.moduleType
  const contentSortActive = !!contentSort?.moduleType
  const contentSortEnabled = !!module && contentSortActive && module.type === contentSort.moduleType
  const contentSortDisabled = !!module && contentSortActive && module.type !== contentSort.moduleType
  const expanded = !!module && expandedModules.has(module.syncId)

  return `
    <div
      data-grid-col
      id="${escapeHtml(`sorter-slot-${String(slotId ?? '').replace(/[^a-z0-9:_-]+/gi, '-')}`)}"
      data-page-sync-id="${escapeHtml(pageSyncId)}"
      data-slot-id="${escapeHtml(slotId ?? '')}"
      data-slot-kind="${escapeHtml(module ? 'module' : 'orphan')}"
      ${module ? `data-module-sync-id="${escapeHtml(module.syncId)}"` : ''}
      data-column-span="${escapeHtml(String(span))}"
      style="--st-grid-col-span:${escapeHtml(String(span))};"
    >
      ${module
        ? renderModuleCard(module, {
            expanded,
            tabSortActive,
            tabSortEnabled,
            tabSortDisabled,
            contentSortActive,
            contentSortEnabled,
            contentSortDisabled,
            contentsByTabSyncId: contentSort?.contentsByTabSyncId ?? new Map(),
            editor,
          })
        : `<div data-sorter-orphan-slot>
            <span data-sorter-orphan-label>${escapeHtml(t('sorter.emptySlot'))}</span>
          </div>`}
    </div>
  `
}

function renderPageSection(page, expandedModules, collapsedPages, orphanSlots = [], tabSort = null, contentSort = null, editor = null) {
  const slots = [
    ...page.modules.map((module) => ({module})),
    ...orphanSlots.map((orphan) => ({orphan})),
  ]
  const hasOrphans = orphanSlots.length > 0
  const collapsed = collapsedPages?.has?.(page.syncId) === true

  return `
    <section data-sorter-page data-page-id="${escapeHtml(String(page.id))}" data-page-sync-id="${escapeHtml(page.syncId)}">
      <header data-sorter-page-header>
        <div>
          <div data-sorter-page-title-row>
            <button
              type="button"
              draggable="true"
              data-sorter-page-drag-handle
              data-page-id="${escapeHtml(String(page.id))}"
              data-page-sync-id="${escapeHtml(page.syncId)}"
              title="${escapeHtml(t('sorter.dragPage'))}"
              aria-label="${escapeHtml(t('sorter.dragPage'))}"
            >${SPEEDTAB_SVG.dashboard}</button>
            <h2 data-sorter-page-title>${escapeHtml(page.title)}</h2>
          </div>
          <p data-sorter-page-meta>${escapeHtml(page.modules.length === 1 ? t('sorter.modulesCountOne') : t('sorter.modulesCount', {count: page.modules.length}))}</p>
        </div>
        <div data-sorter-page-actions>
          <button
            type="button"
            data-click="sorterTogglePageContent"
            data-page-sync-id="${escapeHtml(page.syncId)}"
            data-sorter-toggle-page-content
            aria-expanded="${collapsed ? 'false' : 'true'}"
            title="${escapeHtml(collapsed ? t('sorter.showPageContent') : t('sorter.hidePageContent'))}"
          >${escapeHtml(collapsed ? t('sorter.showContent') : t('sorter.hideContent'))} ${SPEEDTAB_SVG.chevron}</button>
          ${hasOrphans ? `<button type="button" data-click="sorterResetPageSlots" data-page-sync-id="${escapeHtml(page.syncId)}" data-sorter-reset-slots>${escapeHtml(t('sorter.resetSlots'))}</button>` : ''}
          <span data-sorter-page-badge>${escapeHtml(page.navGroup)}</span>
        </div>
      </header>

      <div data-sorter-module-lane data-page-sync-id="${escapeHtml(page.syncId)}"${collapsed ? ' hidden' : ''}>
        ${slots.length
          ? slots.map(({module, orphan}) => renderGridSlot({pageSyncId: page.syncId, module, orphan, expandedModules, tabSort, contentSort, editor})).join('')
          : `<div data-sorter-empty-page>${escapeHtml(t('sorter.emptyPage'))}</div>`}
      </div>
    </section>
  `
}

export function renderSorterApp(state) {
  return `
    <div data-sorter-app>
      <header data-sorter-app-header>
        <div>
          <p data-sorter-eyebrow>${escapeHtml(t('nav.pages'))}</p>
          <h1 data-sorter-app-title>${escapeHtml(t('sorter.title'))}</h1>
        </div>
        <div data-sorter-app-actions>
          <button type="button" data-click="sorterReload" data-sorter-link data-btn="ghost">${escapeHtml(t('sorter.reload'))}</button>
          <a href="./newtab.html" data-sorter-link data-btn="dark">${escapeHtml(t('sorter.backToSpeedtab'))}</a>
        </div>
      </header>

      ${region('status', `<p data-sorter-status data-tone="${escapeHtml(state.status.tone || 'idle')}">${escapeHtml(state.status.text || t('sorter.ready'))}</p>`)}

      ${region('pages', `
      <main data-sorter-pages>
        ${state.pages.map((page) => renderPageSection(page, state.expandedModules, state.collapsedPages, state.orphanSlotsByPage.get(page.syncId) ?? [], state.tabSort, state.contentSort, state.editor)).join('')}
      </main>
      `)}
    </div>
  `
}
