import {SPEEDTAB_SVG} from '../next/components/icons.js'
import {YEH} from '../lib/yai/yeh.js'
import {t, initI18n} from '../next/utils/i18n.js'
import '../next/styles/next.css'
import {buildSorterState, loadModuleContentsForSorter, moveCollectionContent, moveModule, moveModuleTab, movePage, updateModuleColumnSpan, updateModuleTitle} from './data.js'
import {initSorterDnd} from './dnd.js'
import {renderSorterApp} from './render.js'
import {
  appendOrphanSlot,
  clearContentSort,
  clearDragState,
  clearTabSort,
  clearPageOrphanSlots,
  createSorterState,
  isContentSortActive,
  isTabSortActive,
  removeOrphanSlot,
  setSorterPages,
  setContentSortContents,
  setSorterStatus,
  toggleCollapsedPage,
  toggleContentSort,
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

function render() {
  const mount = getMount()
  if (!mount) return
  const scrollTop = document.scrollingElement?.scrollTop ?? 0
  mount.innerHTML = renderSorterApp(state)
  document.scrollingElement?.scrollTo({top: scrollTop})
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
    button.title = collapsed ? t('next.sorter.showPageContent') : t('next.sorter.hidePageContent')
    button.replaceChildren(document.createTextNode(`${collapsed ? t('next.sorter.showContent') : t('next.sorter.hideContent')} `))
    button.insertAdjacentHTML('beforeend', SPEEDTAB_SVG.chevron)
  }
}

async function refreshState() {
  setSorterPages(state, await buildSorterState())
}

async function boot() {
  await initI18n()
  await refreshState()
  setSorterStatus(state, t('next.sorter.ready'), 'idle')
  render()

  const root = getSorterEventRoot()
  if (!root) return

  initSorterDnd({
    root,
    state,
    onDropPage: async ({pageSyncId, targetIndex}) => {
      const page = state.pages.find((entry) => entry.syncId === pageSyncId)
      if (!page || targetIndex < 0) return

      setSorterStatus(state, t('next.sorter.saving'), 'idle')
      render()

      try {
        await movePage(page.id, targetIndex)
        await refreshState()
        if (isContentSortActive(state)) {
          await refreshContentSortContents()
        }
        setSorterStatus(state, t('next.sorter.saved'), 'success')
      } catch (error) {
        await refreshState()
        if (isContentSortActive(state)) {
          await refreshContentSortContents()
        }
        setSorterStatus(state, error instanceof Error ? error.message : t('next.sorter.saveFailed'), 'error')
      } finally {
        clearDragState(state)
        render()
      }
    },
    onDropModule: async ({moduleSyncId, targetPageSyncId, targetIndex, targetSlotId, targetSlotKind}) => {
      const module = findModule(moduleSyncId)
      const sourcePageSyncId = state.drag.sourcePageSyncId
      const targetPage = state.pages.find((page) => page.syncId === targetPageSyncId)
      if (!module || !targetPage || targetIndex < 0) return
      const spanSnapshot = createModuleSpanSnapshot(state.pages)

      setSorterStatus(state, t('next.sorter.saving'), 'idle')
      render()

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
        setSorterStatus(state, t('next.sorter.saved'), 'success')
      } catch (error) {
        await refreshState()
        applyModuleSpanSnapshot(state.pages, spanSnapshot)
        setSorterStatus(state, error instanceof Error ? error.message : t('next.sorter.saveFailed'), 'error')
      } finally {
        clearDragState(state)
        render()
      }
    },
    onDropTab: async ({tabSyncId, targetModuleId, targetIndex}) => {
      const found = findTab(tabSyncId)
      if (!found || !targetModuleId || targetIndex < 0) return
      const spanSnapshot = createModuleSpanSnapshot(state.pages)

      setSorterStatus(state, t('next.sorter.saving'), 'idle')
      render()

      try {
        await moveModuleTab(found.tab.id, targetModuleId, targetIndex)
        await refreshState()
        applyModuleSpanSnapshot(state.pages, spanSnapshot)
        setSorterStatus(state, t('next.sorter.saved'), 'success')
      } catch (error) {
        await refreshState()
        applyModuleSpanSnapshot(state.pages, spanSnapshot)
        setSorterStatus(state, error instanceof Error ? error.message : t('next.sorter.saveFailed'), 'error')
      } finally {
        clearDragState(state)
        render()
      }
    },
    onDropContent: async ({contentId, contentType, targetTabId, targetIndex}) => {
      if (!contentId || !contentType || !targetTabId || targetIndex < 0) return
      const spanSnapshot = createModuleSpanSnapshot(state.pages)

      setSorterStatus(state, t('next.sorter.saving'), 'idle')
      render()

      try {
        await moveCollectionContent(contentType, contentId, targetTabId, targetIndex)
        await refreshState()
        applyModuleSpanSnapshot(state.pages, spanSnapshot)
        await refreshContentSortContents(contentType)
        setSorterStatus(state, t('next.sorter.saved'), 'success')
      } catch (error) {
        await refreshState()
        applyModuleSpanSnapshot(state.pages, spanSnapshot)
        await refreshContentSortContents(contentType)
        setSorterStatus(state, error instanceof Error ? error.message : t('next.sorter.saveFailed'), 'error')
      } finally {
        clearDragState(state)
        render()
      }
    },
  })

  new YEH({
    body: [
      'click',
      {type: 'change', debounce: 80},
    ],
  }, {}, {
    enableStats: false,
    enableConfigValidation: false,
    enableHandlerValidation: false,
    methods: {
      handleClick(event, target) {
        const clickable = target.closest?.('[data-click]')
        if (!clickable?.dataset?.click) return
        event.preventDefault()

        if (clickable.dataset.click === 'sorterToggleTabs') {
          clearContentSort(state)
          toggleTabSort(state, clickable.dataset.moduleType, clickable.dataset.moduleSyncId)
          render()
          return
        }

        if (clickable.dataset.click === 'sorterTogglePageContent') {
          toggleCollapsedPage(state, clickable.dataset.pageSyncId)
          applyPageCollapseDom(clickable.dataset.pageSyncId)
          return
        }

        if (clickable.dataset.click === 'sorterToggleContents') {
          clearTabSort(state)
          toggleContentSort(state, clickable.dataset.moduleType, clickable.dataset.moduleSyncId)
          Promise.resolve(
            state.contentSort.moduleType
              ? refreshContentSortContents(state.contentSort.moduleType)
              : refreshContentSortContents(null)
          ).then(() => render())
          return
        }

        if (clickable.dataset.click === 'sorterResetPageSlots') {
          clearPageOrphanSlots(state, clickable.dataset.pageSyncId)
          setSorterStatus(state, t('next.sorter.slotsReset'), 'success')
          render()
          return
        }

        if (clickable.dataset.click === 'sorterReload') {
          location.reload()
          return
        }
      },

      async handleChange(event, target) {
        if (target?.dataset?.change === 'sorterModuleTitleChange') {
          const moduleId = parseInt(target.dataset.moduleId ?? '', 10)
          if (!moduleId) return
          setSorterStatus(state, t('next.sorter.saving'), 'idle')
          render()
          try {
            await updateModuleTitle(moduleId, target.value)
            const module = findModule(target.dataset.moduleSyncId)
            if (module) module.title = String(target.value ?? '').trim() || t('next.modules.untitled')
            setSorterStatus(state, t('next.sorter.saved'), 'success')
          } catch (error) {
            setSorterStatus(state, error instanceof Error ? error.message : t('next.sorter.saveFailed'), 'error')
          }
          render()
          return
        }

        if (target?.dataset?.change === 'sorterModuleSpanChange') {
          const module = findModule(target.dataset.moduleSyncId)
          if (!module) return
          if (isTabSortActive(state)) clearTabSort(state)
          if (isContentSortActive(state)) clearContentSort(state)
          const nextSpan = parseInt(target.value ?? '', 10)
          module.columnSpan = Math.max(1, Math.min(12, nextSpan || module.columnSpan))
          setSorterStatus(state, t('next.sorter.saving'), 'idle')
          render()
          try {
            await updateModuleColumnSpan(module, nextSpan)
            setSorterStatus(state, t('next.sorter.saved'), 'success')
          } catch (error) {
            await refreshState()
            setSorterStatus(state, error instanceof Error ? error.message : t('next.sorter.saveFailed'), 'error')
          }
          render()
        }
      },
    },
  })
}

boot().catch((error) => {
  const mount = getMount()
  if (!mount) return
  mount.innerHTML = `
    <div data-sorter-app>
      <header data-sorter-app-header>
        <div>
          <p data-sorter-eyebrow>Speedtab</p>
          <h1 data-sorter-app-title>Sorter</h1>
        </div>
      </header>
      <p data-sorter-status data-tone="error">${String(error instanceof Error ? error.message : error)}</p>
    </div>
  `
})
