import {YEH} from '../lib/yai/yeh.js'
import {SPEEDTAB_SVG} from '../next/components/icons.js'
import '../next/styles/foundation.css'
import {escapeHtml} from '../next/utils/html.js'
import {loadAndApplyDocumentTheme} from '../next/utils/document-theme.js'
import {initI18n, t} from '../next/utils/i18n.js'
import {applyWorkspaceBackground} from '../next/utils/workspace-background.js'
import {buildSorterState, loadModuleContentsForSorter, moveCollectionContent, moveModule, moveModuleTab, movePage, softDeleteCollectionContent, softDeleteModuleTabCascade, updateCollectionContentTitle, updateModuleColumnSpan, updateModuleTabTitle, updateModuleTitle} from './data.js'
import {initSorterDnd} from './dnd.js'
import {renderSorterApp} from './render.js'
import {
  appendOrphanSlot,
  clearContentSort,
  clearDragState,
  clearPageOrphanSlots,
  clearTabSort,
  closeSorterEditor,
  createSorterState,
  isContentSortActive,
  isTabSortActive,
  openSorterEditor,
  removeOrphanSlot,
  setContentSortContents,
  setSorterPages,
  setSorterStatus,
  toggleCollapsedPage,
  toggleContentSort,
  toggleExpandedModule,
  toggleTabSort,
} from './state.js'
import './styles.css'

const state = createSorterState()

function getMount() {
  return document.querySelector('#app')
}

function getSorterEventRoot() {
  return document.querySelector('#app')
}

function patchSorterRegions(mount, html, regionNames = null) {
  const template = document.createElement('template')
  template.innerHTML = html.trim()

  const nextApp = template.content.querySelector('[data-sorter-app]')
  const currentApp = mount.querySelector('[data-sorter-app]')
  if (!(nextApp instanceof HTMLElement) || !(currentApp instanceof HTMLElement)) {
    mount.innerHTML = html
    return
  }

  const nextRegions = new Map(
    Array.from(nextApp.querySelectorAll('[data-sorter-region]')).map((node) => [node.getAttribute('data-sorter-region'), node]),
  )

  const allowedRegions = Array.isArray(regionNames) && regionNames.length
    ? new Set(regionNames)
    : null

  const currentRegions = Array.from(currentApp.querySelectorAll('[data-sorter-region]'))
  for (const currentRegion of currentRegions) {
    const regionName = currentRegion.getAttribute('data-sorter-region')
    if (allowedRegions && (!regionName || !allowedRegions.has(regionName))) continue
    const nextRegion = nextRegions.get(regionName)
    if (!regionName || !nextRegion) continue
    currentRegion.replaceWith(nextRegion.cloneNode(true))
  }
}

function findModule(moduleSyncId) {
  for (const page of state.pages) {
    const module = page.modules.find((entry) => entry.syncId === moduleSyncId)
    if (module) return module
  }
  return null
}

function findTab(tabSyncId) {
  for (const page of state.pages) {
    for (const module of page.modules) {
      const tab = module.tabs.find((entry) => entry.syncId === tabSyncId)
      if (tab) {
        return {
          page,
          module,
          tab,
        }
      }
    }
  }
  return null
}

function createModuleSpanSnapshot(pages = []) {
  const snapshot = new Map()

  pages.forEach((page) => {
    page.modules?.forEach((module) => {
      if (!module?.syncId) return
      snapshot.set(module.syncId, module.columnSpan)
    })
  })

  return snapshot
}

function applyModuleSpanSnapshot(pages = [], snapshot = new Map()) {
  pages.forEach((page) => {
    page.modules?.forEach((module) => {
      if (!module?.syncId) return
      if (!snapshot.has(module.syncId)) return
      module.columnSpan = snapshot.get(module.syncId)
    })
  })

  return pages
}

function getCollectionsForModuleType(moduleType) {
  const collections = []

  state.pages.forEach((page) => {
    page.modules?.forEach((module) => {
      if (module.type !== moduleType) return
      module.tabs?.forEach((tab) => {
        collections.push(tab)
      })
    })
  })

  return collections
}

async function refreshContentSortContents(moduleType = state.contentSort.moduleType) {
  if (!moduleType) {
    setContentSortContents(state, new Map())
    return
  }

  const collections = getCollectionsForModuleType(moduleType)
  const contentsByTabSyncId = await loadModuleContentsForSorter(moduleType, collections)
  setContentSortContents(state, contentsByTabSyncId)
}

function render(regions = ['status', 'pages']) {
  const mount = getMount()
  if (!mount) return
  const scrollTop = document.scrollingElement?.scrollTop ?? 0
  const html = renderSorterApp(state)
  if (mount.querySelector('[data-sorter-app]')) {
    patchSorterRegions(mount, html, regions)
  } else {
    mount.innerHTML = html
  }
  document.scrollingElement?.scrollTo({top: scrollTop})
}

function renderStatus() {
  render(['status'])
}

function renderPages() {
  render(['pages'])
}

function renderStatusAndPages() {
  render(['status', 'pages'])
}

async function applyPageBackground() {
  const mount = getMount()
  if (!(mount instanceof HTMLElement)) return
  await applyWorkspaceBackground(mount)
}

function setExpandedModules(moduleSyncIds = []) {
  state.expandedModules = new Set(moduleSyncIds.filter(Boolean))
}

function applyPageCollapseDom(pageSyncId) {
  if (!pageSyncId) return
  const pageEl = document.querySelector(`[data-sorter-page][data-page-sync-id="${CSS.escape(pageSyncId)}"]`)
  if (!(pageEl instanceof HTMLElement)) return

  const collapsed = state.collapsedPages.has(pageSyncId)
  const lane = pageEl.querySelector('[data-sorter-module-lane]')
  if (lane instanceof HTMLElement) {
    if (collapsed) {
      lane.setAttribute('hidden', '')
      lane.style.display = 'none'
    } else {
      lane.removeAttribute('hidden')
      lane.style.display = ''
    }
  }

  const button = pageEl.querySelector('[data-sorter-toggle-page-content]')
  if (button instanceof HTMLButtonElement) {
    button.setAttribute('aria-expanded', collapsed ? 'false' : 'true')
    button.title = collapsed ? t('sorter.showPageContent') : t('sorter.hidePageContent')
    button.replaceChildren(document.createTextNode(`${collapsed ? t('sorter.showContent') : t('sorter.hideContent')} `))
    button.insertAdjacentHTML('beforeend', SPEEDTAB_SVG.chevron)
  }
}

async function refreshState() {
  setSorterPages(state, await buildSorterState())
}

async function boot() {
  await loadAndApplyDocumentTheme()
  await initI18n()
  await refreshState()
  setSorterStatus(state, t('sorter.ready'), 'idle')
  await applyPageBackground()
  renderStatusAndPages()

  const root = getSorterEventRoot()
  if (!root) return

  initSorterDnd({
    root,
    state,
    onDropPage: async ({pageSyncId, targetIndex}) => {
      const page = state.pages.find((entry) => entry.syncId === pageSyncId)
      if (!page || targetIndex < 0) return

      setSorterStatus(state, t('sorter.saving'), 'idle')
      renderStatus()

      try {
        await movePage(page.id, targetIndex)
        await refreshState()
        if (isContentSortActive(state)) {
          await refreshContentSortContents()
        }
        setSorterStatus(state, t('sorter.saved'), 'success')
      } catch (error) {
        await refreshState()
        if (isContentSortActive(state)) {
          await refreshContentSortContents()
        }
        setSorterStatus(state, error instanceof Error ? error.message : t('sorter.saveFailed'), 'error')
      } finally {
        clearDragState(state)
        renderStatusAndPages()
      }
    },
    onDropModule: async ({moduleSyncId, targetPageSyncId, targetIndex, targetSlotId, targetSlotKind}) => {
      const module = findModule(moduleSyncId)
      const sourcePageSyncId = state.drag.sourcePageSyncId
      const targetPage = state.pages.find((page) => page.syncId === targetPageSyncId)
      if (!module || !targetPage || targetIndex < 0) return
      const spanSnapshot = createModuleSpanSnapshot(state.pages)

      setSorterStatus(state, t('sorter.saving'), 'idle')
      renderStatus()

      try {
        await moveModule(module.id, targetPage.id, targetIndex)
        if (sourcePageSyncId && sourcePageSyncId !== targetPageSyncId) {
          appendOrphanSlot(state, sourcePageSyncId, module.columnSpan)
        }
        if (targetSlotKind === 'orphan' && targetPageSyncId && targetSlotId) {
          removeOrphanSlot(state, targetPageSyncId, targetSlotId)
        }
        await refreshState()
        applyModuleSpanSnapshot(state.pages, spanSnapshot)
        setSorterStatus(state, t('sorter.saved'), 'success')
      } catch (error) {
        await refreshState()
        applyModuleSpanSnapshot(state.pages, spanSnapshot)
        setSorterStatus(state, error instanceof Error ? error.message : t('sorter.saveFailed'), 'error')
      } finally {
        clearDragState(state)
        renderStatusAndPages()
      }
    },
    onDropTab: async ({tabSyncId, targetModuleId, targetIndex}) => {
      const found = findTab(tabSyncId)
      if (!found || !targetModuleId || targetIndex < 0) return
      const spanSnapshot = createModuleSpanSnapshot(state.pages)

      setSorterStatus(state, t('sorter.saving'), 'idle')
      renderStatus()

      try {
        await moveModuleTab(found.tab.id, targetModuleId, targetIndex)
        await refreshState()
        applyModuleSpanSnapshot(state.pages, spanSnapshot)
        setSorterStatus(state, t('sorter.saved'), 'success')
      } catch (error) {
        await refreshState()
        applyModuleSpanSnapshot(state.pages, spanSnapshot)
        setSorterStatus(state, error instanceof Error ? error.message : t('sorter.saveFailed'), 'error')
      } finally {
        clearDragState(state)
        renderStatusAndPages()
      }
    },
    onDropContent: async ({contentId, contentType, targetTabId, targetIndex}) => {
      if (!contentId || !contentType || !targetTabId || targetIndex < 0) return
      const spanSnapshot = createModuleSpanSnapshot(state.pages)

      setSorterStatus(state, t('sorter.saving'), 'idle')
      renderStatus()

      try {
        await moveCollectionContent(contentType, contentId, targetTabId, targetIndex)
        await refreshState()
        applyModuleSpanSnapshot(state.pages, spanSnapshot)
        await refreshContentSortContents(contentType)
        setSorterStatus(state, t('sorter.saved'), 'success')
      } catch (error) {
        await refreshState()
        applyModuleSpanSnapshot(state.pages, spanSnapshot)
        await refreshContentSortContents(contentType)
        setSorterStatus(state, error instanceof Error ? error.message : t('sorter.saveFailed'), 'error')
      } finally {
        clearDragState(state)
        renderStatusAndPages()
      }
    },
  })

  new YEH({
    body: [
      'click',
      {type: 'input', debounce: 40},
      'keydown',
      {type: 'change', debounce: 80},
    ],
  }, {}, {
    enableStats: false,
    enableConfigValidation: false,
    enableHandlerValidation: false,
    methods: {
      async handleClick(event, target) {
        const clickable = target.closest?.('[data-click]')
        if (!clickable?.dataset?.click) return
        event.preventDefault()

        if (clickable.dataset.click === 'sorterToggleTabs') {
          clearContentSort(state)
          const moduleType = clickable.dataset.moduleType || null
          const moduleSyncId = clickable.dataset.moduleSyncId || null
          const sameTypeActive = state.tabSort.moduleType === moduleType && !!moduleType
          const sameModuleActive = sameTypeActive && state.tabSort.sourceModuleSyncId === moduleSyncId

          if (!sameTypeActive) {
            toggleTabSort(state, moduleType, moduleSyncId)
            setExpandedModules(moduleSyncId ? [moduleSyncId] : [])
            renderPages()
            return
          }

          if (sameModuleActive && state.expandedModules.size <= 1 && moduleSyncId && state.expandedModules.has(moduleSyncId)) {
            clearTabSort(state)
            setExpandedModules([])
            renderPages()
            return
          }

          toggleExpandedModule(state, moduleSyncId)
          state.tabSort.sourceModuleSyncId = moduleSyncId
          if (!state.expandedModules.size) clearTabSort(state)
          renderPages()
          return
        }

        if (clickable.dataset.click === 'sorterTogglePageContent') {
          toggleCollapsedPage(state, clickable.dataset.pageSyncId)
          applyPageCollapseDom(clickable.dataset.pageSyncId)
          return
        }

        if (clickable.dataset.click === 'sorterToggleContents') {
          clearTabSort(state)
          const moduleType = clickable.dataset.moduleType || null
          const moduleSyncId = clickable.dataset.moduleSyncId || null
          const sameTypeActive = state.contentSort.moduleType === moduleType && !!moduleType
          const sameModuleActive = sameTypeActive && state.contentSort.sourceModuleSyncId === moduleSyncId

          if (!sameTypeActive) {
            toggleContentSort(state, moduleType, moduleSyncId)
            setExpandedModules(moduleSyncId ? [moduleSyncId] : [])
          } else if (sameModuleActive && state.expandedModules.size <= 1 && moduleSyncId && state.expandedModules.has(moduleSyncId)) {
            clearContentSort(state)
            setExpandedModules([])
          } else {
            toggleExpandedModule(state, moduleSyncId)
            state.contentSort.sourceModuleSyncId = moduleSyncId
            if (!state.expandedModules.size) clearContentSort(state)
          }
          Promise.resolve(
            state.contentSort.moduleType
              ? refreshContentSortContents(state.contentSort.moduleType)
              : refreshContentSortContents(null)
          ).then(() => renderPages())
          return
        }

        if (clickable.dataset.click === 'sorterResetPageSlots') {
          clearPageOrphanSlots(state, clickable.dataset.pageSyncId)
          setSorterStatus(state, t('sorter.slotsReset'), 'success')
          renderStatusAndPages()
          return
        }

        if (clickable.dataset.click === 'sorterReload') {
          location.reload()
          return
        }

        if (clickable.dataset.click === 'sorterOpenItemEditor') {
          const kind = clickable.dataset.sorterKind || null
          const targetId = parseInt(clickable.dataset.sorterTargetId ?? '', 10)
          if (!kind || !targetId) return
          openSorterEditor(state, {
            kind,
            targetId,
            moduleType: clickable.dataset.sorterModuleType || null,
            parentId: parseInt(clickable.dataset.sorterParentId ?? '', 10) || null,
            title: clickable.dataset.sorterTitle || '',
          })
          renderPages()
          return
        }

        if (clickable.dataset.click === 'sorterCancelItemEditor') {
          closeSorterEditor(state)
          renderPages()
          return
        }

        if (clickable.dataset.click === 'sorterSaveItemEditor') {
          const {kind, targetId, moduleType, title} = state.editor
          if (!kind || !targetId) return
          setSorterStatus(state, t('sorter.saving'), 'idle')
          renderStatus()
          let saved = false
          try {
            if (kind === 'tab') {
              await updateModuleTabTitle(targetId, title)
            } else if (kind === 'content') {
              await updateCollectionContentTitle(moduleType, targetId, title)
            }
            closeSorterEditor(state)
            await refreshState()
            if (isContentSortActive(state)) {
              await refreshContentSortContents()
            }
            setSorterStatus(state, t('sorter.saved'), 'success')
            saved = true
          } catch (error) {
            setSorterStatus(state, error instanceof Error ? error.message : t('sorter.saveFailed'), 'error')
          }
          if (saved) {
            renderStatusAndPages()
          } else {
            renderStatus()
          }
          return
        }

        if (clickable.dataset.click === 'sorterDeleteItem') {
          const kind = clickable.dataset.sorterKind || null
          const moduleType = clickable.dataset.sorterModuleType || null
          const targetId = parseInt(clickable.dataset.sorterTargetId ?? '', 10)
          const title = clickable.dataset.sorterTitle || ''
          if (!kind || !targetId) return

          const confirmMessage = kind === 'tab'
            ? t('sorter.confirmDeleteTab', {title: title || t('moduleCard.newTabTitle')})
            : t('sorter.confirmDeleteContent', {title: title || t('sorter.untitledContent')})

          if (!confirm(confirmMessage)) return

          setSorterStatus(state, t('sorter.saving'), 'idle')
          renderStatus()
          let deleted = false
          try {
            if (kind === 'tab') {
              await softDeleteModuleTabCascade(targetId, moduleType)
            } else if (kind === 'content') {
              await softDeleteCollectionContent(moduleType, targetId)
            }
            closeSorterEditor(state)
            await refreshState()
            if (isContentSortActive(state)) {
              await refreshContentSortContents()
            }
            setSorterStatus(state, t('sorter.itemDeleted'), 'success')
            deleted = true
          } catch (error) {
            setSorterStatus(state, error instanceof Error ? error.message : t('sorter.saveFailed'), 'error')
          }
          if (deleted) {
            renderStatusAndPages()
          } else {
            renderStatus()
          }
          return
        }
      },

      handleInput(event, target) {
        if (target?.dataset?.input === 'sorterEditorInput') {
          state.editor.title = target.value ?? ''
        }
      },

      async handleKeydown(event, target) {
        if (target?.dataset?.input !== 'sorterEditorInput') return
        if (event.key !== 'Enter') return
        event.preventDefault()

        const {kind, targetId, moduleType, title} = state.editor
        if (!kind || !targetId) return

        setSorterStatus(state, t('sorter.saving'), 'idle')
        renderStatus()
        let saved = false

        try {
          if (kind === 'tab') {
            await updateModuleTabTitle(targetId, title)
          } else if (kind === 'content') {
            await updateCollectionContentTitle(moduleType, targetId, title)
          }
          closeSorterEditor(state)
          await refreshState()
          if (isContentSortActive(state)) {
            await refreshContentSortContents()
          }
          setSorterStatus(state, t('sorter.saved'), 'success')
          saved = true
        } catch (error) {
          setSorterStatus(state, error instanceof Error ? error.message : t('sorter.saveFailed'), 'error')
        }

        if (saved) {
          renderStatusAndPages()
        } else {
          renderStatus()
        }
      },

      async handleChange(event, target) {
        if (target?.dataset?.change === 'sorterModuleTitleChange') {
          const moduleId = parseInt(target.dataset.moduleId ?? '', 10)
          if (!moduleId) return
          setSorterStatus(state, t('sorter.saving'), 'idle')
          renderStatus()
          try {
            await updateModuleTitle(moduleId, target.value)
            const module = findModule(target.dataset.moduleSyncId)
            if (module) module.title = String(target.value ?? '').trim() || t('sorter.untitled')
            setSorterStatus(state, t('sorter.saved'), 'success')
            renderStatus()
          } catch (error) {
            setSorterStatus(state, error instanceof Error ? error.message : t('sorter.saveFailed'), 'error')
            renderStatus()
          }
          return
        }

        if (target?.dataset?.change === 'sorterModuleSpanChange') {
          const module = findModule(target.dataset.moduleSyncId)
          if (!module) return
          if (isTabSortActive(state)) clearTabSort(state)
          if (isContentSortActive(state)) clearContentSort(state)
          const nextSpan = parseInt(target.value ?? '', 10)
          module.columnSpan = Math.max(1, Math.min(12, nextSpan || module.columnSpan))
          setSorterStatus(state, t('sorter.saving'), 'idle')
          renderStatus()
          try {
            await updateModuleColumnSpan(module, nextSpan)
            setSorterStatus(state, t('sorter.saved'), 'success')
          } catch (error) {
            await refreshState()
            setSorterStatus(state, error instanceof Error ? error.message : t('sorter.saveFailed'), 'error')
          }
          renderStatusAndPages()
        }
      },
    },
  })
}

boot().catch((error) => {
  const mount = getMount()
  if (!mount) return
  const errorMessage = error instanceof Error ? error.message : error
  mount.innerHTML = `
    <div data-sorter-app>
      <header data-sorter-app-header>
        <div>
          <p data-sorter-eyebrow>Speedtab</p>
          <h1 data-sorter-app-title>Sorter</h1>
        </div>
      </header>
      <p data-sorter-status data-tone="error">${escapeHtml(String(errorMessage))}</p>
    </div>
  `
})
