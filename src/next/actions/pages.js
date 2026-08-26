import {closeModal, openModal} from '../components/modal.js'
import {closeSidepanel, onSidepanelClose, openSidepanel} from '../components/sidepanel.js'
import {db} from '../../db/db.ts'
import {cleanupOrphans, deleteCollectionTree, deleteModuleTree, deletePageTree} from '../../composables/useMaintenance.ts'
import {
  archiveBgItem,
  deletePageBackgroundOverride,
  getCachedAppSettings,
  loadBgArchive,
  loadPageBackgroundOverride,
  savePageBackgroundOverride,
} from '../data/app-settings.js'
import {normalizeImageBlob, storeOrGetAsset} from '../data/assets.js'
import {createModuleData, loadModulesByPageId} from '../data/modules.js'
import {createPageData, loadPageBySyncId, savePageData} from '../data/pages.js'
import {createModuleTab} from '../data/tabs.js'
import {upsertUiConfig} from '../data/ui-config.js'
import {getModuleTypeMessageKey} from '../config/module-types.js'
import {renderSidepanelDeleteFooter} from '../features/forms/actions.js'
import {initFormDirtyState} from '../features/forms/actions.js'
import {
  renderModuleCreateForm,
  renderPageBgArchiveSwatches,
  renderPageBgAssetThumbs,
  renderPageForm,
  syncPageFormActiveHint,
} from '../features/pages/page-form.js'
import {closeColorPicker, initColorPicker, wrapColorPicker} from '../utils/color-picker.js'
import {patchInner} from '../utils/dom-patch.js'
import {escapeHtml} from '../utils/html.js'
import {t} from '../utils/i18n.js'
import {radioActive} from '../utils/radio-active.js'
import {
  addBgSet,
  applyPageWorkspaceBackground,
  getBgSet,
  isValidBackground,
  loadBackgroundAssetsForEditor,
  loadBackgroundEditorData,
  sanitizeBackgroundValue,
  syncBackgroundInputs,
} from '../utils/workspace-background.js'

const DEFAULT_PAGE_GRID_MAX_WIDTH = 1500
const MODULE_CREATE_MAX_TABS = 10

function getActivePageSyncId() {
  const activeBtn = document.querySelector('[data-controller] [data-tab-action="open"][aria-selected="true"]')
  const activeSlug = activeBtn?.dataset?.open
  if (!activeSlug) return null
  return document.querySelector(`[data-page-slug="${CSS.escape(activeSlug)}"]`)?.closest('[data-app-tab-shell]')?.dataset?.pageSyncId ?? null
}

function getOpenPageForm() {
  return document.querySelector('[data-sidepanel][data-sidepanel-open] [data-page-form]')
}

export function syncOpenPageEditorActiveHint(activePageSyncId = getActivePageSyncId()) {
  syncPageFormActiveHint(getOpenPageForm(), activePageSyncId)
}

async function openPageEditor(page) {
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
        'data-page-sync-id': pageSyncId,
      },
    }) : '',
  })
  onSidepanelClose(() => closeColorPicker())
  const body = panelEl.querySelector('[data-sidepanel-body]')
  if (!(body instanceof HTMLElement)) return

  let backgroundData = null
  if (page?.id && pageSyncId) {
    patchInner(body, `<p data-customizer-loading>${t('common.loading')}</p>`)
    const override = await loadPageBackgroundOverride(pageSyncId)
    backgroundData = await loadBackgroundEditorData(override ?? {})
  }

  if (body.isConnected) {
    patchInner(body, renderPageForm(page, {backgroundData}))
    initFormDirtyState(body)
    syncOpenPageEditorActiveHint()
    if (backgroundData) {
      await initColorPicker()
      wrapColorPicker(body)
    }
    requestAnimationFrame(() => {
      const input = body.querySelector('[name="page-title"]')
      input?.focus?.()
      input?.select?.()
    })
  }
}

function getPageBackgroundForm(target) {
  return target?.closest?.('[data-page-form]') ?? null
}

function getPageBackgroundSyncId(target) {
  return getPageBackgroundForm(target)?.dataset?.pageSyncId ?? ''
}

function getPageBackgroundTextInput(target) {
  return getPageBackgroundForm(target)?.querySelector('[data-bg-property-input]') ?? null
}

function syncPageBackgroundInputs(target, value, source = null) {
  const form = getPageBackgroundForm(target)
  if (form) syncBackgroundInputs(form, value, source)
}

async function applyPageBackgroundIfActive(pageSyncId, {immediate = false} = {}) {
  if (!pageSyncId || getActivePageSyncId() !== pageSyncId) return
  await applyPageWorkspaceBackground(pageSyncId, getCachedAppSettings(), {immediate})
}

async function refreshPageBackgroundAssets(target) {
  const list = getPageBackgroundForm(target)?.querySelector('[data-bg-asset-list]')
  if (!list) return
  patchInner(list, renderPageBgAssetThumbs(await loadBackgroundAssetsForEditor()))
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

function openCreateModuleModal(page, modules = []) {
  openModal({
    title: t('moduleForm.createModule'),
    content: renderModuleCreateForm(page, modules),
    panelClass: 'st-create-module-modal',
  })

  const body = document.querySelector('[data-modal][data-modal-open] [data-modal-body]')
  if (!body) return
  initFormDirtyState(body)
  const titleInput = body.querySelector('[name="module-title"]')
  titleInput?.focus?.()
  titleInput?.select?.()
  setTimeout(() => syncModulePlacementSpans(page), 0)
}

function syncModulePlacementSpans(page, attempt = 0) {
  const syncId = page?.sync_id ?? ''
  if (!syncId) return
  const shell = document.querySelector(`[data-app-tab-shell][data-page-sync-id="${CSS.escape(syncId)}"]`)
  if (!(shell instanceof HTMLElement)) return
  const spans = new Map()
  shell.querySelectorAll('[data-grid-col]').forEach((column) => {
    const card = column.querySelector('[data-module-card][data-sync-id]')
    const moduleSyncId = card?.dataset.syncId
    const span = Number.parseInt(column.style.getPropertyValue('--st-grid-col-span'), 10)
    if (moduleSyncId && Number.isInteger(span)) spans.set(moduleSyncId, span)
  })
  const fakeModules = document.querySelectorAll('[data-module-placement-module][data-module-placement-sync-id]')
  fakeModules.forEach((fake) => {
    const span = spans.get(fake.dataset.modulePlacementSyncId ?? '')
    if (Number.isInteger(span)) fake.style.setProperty('--st-module-placement-span', String(span - 1))
  })
  if (spans.size < fakeModules.length && attempt < 3) {
    setTimeout(() => syncModulePlacementSpans(page, attempt + 1), 50)
  }
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
    await openPageEditor(page)
  },

  async editActivePage() {
    const pageSyncId = getActivePageSyncId()
    if (!pageSyncId) return
    const page = await loadPageBySyncId(pageSyncId)
    if (!page) return
    await openPageEditor(page)
  },

  async addPage() {
    await openPageEditor(createDraftPage())
  },

  previewPageBgProperty(target) {
    const pageSyncId = getPageBackgroundSyncId(target)
    if (!pageSyncId) return
    const value = sanitizeBackgroundValue(target.value)
    syncPageBackgroundInputs(target, value, target)
    if (getActivePageSyncId() !== pageSyncId) return
    if (value && isValidBackground(value)) {
      addBgSet(value)
      return
    }
    void getBgSet(getCachedAppSettings()).then((background) => addBgSet(background))
  },

  async savePageBgProperty(target) {
    const pageSyncId = getPageBackgroundSyncId(target)
    if (!pageSyncId) return
    const value = sanitizeBackgroundValue(target.value)
    if (!isValidBackground(value)) return
    syncPageBackgroundInputs(target, value, target)
    await savePageBackgroundOverride(pageSyncId, value ? {
      background_properties: value,
      background_asset_id: null,
    } : null)
    await applyPageBackgroundIfActive(pageSyncId, {immediate: true})
  },

  async archivePageBgProperty(target) {
    const value = sanitizeBackgroundValue(getPageBackgroundTextInput(target)?.value)
    if (!value || !isValidBackground(value)) return
    await archiveBgItem(value)
    const list = getPageBackgroundForm(target)?.querySelector('[data-bg-archive-list]')
    if (list) patchInner(list, renderPageBgArchiveSwatches(await loadBgArchive()))
  },

  async clearPageBgProperty(target) {
    const pageSyncId = getPageBackgroundSyncId(target)
    if (!pageSyncId) return
    await deletePageBackgroundOverride(pageSyncId)
    syncPageBackgroundInputs(target, '')
    await applyPageBackgroundIfActive(pageSyncId)
  },

  async loadPageBgArchiveItem(target) {
    const pageSyncId = getPageBackgroundSyncId(target)
    const value = target.closest('[data-click]')?.dataset?.bgValue ?? ''
    if (!pageSyncId || !value || !isValidBackground(value)) return
    await savePageBackgroundOverride(pageSyncId, {
      background_properties: value,
      background_asset_id: null,
    })
    syncPageBackgroundInputs(target, value)
    await applyPageBackgroundIfActive(pageSyncId)
  },

  triggerPageWallpaperUpload(target) {
    getPageBackgroundForm(target)?.querySelector('[name="uploadPageBgWallpaperInput"]')?.click()
  },

  async uploadPageBgWallpaper(target) {
    const pageSyncId = getPageBackgroundSyncId(target)
    const file = target.files?.[0]
    if (!pageSyncId || !file) return
    target.value = ''
    const {blob, width, height} = await normalizeImageBlob(file)
    const assetId = await storeOrGetAsset(blob, 'background', width, height)
    await savePageBackgroundOverride(pageSyncId, {
      background_properties: null,
      background_asset_id: assetId,
    })
    syncPageBackgroundInputs(target, '')
    await refreshPageBackgroundAssets(target)
    await applyPageBackgroundIfActive(pageSyncId)
  },

  async loadPageBgAsset(target) {
    const pageSyncId = getPageBackgroundSyncId(target)
    const assetId = Number(target.closest('[data-click]')?.dataset?.assetId)
    if (!pageSyncId || !assetId) return
    await savePageBackgroundOverride(pageSyncId, {
      background_properties: null,
      background_asset_id: assetId,
    })
    syncPageBackgroundInputs(target, '')
    await applyPageBackgroundIfActive(pageSyncId)
  },

  async addPageModule() {
    const pageSyncId = getActivePageSyncId()
    if (!pageSyncId) return
    const page = await loadPageBySyncId(pageSyncId)
    if (!page?.id) return
    const modules = await loadModulesByPageId(page.id)
    openCreateModuleModal(page, modules)
  },

  toggleModuleCreatePlacement(target) {
    const form = target.closest('[data-page-module-form]')
    const placement = form?.querySelector('[data-module-create-placement]')
    const panel = target.closest('[data-modal-panel]')
    if (!(placement instanceof HTMLElement) || !(panel instanceof HTMLElement)) return
    const expanded = placement.hidden
    placement.hidden = !expanded
    target.setAttribute('aria-expanded', String(expanded))
    panel.classList.toggle('st-create-module-modal-expanded', expanded)
  },

  pageModuleTypeChange(target) {
    const form = target.closest?.('[data-page-module-form]')
    if (!(form instanceof HTMLFormElement)) return
    form.dataset.moduleType = target.value || 'tabs'
  },

  addModuleCreateTabInput(target) {
    const form = target.closest?.('[data-page-module-form]')
    if (!(form instanceof HTMLFormElement)) return

    const inputsHost = form.querySelector('[data-page-module-tabs-inputs]')
    if (!(inputsHost instanceof HTMLElement)) return

    const existingRows = inputsHost.querySelectorAll('[data-page-module-tab-row]')
    if (existingRows.length >= MODULE_CREATE_MAX_TABS) {
      target.setAttribute('disabled', '')
      return
    }

    const row = document.createElement('div')
    row.setAttribute('data-page-module-tab-row', '')
    row.innerHTML = `
      <input
        type="text"
        name="module-first-tab-title"
        value=""
        autocomplete="off"
      >
    `
    inputsHost.append(row)

    if (existingRows.length + 1 >= MODULE_CREATE_MAX_TABS) {
      target.setAttribute('disabled', '')
    }

    const input = row.querySelector('input')
    input?.focus?.()
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
    await openPageEditor(savedPage)
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
    const title = rawTitle || (type === 'todo' ? t('todo.moduleType') : t(`moduleForm.types.${getModuleTypeMessageKey(type)}`))
    const tabTitles = Array.from(form.querySelectorAll('[name="module-first-tab-title"]'))
      .map((input) => input instanceof HTMLInputElement ? input.value.trim() : '')
      .filter(Boolean)
      .slice(0, MODULE_CREATE_MAX_TABS)
    const firstTabTitle = tabTitles[0] || t('moduleCard.newTabTitle')
    const rawColumnSpan = parseInt(form.querySelector('[name="module-column-span"]')?.value ?? '', 10)
    const columnSpan = type === 'speed-dial'
      ? 12
      : Math.max(1, Math.min(12, Number.isInteger(rawColumnSpan) ? rawColumnSpan : 6))
    const rawInsertAt = parseInt(form.querySelector('[name="module-insert-at"]:checked')?.value ?? '', 10)
    const insertAt = Number.isInteger(rawInsertAt) ? rawInsertAt : undefined

    const module = await createModuleData(pageId, {
      type,
      title,
      insertAt,
      defaultTabTitle: firstTabTitle,
      createDefaultTab: true,
      config_json: JSON.stringify({
        layout: type === 'speed-dial'
          ? {}
          : {'module-column-span': columnSpan},
      }),
    })
    if (!module?.sync_id) return

    if (type !== 'speed-dial' && columnSpan !== 6) {
      await upsertUiConfig({
        entityType: 'module',
        entitySubtype: type,
        entitySyncId: module.sync_id,
        patch: {
          layout: {
            'module-column-span': columnSpan,
          },
        },
      })
    }

    if (module.id && tabTitles.length > 1) {
      for (const extraTitle of tabTitles.slice(1)) {
        await createModuleTab(module.id, {title: extraTitle})
      }
    }

    closeModal()
    const {refreshPageContent} = await import('../app/bootstrap.js')
    await refreshPageContent({pageId})

    const moduleCard = document.querySelector(`[data-module-card][data-sync-id="${CSS.escape(module.sync_id)}"]`)
    moduleCard?.querySelector('[data-click="openCustomizer"]')?.click()
  },

  async pageFormDelete(target) {
    const pageId = parseInt(target.dataset.pageId)
    if (!pageId) return
    if (!confirm(t('app.confirms.deletePage'))) return
    await deletePageTree(pageId)
    await deletePageBackgroundOverride(target.dataset.pageSyncId ?? '')
    closeSidepanel()

    const pageSlug = target.dataset.pageSlug
    if (pageSlug) {
      document.querySelector(`[data-tab-action="open"][data-open="${CSS.escape(pageSlug)}"]`)?.remove()
      document.querySelector(`[data-tab="${CSS.escape(pageSlug)}"]`)?.remove()
    }
  },
}
