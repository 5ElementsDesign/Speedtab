import {buildDropdown} from '../../components/dropdown.js'
import {SPEEDTAB_SVG} from '../../components/icons.js'
import {escapeHtml} from '../../utils/html.js'
import {t} from '../../utils/i18n.js'
import {renderFeedsModule} from './feeds.js'
import {renderNotesModule} from '../pages/modules/notes/render.js'
import {renderTabsModule} from '../pages/modules/tabs/render.js'

const MODULE_ACTION_ITEMS = {
  tabs: [
    {labelKey: 'next.modules.actions.addTab', action: 'addModuleTab'},
    {labelKey: 'next.modules.actions.editTab', action: 'editCurrentModuleTab'},
    {labelKey: 'next.modules.actions.addBookmark', action: 'addModuleBookmark', dividerTop: true},
    {labelKey: 'common.customize', action: 'openCustomizer', dividerTop: true},
  ],
  notes: [
    {labelKey: 'next.modules.actions.addTab', action: 'addModuleTab'},
    {labelKey: 'next.modules.actions.editTab', action: 'editCurrentModuleTab'},
    {labelKey: 'next.modules.actions.addNote', action: 'addModuleNote', dividerTop: true},
    {labelKey: 'common.customize', action: 'openCustomizer', dividerTop: true},
  ],
  feeds: [
    {labelKey: 'next.modules.actions.addTab', action: 'addModuleTab'},
    {labelKey: 'next.modules.actions.editTab', action: 'editCurrentModuleTab'},
    {labelKey: 'next.modules.actions.addSource', action: 'addModuleFeed', dividerTop: true},
    {labelKey: 'feeds.archivedFeedItemsTitle', action: 'openArchivedFeedItems'},
    {labelKey: 'feeds.clearLoaded', action: 'clearModuleFeedItems', dividerTop: true},
    {labelKey: 'common.customize', action: 'openCustomizer', dividerTop: true},
  ],
}

function buildModuleActions(viewModel) {
  if (!viewModel.syncId) return ''
  return buildDropdown({
    trigger: SPEEDTAB_SVG.plus,
    ariaLabel: t('next.modules.actions.aria'),
    items: (MODULE_ACTION_ITEMS[viewModel.type] ?? [{labelKey: 'common.customize', action: 'openCustomizer'}]).map((item) => ({
      ...item,
      label: t(item.labelKey),
      attributes: {
        'data-sync-id': viewModel.syncId,
        'data-module-id': String(viewModel.moduleId ?? ''),
        'data-module-type': viewModel.type,
        ...(item.attributes ?? {}),
      },
    })),
  })
}

function createBaseViewModel(module) {
  let config = {}
  if (module.config_json) {
    try {
      config = JSON.parse(module.config_json) || {}
    } catch {
      config = {}
    }
  }

  return {
    title: module.title || t('next.modules.untitled'),
    body: module.body ?? '',
    type: module.type || 'module',
    syncId: module.sync_id || '',
    moduleId: module.id ?? null,
    tabs: module.tabs ?? [],
    configJson: module.config_json ?? '',
    config,
  }
}

const MODULE_DEFINITIONS = {
  tabs: {
    async enrich(module, context) {
      const tabs = await context.loadTabsByModuleId(module.id)
      const tabsWithBookmarks = await Promise.all(
        tabs.map(async (tab) => ({...tab, bookmarks: await context.loadBookmarksByTabId(tab.id)}))
      )
      return {...module, tabs: tabsWithBookmarks}
    },
    adapt(module) {
      return createBaseViewModel(module)
    },
    renderBody(viewModel) {
      return renderTabsModule(viewModel.tabs, buildModuleActions(viewModel), viewModel.moduleId, viewModel.syncId, viewModel.config)
    },
  },
  notes: {
    async enrich(module, context) {
      const tabs = await context.loadTabsByModuleId(module.id)
      const tabsWithNotes = await Promise.all(
        tabs.map(async (tab) => ({...tab, notes: await context.loadNotesByCollectionId(tab.id)}))
      )
      return {...module, tabs: tabsWithNotes}
    },
    adapt(module) {
      return createBaseViewModel(module)
    },
    renderBody(viewModel) {
      return renderNotesModule(viewModel.tabs, buildModuleActions(viewModel), viewModel.moduleId, viewModel.syncId)
    },
  },
  feeds: {
    async enrich(module, context) {
      const tabs = await context.loadTabsByModuleId(module.id)
      const tabsWithFeeds = await Promise.all(
        tabs.map(async (tab) => {
          const feedSources = await context.loadFeedSourcesByCollectionId(tab.id)
          const feedItems = await context.loadFeedItemsBySourceIds(feedSources.map((source) => source.id).filter((id) => typeof id === 'number'))
          const savedFeedItems = await context.loadSavedFeedItemsByCollectionId(tab.id)
          return {
            ...tab,
            feedSources,
            feedItems,
            savedFeedItems,
          }
        }),
      )
      return {...module, tabs: tabsWithFeeds}
    },
    adapt(module) {
      return createBaseViewModel(module)
    },
    renderBody(viewModel) {
      return renderFeedsModule(viewModel.tabs, buildModuleActions(viewModel), viewModel.moduleId, viewModel.syncId, viewModel)
    },
  },
  default: {
    adapt(module) {
      return createBaseViewModel(module)
    },
    renderBody(viewModel) {
      if (!viewModel.syncId && viewModel.body) {
        return `<p class="st-module-empty-state m-0">${escapeHtml(viewModel.body)}</p>`
      }
      return escapeHtml(viewModel.body)
    },
  },
}

export function getModuleDefinition(type) {
  return MODULE_DEFINITIONS[type] ?? MODULE_DEFINITIONS.default
}

export function adaptModule(module) {
  return getModuleDefinition(module?.type).adapt(module)
}

export function renderModuleBody(viewModel) {
  return getModuleDefinition(viewModel?.type).renderBody(viewModel)
}

export function renderModuleBodyShell(viewModel) {
  const label = viewModel?.title || t('next.modules.untitled')
  return `
    <div class="st-module-body-shell" aria-hidden="true">
      <div class="st-module-body-shell-line"></div>
      <div class="st-module-body-shell-line"></div>
      <div class="st-module-body-shell-label">${escapeHtml(label)}</div>
    </div>
  `
}
