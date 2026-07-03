import {buildDropdown} from '../../components/dropdown.js'
import {SPEEDTAB_SVG} from '../../components/icons.js'
import {escapeHtml} from '../../utils/html.js'
import {t} from '../../utils/i18n.js'
import {renderFeedsModule} from './feeds.js'
import {renderNotesModule} from '../pages/modules/notes/render.js'
import {renderTabsModule} from '../pages/modules/tabs/render.js'

const MODULE_ACTION_ITEMS = {
  tabs: [
    {labelKey: 'modules.actions.addTab', action: 'addModuleTab'},
    {labelKey: 'modules.actions.editTab', action: 'editCurrentModuleTab'},
    {labelKey: 'modules.actions.addBookmark', action: 'addModuleBookmark', dividerTop: true},
    {labelKey: 'common.customize', action: 'openCustomizer', dividerTop: true},
    {labelKey: 'modules.actions.quickSettings', submenu: 'moduleQuickSettings', dividerTop: true},
  ],
  notes: [
    {labelKey: 'modules.actions.addTab', action: 'addModuleTab'},
    {labelKey: 'modules.actions.editTab', action: 'editCurrentModuleTab'},
    {labelKey: 'modules.actions.addNote', action: 'addModuleNote', dividerTop: true},
    {labelKey: 'common.customize', action: 'openCustomizer', dividerTop: true},
    {labelKey: 'modules.actions.quickSettings', submenu: 'moduleQuickSettings', dividerTop: true},
  ],
  feeds: [
    {labelKey: 'modules.actions.addTab', action: 'addModuleTab'},
    {labelKey: 'modules.actions.editTab', action: 'editCurrentModuleTab'},
    {labelKey: 'modules.actions.addSource', action: 'addModuleFeed', dividerTop: true},
    {labelKey: 'feeds.archivedFeedItemsTitle', action: 'openArchivedFeedItems'},
    {labelKey: 'feeds.clearLoaded', action: 'clearModuleFeedItems', dividerTop: true},
    {labelKey: 'common.customize', action: 'openCustomizer', dividerTop: true},
    {labelKey: 'modules.actions.quickSettings', submenu: 'moduleQuickSettings', dividerTop: true},
  ],
}

function renderQuickSettingsColumnGrid(sharedAttributes) {
  const columnButtons = Array.from({length: 12}, (_, index) => {
    const value = index + 1
    const attrs = Object.entries({
      ...sharedAttributes,
      'data-click': 'setQuickModuleColumnSpan',
      'data-quick-setting-key': 'module-column-span',
      'data-quick-setting-value': String(value),
      'data-column-span': String(value),
      type: 'button',
    }).map(([key, attrValue]) => `${key}="${escapeHtml(String(attrValue))}"`).join(' ')

    return `<button ${attrs}>${value}</button>`
  }).join('')

  return `
    <div data-quick-setting-columns>
      <span data-quick-setting-columns-label>${escapeHtml(t('customizer.fields.moduleColumnSpan'))}</span>
      <div data-quick-setting-columns-grid>
        ${columnButtons}
      </div>
    </div>
  `
}

function buildModuleQuickSettings(viewModel) {
  const sharedAttributes = {
    'data-sync-id': viewModel.syncId,
    'data-module-id': String(viewModel.moduleId ?? ''),
    'data-module-type': viewModel.type,
  }

  const items = []

  if (viewModel.type === 'tabs') {
    items.push(
      {
        label: t('moduleForm.quicklinksMode'),
        action: 'toggleQuickModuleSetting',
        attributes: {
          ...sharedAttributes,
          'data-quick-setting-key': 'module-tabs-quicklinks',
        },
      },
      {
        label: t('moduleForm.forceFavicon'),
        action: 'toggleQuickModuleSetting',
        attributes: {
          ...sharedAttributes,
          'data-quick-setting-key': 'module-tabs-force-favicon',
        },
      },
    )
  }

  if (viewModel.type === 'tabs' || viewModel.type === 'notes') {
    items.push({
      label: t('moduleForm.showAddTile'),
      action: 'toggleQuickModuleSetting',
      attributes: {
        ...sharedAttributes,
        'data-quick-setting-key': 'module-tabs-show-add-tile',
      },
    })
  }

  items.push(
    {
      label: t('customizer.fields.moduleHideHeader'),
      action: 'toggleQuickModuleSetting',
      attributes: {
        ...sharedAttributes,
        'data-quick-setting-key': 'module-hide-header',
      },
    },
    {
      dividerTop: true,
      content: renderQuickSettingsColumnGrid(sharedAttributes),
    },
  )

  return items
}

function buildModuleActions(viewModel) {
  if (!viewModel.syncId) return ''
  return buildDropdown({
    trigger: SPEEDTAB_SVG.plus,
    ariaLabel: t('modules.actions.aria'),
    items: (MODULE_ACTION_ITEMS[viewModel.type] ?? [{labelKey: 'common.customize', action: 'openCustomizer'}]).map((item) => {
      const base = {
        label: item.label ?? t(item.labelKey),
        action: item.action,
        href: item.href,
        dividerTop: item.dividerTop,
        dividerBottom: item.dividerBottom,
        attributes: {
          'data-sync-id': viewModel.syncId,
          'data-module-id': String(viewModel.moduleId ?? ''),
          'data-module-type': viewModel.type,
          ...(item.attributes ?? {}),
        },
      }

      if (item.submenu === 'moduleQuickSettings') {
        return {
          ...base,
          submenu: buildModuleQuickSettings(viewModel),
        }
      }

      return base
    }),
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
    title: module.title || t('modules.untitled'),
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
      return renderNotesModule(viewModel.tabs, buildModuleActions(viewModel), viewModel.moduleId, viewModel.syncId, viewModel.config)
    },
  },
  feeds: {
    async enrich(module, context) {
      const tabs = await context.loadTabsByModuleId(module.id)
      const tabsWithFeeds = await Promise.all(
        tabs.map(async (tab) => {
          const feedSources = await context.loadFeedSourcesByCollectionId(tab.id)
          const sourceIds = feedSources.map((source) => source.id).filter((id) => typeof id === 'number')
          const feedItemCount = await context.countFeedItemsBySourceIds(sourceIds)
          const savedFeedItems = await context.loadSavedFeedItemsByCollectionId(tab.id)
          return {
            ...tab,
            feedSources,
            feedItems: null,
            feedItemsLoaded: false,
            feedItemCount,
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
  const label = viewModel?.title || t('modules.untitled')
  return `
    <div class="st-module-body-shell" aria-hidden="true">
      <div class="st-module-body-shell-line"></div>
      <div class="st-module-body-shell-line"></div>
      <div class="st-module-body-shell-label">${escapeHtml(label)}</div>
    </div>
  `
}
