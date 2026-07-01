import defaultWallpaperUrl from '../../assets/wallpaper-y-tree.webp'
import {getCleanupCandidates} from '../../composables/useMaintenance.ts'
import {getWidgetSettings} from '../../composables/useWidgetSettings.ts'
import {YaiCore, YaiTabs, YaiTabsSwipe} from '../../lib/yai/yai-local-bundle.js'
import {assetActions} from '../actions/assets.js'
import {captureActions} from '../actions/capture.js'
import {customizerActions} from '../actions/customizer.js'
import {localToolsActions} from '../actions/local-tools.js'
import {moduleCrudActions} from '../actions/module-crud.js'
import {pageActions} from '../actions/pages.js'
import {searchActions} from '../actions/search.js'
import {settingsActions} from '../actions/settings.js'
import {workspaceActions} from '../actions/workspace.js'
import {closeAll, closeDropdown} from '../components/dropdown.js'
import {getCachedAppSettings, loadAppSettings} from '../data/app-settings.js'
import {loadAssetObjectUrl} from '../data/assets.js'
import {loadCaptureInboxCount} from '../data/capture-inbox.js'
import {loadModuleBySyncId, loadModulesByPageId} from '../data/modules.js'
import {getHashPageSlug, loadPages, resolveActivePage} from '../data/pages.js'
import {loadUiConfigsByEntitySyncIds} from '../data/ui-config.js'
import {applyModuleUiConfigMap, applyShellUiConfig} from '../features/customizer/apply.js'
import {initCustomizerListeners} from '../features/customizer/panel.js'
import {SHELL_SYNC_ID} from '../features/customizer/render.js'
import {initializeLocalTools, refreshOpenNotePreviewState, refreshQuicknoteWindow} from '../features/local-tools/manager.js'
import {adaptModule} from '../features/modules/registry.js'
import {enrichModules} from '../features/modules/service.js'
import {renderModuleCardBody, renderPageGrid} from '../features/pages/modules/render.js'
import {renderRootShell} from '../features/pages/render.js'
import {initializeSearch} from '../features/search/manager.js'
import {initializeWidgetRail} from '../features/widgets/manager.js'
import {renderWidgetRailShell} from '../features/widgets/render.js'
import {initBookmarkMedia} from '../utils/bookmark-media.js'
import {initFavicons} from '../utils/favicon.js'
import {initI18n, t} from '../utils/i18n.js'
import {dispatch} from './dispatch.js'
import {createHandler} from './handler.js'

const ORPHANS_PAGE_SLUG = 'orphans-detected'
let runtimeInboxListenerBound = false

function updateInboxTitle(count = 0) {
  const appTitle = t('app.title')
  document.title = count > 0
    ? `INBOX [${count}] - ${appTitle}`
    : appTitle
}

function updateInboxBadge(count = 0) {
  const existing = document.querySelector('.st-app-header-inbox')
  const nav = document.querySelector('[data-app-header-nav]')
  const actions = document.querySelector('[data-app-header-actions]')

  if (count <= 0) {
    existing?.remove?.()
    return
  }

  if (!(nav instanceof HTMLElement) || !(actions instanceof HTMLElement)) return

  if (existing instanceof HTMLElement) {
    existing.title = t('nav.inboxWaiting', {
      count,
      itemsLabel: count === 1 ? t('nav.inboxItemSingular') : t('nav.inboxItemPlural'),
    })
    const countEl = existing.querySelector('[data-app-header-inbox-count]')
    if (countEl) countEl.textContent = String(count)
    return
  }

  actions.prepend((() => {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = `
      <button
        type="button"
        class="st-app-header-inbox st-btn"
        data-click="openCaptureInbox"
        title="${t('nav.inboxWaiting', {
          count,
          itemsLabel: count === 1 ? t('nav.inboxItemSingular') : t('nav.inboxItemPlural'),
        })}"
      >
        ${t('nav.inbox')}
        <span data-app-header-inbox-count>${count}</span>
      </button>
    `
    return wrapper.firstElementChild
  })())
}

function bindRuntimeInboxListener() {
  if (runtimeInboxListenerBound) return
  if (!chrome?.runtime?.onMessage) return

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'CAPTURE_INBOX_UPDATED') {
      const count = Number(message.count) || 0
      updateInboxTitle(count)
      updateInboxBadge(count)
      return
    }

    if (message?.type === 'QUICKNOTE_UPDATED') {
      void refreshQuicknoteWindow()
    }
  })
  runtimeInboxListenerBound = true
}

function hydrateModuleTabBookmarks(content, container = null, context = null) {
  if (!(content instanceof HTMLElement)) return
  content.setAttribute('data-page-loading', '')
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!content.isConnected) return
    // Force media resolution here because nested tab transitions can briefly leave
    // the freshly opened panel in a hidden/inert-looking state while YaiTabs updates
    // attributes. Without force, preview loading may be skipped and only favicon
    // fallback runs, which leaves some bookmark tiles stretched until a full reload.
    initBookmarkMedia(content, {force: true})
    initFavicons(content, {force: true})
    content.removeAttribute('data-page-loading')
    if (container && context?._resetContentHeight) {
      requestAnimationFrame(() => context._resetContentHeight(container))
    }
  }))
}

function hydrateModuleBodies(pageContent, modules = []) {
  if (!(pageContent instanceof HTMLElement) || !modules.length) return
  const modulesBySyncId = new Map(modules.map((module) => [module.sync_id, module]))

  pageContent.querySelectorAll('[data-module-card][data-sync-id]').forEach((card) => {
    if (!(card instanceof HTMLElement)) return
    const syncId = card.dataset.syncId
    const module = syncId ? modulesBySyncId.get(syncId) : null
    if (!module) return

    const bodyEl = card.querySelector('[data-module-card-body]')
    if (!(bodyEl instanceof HTMLElement)) return

    bodyEl.innerHTML = renderModuleCardBody(adaptModule(module), {hydrateBodies: true})
    initFavicons(bodyEl)
    card.setAttribute('data-module-cached', '')
  })
}

// Composition point — spread in domain action files as features are built
const appActions = {
  ...captureActions,
  ...assetActions,
  ...settingsActions,
  ...customizerActions,
  ...moduleCrudActions,
  ...pageActions,
  ...localToolsActions,
  ...searchActions,
  ...workspaceActions,
  navigateToPage(target) {
    const slug = target.dataset.pageSlug
    if (!slug) return
    document.querySelector(`[data-controller] [data-tab-action="open"][data-open="${CSS.escape(slug)}"]`)?.click()
  },
}

export function initializeNextTabs(mount, pages) {
  const YaiDevice = YaiCore.getUserPreferences()
  const pageMap = new Map(pages.map((page) => [page.slug, page]))

  initCustomizerListeners()

  const setListenerType = YaiDevice.hasTouch
    ? ['touchstart', 'touchmove', 'touchend']
    : ['mousedown', 'mousemove', 'mouseup']
  const globalReleaseListeners = YaiDevice.hasTouch
    ? []
    : [{type: 'mouseup', handler: 'globalMouseWatch', debounce: 50}]

  const tabs = new YaiTabs({
    autoDisambiguate: false,
    autoAccessibility: true,
    lazyNestedComponents: true,
    autoFocusNested: false,
    autoFocus: false,
    closable: false,
    methodsFirst: false,
    enableStats: false,
    enableConfigValidation: false,
    enableHandlerValidation: false,
    events: {
      setListener: {
        window: [{type: 'hashchange', debounce: 60}],
        ...(globalReleaseListeners.length ? {body: globalReleaseListeners} : {}),
        '[data-yai-tabs]': ['click', 'keydown', 'submit', 'input', 'change'],
        '[data-app-content]': setListenerType,
      },
      actionableAttributes: ['data-tab-action', 'data-swipe', 'data-click', 'data-input', 'data-input-immediate', 'data-change', 'data-submit'],
      actionableClasses: ['st-btn'],
    },
    callable: {
      eventClick: [({target, action, event}) => {
        if (!action) return
        routeAction(target, action, event)
      }],
      eventInput: [({target, action, event}) => {
        const nextAction = target?.dataset?.inputImmediate || action
        if (!nextAction) return
        routeAction(target, nextAction, event)
      }],
      eventChange: [({target, action, event}) => {
        if (!action) return
        routeAction(target, action, event)
      }],
      eventSubmit: [({target, action, event}) => {
        if (!action) return
        event?.preventDefault?.()
        routeAction(target, action, event)
      }],
      tabSwitching: [() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      }],
      tabReady: [({target, content, container, id, refPath, context}) => {
        content?.removeAttribute('inert')
        if (container?.dataset?.refPath !== 'pages') {
          hydrateModuleTabBookmarks(content, container, context)
          return
        }

        // Keep overflow dropdown in sync with the active page
        const activeSlug = target.dataset.open
        document.querySelectorAll('[data-page-slug]').forEach((btn) => {
          btn.toggleAttribute('data-overflow-active', btn.dataset.pageSlug === activeSlug)
        })

        hydrateOpenedPagePanel(target, content, container, pageMap, context).then(() => {
          dispatch('page-hydrated', {content})
        })
      }],
    },
  })

  const swype = new YaiTabsSwipe({
    axis: YaiDevice.hasTouch ? 'horizontal' : 'auto',
    ignoreClosestSelector: 'nav[data-controller], [data-app-footer], [data-dropdown]',
    boundaryBehavior: {
      circular: true,
      descendIntoNested: false,
      ascendFromNested: false,
    },
    callable: {
      swipeStart: () => closeAll(),
    },
  }).setInstance(tabs).watchHooks()

  if (!YaiDevice.hasTouch) {
    tabs.hook('globalMouseWatch', ({target}) => {
      if (!swype.isDragging()) return
      if (target?.closest?.('main[data-app-content]')) return
      swype.resetDraggingState()
    })
  }

  mount.__nextTabsInstance = tabs
  mount.__nextSwipeInstance = swype

  return tabs
}

function destroyExistingTabs(mount) {
  const existing = mount.__nextTabsInstance
  mount.__nextSwipeInstance?.destroy?.()
  mount.__nextSwipeInstance = null
  if (existing?.events?.destroy) {
    existing.events.destroy()
  } else if (existing?.events?.abort) {
    existing.events.abort()
  }
  mount.__nextTabsInstance = null
}

async function hydrateOpenedPagePanel(target, content, container, pageMap, context = null) {
  if (!target?.dataset?.open) return
  if (!content?.matches?.('[data-app-tab-panel]')) return
  if (container?.dataset?.refPath !== 'pages') return

  const pageContent = content.querySelector('[data-app-tab-content]')
  if (!pageContent) return

  const htmlCache = getCachedAppSettings().html_cache !== false
  const hasHydratedMarkup = htmlCache && pageContent.hasAttribute('data-page-hydrated')

  const page = pageMap.get(target.dataset.open)
  if (!page?.id) return

  let enrichedModules = null

  if (!hasHydratedMarkup) {
    // Mark immediately — prevents duplicate body hydration on rapid page switches.
    pageContent.setAttribute('data-page-hydrated', '')
    const modules = await loadModulesByPageId(page.id)
    enrichedModules = await enrichModules(modules)
    if (!enrichedModules.length) {
      pageContent.innerHTML = renderPageGrid(page, [], {hydrateBodies: true})
    } else {
      hydrateModuleBodies(pageContent, enrichedModules)
    }
  }

  if (context?._initializeNestedDefaults) {
    context._initializeNestedDefaults(pageContent)
  }
  if (context?._activateDefaultTabs) {
    context._activateDefaultTabs(pageContent)
  }
  if (context?._updateAriaStates) {
    context._updateAriaStates(pageContent)
  }
  // DO NOT MOVE MODULE UI CONFIG APPLICATION ABOVE NESTED TAB ACTIVATION.
  // DOING THAT CAUSED BOOKMARK MEDIA TO INITIALIZE BEFORE TAB VISIBILITY STATE
  // WAS STABLE, WHICH EAGER-LOADED ASSETS FROM HIDDEN TABS AND BROKE LAZY MEDIA RENDERING.
  const modulesForUiConfig = enrichedModules
    ?? Array.from(pageContent.querySelectorAll('[data-module-card][data-sync-id]')).map((el) => ({
      sync_id: el.dataset.syncId,
      type: el.dataset.moduleType,
    }))
  const uiConfigMap = await loadUiConfigsByEntitySyncIds('module', modulesForUiConfig)
  applyModuleUiConfigMap(pageContent, uiConfigMap)
  initFavicons(pageContent, {force: true})
}

async function applyPageModuleUiConfig(root, modules) {
  const uiConfigMap = await loadUiConfigsByEntitySyncIds('module', modules)
  applyModuleUiConfigMap(root, uiConfigMap)
}

function routeAction(target, action, event) {
  const dropdownRoot = target.closest?.('[data-dropdown]')
  if (dropdownRoot) closeDropdown(dropdownRoot)
  const fn = appActions[action]
  if (typeof fn === 'function') fn(target, event)
}


export async function renderNextRoot() {
  const mount = document.querySelector('#app')
  if (!mount) throw new Error('Missing #app mount')

  destroyExistingTabs(mount)

  await initI18n()
  bindRuntimeInboxListener()

  const [pages, widgetSettings, captureInboxCount] = await Promise.all([
    loadPages(),
    getWidgetSettings(),
    loadCaptureInboxCount(),
  ])
  const canLoadExampleWorkspace = pages.length === 0
    ? await (async () => {
      const {canSeedExampleWorkspace} = await import('../features/example-workspace/seed.js')
      return canSeedExampleWorkspace()
    })()
    : false
  updateInboxTitle(captureInboxCount)
  const orphanCandidates = await getCleanupCandidates()
  const hasOrphans = [
    orphanCandidates.modules,
    orphanCandidates.collections,
    orphanCandidates.tabs,
    orphanCandidates.notes,
    orphanCandidates.feedSources,
    orphanCandidates.feedItems,
    orphanCandidates.savedFeedItems,
  ].some((rows) => rows.length > 0)
  const virtualPages = hasOrphans ? [{
    id: -1,
    slug: ORPHANS_PAGE_SLUG,
    sync_id: ORPHANS_PAGE_SLUG,
    title: t('maintenance.orphansDetectedNav'),
    icon: '⚠',
    nav_group: 'main',
    is_home: 0,
    virtualType: 'orphans',
  }] : []
  const renderPages = [...virtualPages, ...pages]
  const activeSlug = getHashPageSlug()
  const activePage = activeSlug === ORPHANS_PAGE_SLUG
    ? virtualPages[0] ?? resolveActivePage(pages, activeSlug)
    : resolveActivePage(renderPages, activeSlug)
  const hydratedPageSlugs = new Set()
  if (activePage?.slug) hydratedPageSlugs.add(activePage.slug)
  const pageModulesBySlug = new Map()
  await Promise.all(renderPages.map(async (page) => {
    if (page.virtualType === 'orphans') {
      pageModulesBySlug.set(page.slug, [])
      hydratedPageSlugs.add(page.slug)
      return
    }
    const modules = page?.id ? await loadModulesByPageId(page.id) : []
    if (activePage?.slug === page.slug) {
      pageModulesBySlug.set(page.slug, await enrichModules(modules))
      return
    }
    pageModulesBySlug.set(page.slug, modules)
  }))

  mount.innerHTML = renderRootShell({
    pages: renderPages,
    activePage,
    pageModulesBySlug,
    hydrateBodies: true,
    hydratedPageSlugs,
    orphanCandidates,
    captureInboxCount,
    widgetRail: renderWidgetRailShell(widgetSettings),
    widgetRailPosition: widgetSettings.rail_position,
  })

  if (activePage?.slug) {
    const activePageContent = mount.querySelector(`[data-app-tab-content][data-page-slug="${CSS.escape(activePage.slug)}"]`)
    activePageContent?.setAttribute('data-page-hydrated', '')
  }

  const allModules = [...pageModulesBySlug.values()].flat()
  const [, shellConfigMap, appSettings] = await Promise.all([
    applyPageModuleUiConfig(mount, allModules),
    loadUiConfigsByEntitySyncIds('shell', [{sync_id: SHELL_SYNC_ID, type: 'app'}]),
    loadAppSettings(),
  ])
  const shellConfig = shellConfigMap?.get(SHELL_SYNC_ID)
  if (shellConfig) applyShellUiConfig(shellConfig)

  const appRoot = mount.querySelector('[data-app]')
  if (appRoot) {
    if (appSettings.background_asset_id) {
      const objUrl = await loadAssetObjectUrl(appSettings.background_asset_id)
      if (objUrl) appRoot.style.background = `url('${objUrl}') center/cover no-repeat`
    } else if (appSettings.background_properties) {
      appRoot.style.background = appSettings.background_properties
    } else {
      appRoot.style.background = `url('${defaultWallpaperUrl}') center/cover no-repeat`
    }
  }

  if (renderPages.length && activePage) {
    initializeSearch()
    await initializeLocalTools(mount.querySelector('[data-app]'))
    initializeWidgetRail(widgetSettings)
    const tabs = initializeNextTabs(mount, renderPages)
    return tabs
  } else {
    mount.innerHTML = `
      <div class="st-app-empty">
        <div class="st-app-empty-card">
          <h1><span aria-hidden="true">⚡</span> ${t('app.title')}</h1>
          <p>${t('app.noPagesTitle')}</p>
          <p>${t('app.noPagesDescription')}</p>
          <div class="st-app-empty-actions">
            <button type="button" data-btn="ghost" data-click="addPage" data-empty-add-page>${t('app.newPage')}</button>
            ${canLoadExampleWorkspace
              ? `<button type="button" data-btn="primary" data-click="loadExampleWorkspace">${t('app.quickStart')}</button>`
              : ''}
          </div>
        </div>
      </div>
    `
    await initializeLocalTools(null)
    initializeWidgetRail(widgetSettings)
    return null
  }
}

export async function refreshModuleContent(syncId) {
  const card = document.querySelector(`[data-module-card][data-sync-id="${CSS.escape(syncId)}"]`)
  if (!card) return

  const module = await loadModuleBySyncId(syncId)
  if (!module) return

  const enriched = (await enrichModules([module]))[0]
  const adapted = adaptModule(enriched)

  const bodyEl = card.querySelector('[data-module-card-body]')
  if (!bodyEl) return

  // Preserve the active tab across the innerHTML swap
  const lastActive = card.querySelector('[data-yai-tabs]')?.dataset?.lastActive ?? null

  bodyEl.innerHTML = renderModuleCardBody(adapted, {hydrateBodies: true})

  const refreshedTabsEl = card.querySelector('[data-yai-tabs]')
  if (lastActive) {
    refreshedTabsEl?.setAttribute('data-last-active', lastActive)
  }

  const uiConfigMap = await loadUiConfigsByEntitySyncIds('module', [enriched])
  applyModuleUiConfigMap(card, uiConfigMap)

  if (lastActive && refreshedTabsEl) {
    const opener = refreshedTabsEl.querySelector(`:scope > [data-controller] [data-open="${CSS.escape(lastActive)}"]`)
    if (opener) {
      YaiCore.simulateClickEvent(opener)
    }
  }

  refreshOpenNotePreviewState()

  card.setAttribute('data-module-cached', '')
}

// YEH: dropdown toggle + resize/scroll repositioning
export const handler = createHandler(appActions)
