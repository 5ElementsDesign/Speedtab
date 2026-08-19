import {getCleanupCandidates} from '../../composables/useMaintenance.ts'
import {startRemoteAutoSync} from '../../composables/useRemoteAutoSync.ts'
import {getWidgetSettings} from '../../composables/useWidgetSettings.ts'
import {YaiCore, YaiTabs, YaiTabsSwipe} from '../../lib/yai/yai-local-bundle.js'
import {assetActions} from '../actions/assets.js'
import {captureActions} from '../actions/capture.js'
import {customizerActions} from '../actions/customizer.js'
import {localToolsActions} from '../actions/local-tools.js'
import {ensureFeedCollectionLoaded, moduleCrudActions} from '../actions/module-crud.js'
import {pageActions, syncOpenPageEditorActiveHint} from '../actions/pages.js'
import {searchActions} from '../actions/search.js'
import {settingsActions} from '../actions/settings.js'
import {workspaceActions} from '../actions/workspace.js'
import {closeAll, closeDropdown} from '../components/dropdown.js'
import {dismissToast, initToastEvents} from '../components/toast.js'
import {getCachedAppSettings, loadAppSettings, saveAppSetting} from '../data/app-settings.js'
import {loadCaptureInboxCount} from '../data/capture-inbox.js'
import {loadModuleBySyncId, loadModulesByPageId} from '../data/modules.js'
import {getHashPageSlug, loadPages, resolveActivePage} from '../data/pages.js'
import {loadUiConfigsByEntitySyncIds} from '../data/ui-config.js'
import {applyModuleUiConfigMap, applyShellUiConfig} from '../features/customizer/apply.js'
import {initCustomizerListeners} from '../features/customizer/panel.js'
import {SHELL_SYNC_ID} from '../features/customizer/render.js'
import {installFlyingConfig, openFlyingConfig} from '../features/flying-config/index.js'
import {initializeLocalTools, refreshOpenNotePreviewState, refreshQuicknoteWindow} from '../features/local-tools/manager.js'
import {adaptModule} from '../features/modules/registry.js'
import {enrichModules} from '../features/modules/service.js'
import {renderModuleCardBody, renderPageGrid} from '../features/pages/modules/render.js'
import {renderOrphansPage} from '../features/pages/orphans/render.js'
import {renderRootShell} from '../features/pages/render.js'
import {initializeSearch} from '../features/search/manager.js'
import {initializeWidgetRail} from '../features/widgets/manager.js'
import {renderWidgetRailShell} from '../features/widgets/render.js'
import {initBookmarkMedia} from '../utils/bookmark-media.js'
import {loadAndApplyDocumentTheme} from '../utils/document-theme.js'
import {initFavicons} from '../utils/favicon.js'
import {SUPPORTED_LOCALES, getLocale, initI18n, t} from '../utils/i18n.js'
import {activateFirstModuleTab} from '../utils/module-tabs.js'
import {applyPageWorkspaceBackground} from '../utils/workspace-background.js'
import {installWorkspaceDirtyTracking} from './dirty-tracker.js'
import {dispatch} from './dispatch.js'
import {createHandler} from './handler.js'

const ORPHANS_PAGE_SLUG = 'orphans-detected'
let runtimeInboxListenerBound = false
let quicknoteChromeListenerBound = false
let currentInboxCount = 0
let quicknotePendingCount = 0

function renderExampleWorkspaceLocaleSelect() {
  const locale = getLocale()
  const selected = SUPPORTED_LOCALES.includes(locale) ? locale : 'en'

  return `
    <label class="st-app-empty-language">
      <span>${t('settings.language.label')}</span>
      <select
        name="st-app-select-ui-locale"
        data-example-workspace-locale
        data-change="changeUiLanguage"
      >
        <option value="de" lang="de"${selected === 'de' ? ' selected' : ''}>Deutsch</option>
        <option value="en" lang="en"${selected === 'en' ? ' selected' : ''}>English</option>
        <option value="es" lang="es"${selected === 'es' ? ' selected' : ''}>Español</option>
        <option value="fr" lang="fr"${selected === 'fr' ? ' selected' : ''}>Français</option>
        <option value="nl" lang="nl"${selected === 'nl' ? ' selected' : ''}>Nederlands</option>
        <option value="tr" lang="tr"${selected === 'tr' ? ' selected' : ''}>Türkçe</option>
        <option value="ru" lang="ru"${selected === 'ru' ? ' selected' : ''}>Русский</option>
        <option value="hi" lang="hi"${selected === 'hi' ? ' selected' : ''}>हिन्दी</option>
        <option value="zh_CN" lang="zh"${selected === 'zh_CN' ? ' selected' : ''}>中文</option>
      </select>
      <small>${t('app.onboardingLanguageDescription')}</small>
    </label>
  `
}

function renderEmptyStateThemeSelect(appSettings = null) {
  const uiTheme = appSettings?.ui_theme === 'light' ? 'light' : 'dark'
  const isBackgroundActive = appSettings?.background_properties !== 'none'
  const backgroundLabel = isBackgroundActive
    ? t('customizer.removeBackgroundShort')
    : t('customizer.speedtabBackgroundShort')

  return `
    <div class="st-app-empty-card st-app-empty-theme-card">
      <div class="st-app-empty-theme-actions">
        <button
          type="button"
          class="st-btn"
          data-btn="ghost"
          data-click="toggleEmptyStateBackground"
          aria-pressed="${isBackgroundActive ? 'true' : 'false'}"
          title="${backgroundLabel}"
          aria-label="${backgroundLabel}"
        ><i data-icon="image" aria-hidden="true"></i> ${backgroundLabel}</button>
        <button
          type="button"
          class="st-btn"
          data-btn="dark"
          data-click="setEmptyStateThemePreset"
          data-theme-value="dark"
          aria-pressed="${uiTheme === 'dark' ? 'true' : 'false'}"
        ><i data-icon="moon" aria-hidden="true"></i> ${t('customizer.options.dark')}</button>
        <button
          type="button"
          class="st-btn"
          data-btn="light"
          data-click="setEmptyStateThemePreset"
          data-theme-value="light"
          aria-pressed="${uiTheme === 'light' ? 'true' : 'false'}"
        ><i data-icon="sun" aria-hidden="true"></i> ${t('customizer.options.light')}</button>
      </div>
    </div>
  `
}

function buildChromeTitle() {
  const appTitle = t('app.title')
  const baseTitle = currentInboxCount > 0
    ? `INBOX [${currentInboxCount}] - ${appTitle}`
    : appTitle

  return quicknotePendingCount > 0
    ? `${t('scratchpad.title')} [${quicknotePendingCount}] • ${baseTitle}`
    : baseTitle
}

function syncChromeTitle() {
  document.title = buildChromeTitle()
}

function createQuicknoteMarkerButton() {
  const wrapper = document.createElement('div')
  wrapper.innerHTML = `
    <button
      type="button"
      class="st-app-header-quicknote-marker st-btn"
      data-click="clearQuicknoteTitleMarker"
      title="${t('scratchpad.clearMarker')}"
      aria-label="${t('scratchpad.clearMarker')}"
    >QN <span data-app-header-quicknote-count>${quicknotePendingCount}</span></button>
  `
  return wrapper.firstElementChild
}

function syncQuicknoteMarkerButton() {
  const actions = document.querySelector('[data-app-header-actions]')
  const existing = document.querySelector('.st-app-header-quicknote-marker')
  if (quicknotePendingCount <= 0) {
    existing?.remove?.()
    return
  }

  if (!(actions instanceof HTMLElement)) return
  if (existing instanceof HTMLElement) {
    const countEl = existing.querySelector('[data-app-header-quicknote-count]')
    if (countEl) countEl.textContent = String(quicknotePendingCount)
    return
  }

  const markerButton = createQuicknoteMarkerButton()
  if (!(markerButton instanceof HTMLElement)) return

  const inboxButton = actions.querySelector('.st-app-header-inbox')
  if (inboxButton instanceof HTMLElement) {
    inboxButton.insertAdjacentElement('afterend', markerButton)
    return
  }

  actions.prepend(markerButton)
}

function setQuicknotePendingCount(nextValue) {
  quicknotePendingCount = Math.max(0, Number(nextValue) || 0)
  syncChromeTitle()
  syncQuicknoteMarkerButton()
}

function incrementQuicknotePendingCount(step = 1) {
  setQuicknotePendingCount(quicknotePendingCount + Math.max(1, Number(step) || 1))
}

export function clearQuicknoteChromeMarker() {
  setQuicknotePendingCount(0)
}

function updateInboxTitle(count = 0) {
  currentInboxCount = Math.max(0, Number(count) || 0)
  syncChromeTitle()
}

function updateInboxBadge(count = 0) {
  const existing = document.querySelector('.st-app-header-inbox')
  const nav = document.querySelector('[data-app-header-nav]')
  const actions = document.querySelector('[data-app-header-actions]')

  if (count <= 0) {
    existing?.remove?.()
    syncQuicknoteMarkerButton()
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
  syncQuicknoteMarkerButton()
}

export function syncCaptureInboxChrome(count = 0) {
  updateInboxTitle(count)
  updateInboxBadge(count)
}

export async function refreshCaptureInboxChrome() {
  const count = await loadCaptureInboxCount()
  syncCaptureInboxChrome(count)
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
      incrementQuicknotePendingCount()
      void refreshQuicknoteWindow()
      return
    }

    if (message?.type === 'REMOTE_AUTO_SYNC_ACTIVITY') {
      document.dispatchEvent(new CustomEvent('speedtab:remote-sync-activity', {
        detail: {
          kind: message.kind === 'push' ? 'push' : 'check',
          phase: message.phase === 'start' ? 'start' : 'end',
        },
      }))
    }
  })
  runtimeInboxListenerBound = true
}

function bindQuicknoteChromeListener() {
  if (quicknoteChromeListenerBound) return
  document.addEventListener('speedtab:clear-quicknote-marker', () => {
    clearQuicknoteChromeMarker()
  })
  quicknoteChromeListenerBound = true
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
    if (container && context?._scheduleResetContentHeight) {
      context._scheduleResetContentHeight(container)
    } else if (container && context?._resetContentHeight) {
      requestAnimationFrame(() => context._resetContentHeight(container))
    }
  }))
}

function isHiddenByTabState(element) {
  return !!element?.closest?.('[aria-hidden="true"], [inert]')
}

function hydrateVisibleFeedCollections(scope) {
  if (!(scope instanceof HTMLElement)) return
  scope.querySelectorAll('[data-feed-collection-id][data-feed-module-sync-id]').forEach((collectionRoot) => {
    if (!(collectionRoot instanceof HTMLElement)) return
    if (isHiddenByTabState(collectionRoot)) return
    const moduleSyncId = collectionRoot.dataset.feedModuleSyncId || ''
    const collectionId = parseInt(collectionRoot.dataset.feedCollectionId ?? '', 10)
    if (!moduleSyncId || !collectionId) return
    void ensureFeedCollectionLoaded(moduleSyncId, collectionId)
  })
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
  })
}

function syncActivePageGridMaxWidthToken(source = null) {
  const appRoot = document.querySelector('[data-app]')
  if (!(appRoot instanceof HTMLElement)) return

  const sourceRoot = source instanceof HTMLElement
    ? source
    : document.querySelector('[data-app-tab-panel].active [data-app-tab-content], [data-app-tab-content]')

  const pageGrid = sourceRoot instanceof HTMLElement
    ? sourceRoot.querySelector('[data-page-grid]')
    : null

  const localMaxWidth = pageGrid instanceof HTMLElement
    ? pageGrid.style.getPropertyValue('--st-page-grid-max-width-local').trim()
    : ''

  if (localMaxWidth) {
    appRoot.style.setProperty('--st-page-grid-max-width-local', localMaxWidth)
    return
  }

  appRoot.style.removeProperty('--st-page-grid-max-width-local')
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
  dismissToast(target) {
    dismissToast(target)
  },
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
  initToastEvents()

  const setListenerType = YaiDevice.hasTouch
    ? ['touchstart', 'touchmove', 'touchend']
    : ['mousedown', 'mousemove', 'mouseup']
  const globalReleaseListeners = YaiDevice.hasTouch
    ? []
    : [{type: 'mouseup', handler: 'globalMouseWatch', debounce: 50}]

  const tabs = new YaiTabs({
    rootSelector: '[data-app][data-yai-tabs], [data-app] [data-yai-tabs]',
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
        '[data-floating-windows]': setListenerType,
      },
      actionableAttributes: ['data-tab-action', 'data-swipe', 'data-click', 'data-input', 'data-input-immediate', 'data-change', 'data-submit'],
      actionableClasses: ['st-btn'],
    },
    callable: {
      eventClick: [({target, action, event}) => {
        if (!action) return
        routeAction(target, action, event)
        const button = target?.closest?.('button')
        if (button?.closest?.('[data-window-actions]') && button.type !== 'submit') button.blur()
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
      tabSwitching: [({target, container, action}) => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
        if (action !== 'switching' || container?.dataset?.refPath !== 'pages') return
        const page = pageMap.get(target?.dataset?.open)
        syncOpenPageEditorActiveHint(page?.sync_id ?? '')
        void applyPageWorkspaceBackground(page?.sync_id ?? '', getCachedAppSettings())
      }],
      tabReady: [({target, content, container, id, refPath, context}) => {
        content?.removeAttribute('inert')
        if (container?.dataset?.refPath !== 'pages') {
          hydrateModuleTabBookmarks(content, container, context)
          hydrateVisibleFeedCollections(content)
          return
        }

        // Keep overflow dropdown in sync with the active page
        const activeSlug = target.dataset.open
        if (getCachedAppSettings().remember_last_page === true && activeSlug) {
          saveAppSetting('last_page_slug', activeSlug)
        }
        document.querySelectorAll('[data-page-slug]').forEach((btn) => {
          btn.toggleAttribute('data-overflow-active', btn.dataset.pageSlug === activeSlug)
        })

        syncActivePageGridMaxWidthToken(content?.querySelector?.('[data-app-tab-content]') ?? null)

        hydrateOpenedPagePanel(target, content, container, pageMap, context).then(() => {
          syncActivePageGridMaxWidthToken(content?.querySelector?.('[data-app-tab-content]') ?? null)
          dispatch('page-hydrated', {content})
        })
      }],
    },
  })

  mount.__flyingConfigCleanup = installFlyingConfig(tabs, ({target}) => openFlyingConfig(target))

  const swype = new YaiTabsSwipe({
    axis: YaiDevice.hasTouch ? 'horizontal' : 'auto',
    ignoreClosestSelector: 'nav[data-controller], [data-app-footer], [data-dropdown], [data-window-actions], textarea, input, select',
    cancelDragClickSelector: [
      'a.st-trigger-tab',
      'button.st-trigger-note',
      'button[data-bookmark-inline-add]',
      'button[data-note-inline-add]',
    ].join(', '),
    clickCancelThreshold: 8,
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
      if (target?.closest?.('main[data-app-content], [data-floating-windows]')) return
      swype.resetDraggingState()
    })
  }

  mount.__nextTabsInstance = tabs
  mount.__nextSwipeInstance = swype

  return tabs
}

function destroyExistingTabs(mount) {
  const existing = mount.__nextTabsInstance
  mount.__flyingConfigCleanup?.()
  mount.__flyingConfigCleanup = null
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
  if (page?.virtualType === 'orphans') {
    const orphanCandidates = await getCleanupCandidates()
    pageContent.innerHTML = renderOrphansPage(orphanCandidates)
    pageContent.setAttribute('data-page-hydrated', '')
    return
  }
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

    if (context?.initializeAllContainers) {
      context.initializeAllContainers(pageContent)
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
  initFavicons(pageContent)
  hydrateVisibleFeedCollections(pageContent)
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
  // CRITICAL RENDER PATH:
  // DO NOT CALL THIS FOR STATE-ONLY UPDATES.
  // THIS REBUILDS THE FULL SHELL AND WILL WIPE LIVE DOM STATE.
  const mount = document.querySelector('#app')
  if (!mount) throw new Error('Missing #app mount')

  destroyExistingTabs(mount)
  installWorkspaceDirtyTracking()
  await loadAndApplyDocumentTheme()
  await initI18n()
  bindRuntimeInboxListener()
  bindQuicknoteChromeListener()

  const appSettingsPromise = loadAppSettings()

  const [pages, widgetSettings, captureInboxCount, appSettings] = await Promise.all([
    loadPages(),
    getWidgetSettings(),
    loadCaptureInboxCount(),
    appSettingsPromise,
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
    || (appSettings.remember_last_page === true ? appSettings.last_page_slug : null)
  const activePage = activeSlug === ORPHANS_PAGE_SLUG
    ? virtualPages[0] ?? resolveActivePage(pages, activeSlug)
    : resolveActivePage(renderPages, activeSlug)
  await applyPageWorkspaceBackground(activePage?.sync_id ?? '', appSettings, {immediate: true})
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
    hydratedPageSlugs,
    orphanCandidates,
    captureInboxCount,
    widgetRail: renderWidgetRailShell(widgetSettings),
    widgetRailPosition: widgetSettings.rail_position,
  })
  syncQuicknoteMarkerButton()

  if (activePage?.slug) {
    const activePageContent = mount.querySelector(`[data-app-tab-content][data-page-slug="${CSS.escape(activePage.slug)}"]`)
    activePageContent?.setAttribute('data-page-hydrated', '')
  }

  const allModules = [...pageModulesBySlug.values()].flat()
  const [, shellConfigMap] = await Promise.all([
    applyPageModuleUiConfig(mount, allModules),
    loadUiConfigsByEntitySyncIds('shell', [{sync_id: SHELL_SYNC_ID, type: 'app'}]),
  ])
  const shellConfig = shellConfigMap?.get(SHELL_SYNC_ID)
  if (shellConfig) applyShellUiConfig(shellConfig)

  const appRoot = mount.querySelector('[data-app]')

  const initialActivePageContent = mount.querySelector(`[data-app-tab-content][data-page-slug="${CSS.escape(activePage?.slug || '')}"]`)
  syncActivePageGridMaxWidthToken(initialActivePageContent)

  if (renderPages.length && activePage) {
    initializeSearch()
    await initializeLocalTools(mount.querySelector('[data-app]'))
    initializeWidgetRail(widgetSettings)
    startRemoteAutoSync()
    const tabs = initializeNextTabs(mount, renderPages)
    return tabs
  } else {
    mount.innerHTML = `
      <div class="st-app-empty">
        ${renderEmptyStateThemeSelect(appSettings)}
        <div class="st-app-empty-card">
          <h1><span>${t('app.title')}</span></h1>
          <p>${t('app.noPagesTitle')}</p>
          <p>${t('app.noPagesDescription')}</p>
          <div class="st-app-empty-actions">
            <button type="button" data-btn="ghost" data-click="addPage" data-empty-add-page>${t('app.newPage')}</button>
            <button type="button" data-btn="ghost" data-click="openImportExport">${t('settings.importExportTitle')}</button>
            ${canLoadExampleWorkspace
              ? `<button type="button" data-btn="primary" data-click="loadExampleWorkspace">${t('app.quickStart')}</button>`
              : ''}
          </div>
        </div>
        <div class="st-app-empty-card st-app-card-select-locale-container">
          ${canLoadExampleWorkspace ? renderExampleWorkspaceLocaleSelect() : ''}
        </div>
      </div>
    `
    await initializeLocalTools(null)
    initializeWidgetRail(widgetSettings)
    startRemoteAutoSync()
    return null
  }
}

export async function refreshModuleContent(syncId, {fallbackToFirstTab = false} = {}) {
  // CRITICAL MODULE RENDER PATH:
  // USE ONLY WHEN THE MODULE STRUCTURE ITSELF CHANGED.
  // FOR BADGES, BUTTON STATE, TITLES, HIGHLIGHTS, OR SIMPLE TOGGLES, PATCH IN PLACE.
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
  if (lastActive && !fallbackToFirstTab) {
    refreshedTabsEl?.setAttribute('data-last-active', lastActive)
  }

  const appRoot = document.querySelector('#app')
  const tabsInstance = appRoot?.__nextTabsInstance
  if (tabsInstance?.initializeAllContainers) {
    tabsInstance.initializeAllContainers(bodyEl)
    tabsInstance._updateAriaStates?.(refreshedTabsEl ?? bodyEl)
  }

  const uiConfigMap = await loadUiConfigsByEntitySyncIds('module', [enriched])
  applyModuleUiConfigMap(card, uiConfigMap)

  if (fallbackToFirstTab) {
    activateFirstModuleTab(card)
  } else if (lastActive && refreshedTabsEl) {
    const opener = refreshedTabsEl.querySelector(`:scope > [data-controller] [data-open="${CSS.escape(lastActive)}"]`)
    if (opener) {
      YaiCore.simulateClickEvent(opener)
    }
  }

  refreshOpenNotePreviewState()
}

export async function refreshPageContent(pageReference = {}) {
  // CRITICAL PAGE RENDER PATH:
  // USE ONLY WHEN PAGE-LOCAL STRUCTURE CHANGED (MODULE ADD/REMOVE/REORDER).
  // DO NOT ROUTE ORDINARY INTERACTION STATE THROUGH THIS.
  const pageId = Number(pageReference?.pageId) || null
  const pageSyncId = pageReference?.pageSyncId?.trim?.() || ''
  const pageSlug = pageReference?.pageSlug?.trim?.() || ''

  const pages = await loadPages()
  const page = pages.find((entry) => (
    (pageId && entry.id === pageId)
    || (pageSyncId && entry.sync_id === pageSyncId)
    || (pageSlug && entry.slug === pageSlug)
  ))
  if (!page?.id || !page?.slug) return

  const pageContent = document.querySelector(`[data-app-tab-content][data-page-slug="${CSS.escape(page.slug)}"]`)
  if (!(pageContent instanceof HTMLElement)) return

  const lastActiveByModuleSyncId = new Map()
  pageContent.querySelectorAll('[data-module-card][data-sync-id]').forEach((card) => {
    if (!(card instanceof HTMLElement)) return
    const moduleSyncId = card.dataset.syncId || ''
    const lastActive = card.querySelector('[data-yai-tabs]')?.dataset?.lastActive || ''
    if (moduleSyncId && lastActive) {
      lastActiveByModuleSyncId.set(moduleSyncId, lastActive)
    }
  })

  const modules = await loadModulesByPageId(page.id)
  const enrichedModules = await enrichModules(modules)
  pageContent.innerHTML = renderPageGrid(page, enrichedModules, {hydrateBodies: true})
  pageContent.setAttribute('data-page-hydrated', '')

  pageContent.querySelectorAll('[data-module-card][data-sync-id]').forEach((card) => {
    if (!(card instanceof HTMLElement)) return
    const moduleSyncId = card.dataset.syncId || ''
    const lastActive = lastActiveByModuleSyncId.get(moduleSyncId)
    if (!lastActive) return
    const tabsRoot = card.querySelector('[data-yai-tabs]')
    if (tabsRoot instanceof HTMLElement) {
      tabsRoot.setAttribute('data-last-active', lastActive)
    }
  })

  const appRoot = document.querySelector('#app')
  const tabsInstance = appRoot?.__nextTabsInstance
  if (tabsInstance?.initializeAllContainers) {
    tabsInstance.initializeAllContainers(pageContent)
  }
  tabsInstance?._initializeNestedDefaults?.(pageContent)
  tabsInstance?._activateDefaultTabs?.(pageContent)
  tabsInstance?._updateAriaStates?.(pageContent)

  const uiConfigMap = await loadUiConfigsByEntitySyncIds('module', enrichedModules)
  applyModuleUiConfigMap(pageContent, uiConfigMap)
  initFavicons(pageContent)
  hydrateVisibleFeedCollections(pageContent)
  syncActivePageGridMaxWidthToken(pageContent)
  refreshOpenNotePreviewState()
}

// YEH: dropdown toggle + resize/scroll repositioning
export const handler = createHandler(appActions)
