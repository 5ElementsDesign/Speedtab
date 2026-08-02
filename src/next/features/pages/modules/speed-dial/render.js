import {renderBookmarksGrid, renderModuleTabs} from '../tabs/render.js'
import {t} from '../../../../utils/i18n.js'

export function renderSpeedDialModule(tabs = [], actionsHtml = '', moduleId = null, moduleSyncId = '', config = {}) {
  const tabsAttrs = [
    'data-module-presentation="speed-dial"',
    tabs.length <= 1 ? 'data-single-tab' : '',
  ].filter(Boolean).join(' ')

  return renderModuleTabs(
    tabs,
    (tab) => renderBookmarksGrid(tab.bookmarks ?? [], moduleSyncId, config),
    {
      actionsHtml,
      moduleId,
      emptyLabel: t('modules.empty.tabs'),
      tabsAttrs,
      tabButtonAttrs: 'data-btn="link"',
    },
  )
}
