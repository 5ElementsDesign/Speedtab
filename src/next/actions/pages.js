import {closeModal, openModal} from '../components/modal.js'
import {closeSidepanel, openSidepanel} from '../components/sidepanel.js'
import {db} from '../../db/db.ts'
import {cleanupOrphans, deleteCollectionTree, deleteModuleTree} from '../../composables/useMaintenance.ts'
import {createModuleData} from '../data/modules.js'
import {createPageData, loadPageBySyncId, savePageData, softDeletePage} from '../data/pages.js'
import {renderSidepanelDeleteFooter} from '../features/forms/actions.js'
import {initFormDirtyState} from '../features/forms/actions.js'
import {renderModuleCreateForm, renderPageForm} from '../features/pages/page-form.js'
import {escapeHtml} from '../utils/html.js'
import {t} from '../utils/i18n.js'
import {radioActive} from '../utils/radio-active.js'

const DEFAULT_PAGE_GRID_MAX_WIDTH = 1500

function getActivePageSyncId() {
  const activeBtn = document.querySelector('[data-controller] [data-tab-action="open"][aria-selected="true"]')
  const activeSlug = activeBtn?.dataset?.open
  if (!activeSlug) return null
  return document.querySelector(`[data-page-slug="${CSS.escape(activeSlug)}"]`)?.closest('[data-app-tab-shell]')?.dataset?.pageSyncId ?? null
}

function openPageEditor(page) {
  const pageSyncId = page?.sync_id ?? ''
  const panelEl = openSidepanel({
    title: page?.title || t('app.newPageTitle'),
    meta: t('nav.page'),
    syncId: pageSyncId,
    moduleType: 'page',
    showBack: true,
    backAction: 'openCustomizerList',
    footer: page?.id ? renderSidepanelDeleteFooter({
      action: 'pageFormDelete',
      label: t('pageForm.deletePage'),
      attrs: {
        'data-page-id': page.id,
        'data-page-slug': page.slug ?? '',
      },
    }) : '',
  })
  const body = panelEl.querySelector('[data-sidepanel-body]')
  if (body) {
    body.innerHTML = renderPageForm(page)
    initFormDirtyState(body)
    requestAnimationFrame(() => {
      const input = body.querySelector('[name="page-title"]')
      input?.focus?.()
      input?.select?.()
    })
  }
}

function createDraftPage() {
  return {
    title: t('app.newPageTitle'),
    nav_group: 'main',
    icon: null,
    is_home: 0,
    config_json: JSON.stringify({modulesPerRow: 12, maxWidth: null}),
  }
}

function openCreateModuleModal(page) {
  openModal({
    title: t('moduleForm.createModule'),
    content: renderModuleCreateForm(page),
  })

  const body = document.querySelector('[data-modal][data-modal-open] [data-modal-body]')
  if (!body) return
  initFormDirtyState(body)
  const titleInput = body.querySelector('[name="module-title"]')
  titleInput?.focus?.()
  titleInput?.select?.()
}

function getCurrentRestoreUrl() {
  return window.location.href
}

function renderCopyUrlModal(url) {
  return `
    <div data-copy-url-modal>
      <label for="st-copy-url-input" data-copy-url-description>${escapeHtml(t('app.copyUrlDescription'))}</label>
      <input
        type="text"
        id="st-copy-url-input"
        name="copy-url"
        value="${escapeHtml(url)}"
        readonly
        spellcheck="false"
        autocomplete="off"
        data-copy-url-input
      >
      <div data-copy-url-actions>
        <div data-copy-url-actions-left>
          <button type="button" class="st-btn" data-click="openCopiedUrlInNewTab">${escapeHtml(t('app.openInNewTab'))}</button>
        </div>
        <div data-copy-url-actions-right>
          <button type="button" class="st-btn" data-modal-close>${escapeHtml(t('common.close'))}</button>
          <button type="button" class="st-btn" data-click="copyCurrentRestoreUrl">${escapeHtml(t('common.copy'))}</button>
        </div>
      </div>
    </div>
  `
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return true
  }

  const input = document.querySelector('[data-copy-url-input]')
  if (!(input instanceof HTMLInputElement)) return false
  input.focus()
  input.select()
  input.setSelectionRange(0, input.value.length)
  return document.execCommand('copy')
}

function restorePageAfterOrphanCleanup() {
  const orphanTrigger = document.querySelector('[data-controller] [data-open="orphans-detected"]')
  if (orphanTrigger instanceof HTMLButtonElement) {
    orphanTrigger.click()
    return
  }

  const fallbackTrigger = document.querySelector('[data-controller] [data-tab-action="open"][data-default]')
    ?? document.querySelector('[data-controller] [data-tab-action="open"]')

  if (!(fallbackTrigger instanceof HTMLButtonElement)) return

  const slug = fallbackTrigger.dataset.open?.trim()
  if (!slug) return

  const params = new URLSearchParams(window.location.hash.slice(1))
  params.set('pages', slug)
  history.replaceState(null, '', `#${params.toString()}`)
}

export const pageActions = {
  async openPageForm(target) {
    const pageSyncId = target.dataset.pageSyncId
    if (!pageSyncId) return
    const page = await loadPageBySyncId(pageSyncId)
    if (!page) return
    openPageEditor(page)
  },

  async editActivePage() {
    const pageSyncId = getActivePageSyncId()
    if (!pageSyncId) return
    const page = await loadPageBySyncId(pageSyncId)
    if (!page) return
    openPageEditor(page)
  },

  async addPage() {
    openPageEditor(createDraftPage())
  },

  async addPageModule() {
    const pageSyncId = getActivePageSyncId()
    if (!pageSyncId) return
    const page = await loadPageBySyncId(pageSyncId)
    if (!page?.id) return
    openCreateModuleModal(page)
  },

  openSorter() {
    const sorterUrl = typeof chrome?.runtime?.getURL === 'function'
      ? chrome.runtime.getURL('src/sorter.html')
      : './sorter.html'
    window.location.href = sorterUrl
  },

  async deleteAllOrphansShown() {
    if (!confirm(t('maintenance.deleteAllOrphansConfirm'))) return
    await cleanupOrphans()
    const {renderNextRoot} = await import('../app/bootstrap.js')
    await renderNextRoot()
    restorePageAfterOrphanCleanup()
  },

  async deleteOrphanRow(target) {
    const id = parseInt(target.dataset.orphanId ?? '', 10)
    const kind = target.dataset.orphanKind
    if (!id || !kind) return

    if (!confirm(t('maintenance.deleteOrphanConfirm'))) return

    if (kind === 'module') {
      await deleteModuleTree(id)
    } else if (kind === 'collection') {
      await deleteCollectionTree(id)
    } else if (kind === 'tab') {
      await db.tabs.delete(id)
    } else if (kind === 'note') {
      await db.notes.delete(id)
    } else if (kind === 'feed_source') {
      const feedItemIds = await db.feed_items.where('feed_source_id').equals(id).primaryKeys()
      if (feedItemIds.length) await db.feed_items.bulkDelete(feedItemIds)
      await db.feed_sources.delete(id)
    } else if (kind === 'feed_item') {
      await db.feed_items.delete(id)
    } else if (kind === 'saved_feed_item') {
      await db.saved_feed_items.delete(id)
    } else {
      return
    }

    const {renderNextRoot} = await import('../app/bootstrap.js')
    await renderNextRoot()
    restorePageAfterOrphanCleanup()
  },

  copyPageUrl() {
    const url = getCurrentRestoreUrl()
    openModal({
      title: t('app.copyUrlTitle'),
      content: renderCopyUrlModal(url),
    })

    requestAnimationFrame(() => {
      const input = document.querySelector('[data-copy-url-input]')
      if (!(input instanceof HTMLInputElement)) return
      input.focus()
      input.select()
      input.setSelectionRange(0, input.value.length)
    })
  },

  openCopiedUrlInNewTab() {
    const input = document.querySelector('[data-copy-url-input]')
    const url = input instanceof HTMLInputElement ? input.value.trim() : ''
    if (!url) return
    window.open(url, '_blank', 'noopener,noreferrer')
  },

  async copyCurrentRestoreUrl() {
    const input = document.querySelector('[data-copy-url-input]')
    const url = input instanceof HTMLInputElement ? input.value.trim() : ''
    if (!url) return
    const copied = await copyText(url)
    if (copied) closeModal()
  },

  pageFormToggleIconPicker(target) {
    const picker = target.closest('[data-customizer-section]')?.querySelector('[data-icon-picker]')
    if (picker) picker.toggleAttribute('hidden')
  },

  pageFormPickIcon(target) {
    const icon = target.dataset.icon
    if (!icon) return
    const form = target.closest('[data-page-form]')
    const input = form?.querySelector('[data-page-icon-input]')
    if (input instanceof HTMLInputElement) {
      radioActive(input, {
        eventType: 'change',
        value: icon,
        detail: {source: 'page-icon-picker'},
      })
    }
    target.closest('[data-icon-picker]')?.setAttribute('hidden', '')
  },

  async pageFormSave(target) {
    const form = target?.matches?.('[data-page-form]')
      ? target
      : target?.closest?.('[data-page-form]')
    if (!form) return
    const pageId = parseInt(form.dataset.pageId)
    const pageSlug = form.dataset.pageSlug

    const title = form.querySelector('[name="page-title"]')?.value?.trim()
    if (!title) return

    const icon = form.querySelector('[name="page-icon"]')?.value?.trim() || null
    const navGroup = form.querySelector('[name="page-nav-group"]')?.value || 'main'
    const isHome = form.querySelector('[name="page-is-home"]')?.checked ? 1 : 0
    const modulesPerRow = Math.max(1, Math.min(12, parseInt(form.querySelector('[name="page-modules-per-row"]')?.value) || 2))
    const maxWidthRaw = parseInt(form.querySelector('[name="page-max-width"]')?.value)
    const maxWidth = Number.isInteger(maxWidthRaw) && maxWidthRaw >= 300 ? Math.min(3840, maxWidthRaw) : null
    const normalizedMaxWidth = maxWidth === DEFAULT_PAGE_GRID_MAX_WIDTH ? null : maxWidth

    let savedPage = null
    if (pageId) {
      await savePageData(pageId, {
        title,
        icon,
        nav_group: navGroup,
        is_home: isHome,
        config_json: JSON.stringify({modulesPerRow, maxWidth: normalizedMaxWidth}),
      })
      savedPage = form.dataset.pageSyncId ? await loadPageBySyncId(form.dataset.pageSyncId) : null
    } else {
      savedPage = await createPageData({
        title,
        icon,
        nav_group: navGroup,
        is_home: isHome,
        config_json: JSON.stringify({modulesPerRow, maxWidth: normalizedMaxWidth}),
      })
    }
    const {renderNextRoot} = await import('../app/bootstrap.js')
    await renderNextRoot()
    if (!savedPage) return
    openPageEditor(savedPage)
  },

  async pageModuleCreateSave(target) {
    const form = target?.matches?.('[data-page-module-form]')
      ? target
      : target?.closest?.('[data-page-module-form]')
    if (!(form instanceof HTMLFormElement)) return
    if (typeof form.reportValidity === 'function' && !form.reportValidity()) return

    const pageId = parseInt(form.dataset.pageId ?? '', 10)
    if (!pageId) return

    const type = form.querySelector('[name="module-type"]')?.value || 'tabs'
    const rawTitle = form.querySelector('[name="module-title"]')?.value?.trim()
    const title = rawTitle || t(`moduleForm.types.${type}`)

    const module = await createModuleData(pageId, {
      type,
      title,
      defaultTabTitle: t('moduleCard.newTabTitle'),
      createDefaultTab: true,
    })
    if (!module?.sync_id) return

    closeModal()
    const {renderNextRoot} = await import('../app/bootstrap.js')
    await renderNextRoot()

    const moduleCard = document.querySelector(`[data-module-card][data-sync-id="${CSS.escape(module.sync_id)}"]`)
    moduleCard?.querySelector('[data-click="openCustomizer"]')?.click()
  },

  async pageFormDelete(target) {
    const pageId = parseInt(target.dataset.pageId)
    if (!pageId) return
    if (!confirm(t('app.confirms.deletePage'))) return
    await softDeletePage(pageId)
    closeSidepanel()

    const pageSlug = target.dataset.pageSlug
    if (pageSlug) {
      document.querySelector(`[data-tab-action="open"][data-open="${CSS.escape(pageSlug)}"]`)?.remove()
      document.querySelector(`[data-tab="${CSS.escape(pageSlug)}"]`)?.remove()
    }
  },
}
