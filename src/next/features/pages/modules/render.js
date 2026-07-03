import {escapeHtml} from '../../../utils/html.js'
import {t} from '../../../utils/i18n.js'
import {adaptModule, renderModuleBody, renderModuleBodyShell} from '../../modules/registry.js'

const DEFAULT_PAGE_GRID_MAX_WIDTH = 1500

function parsePageConfig(page) {
  if (!page?.config_json) return {modulesPerRow: 2, maxWidth: null}
  try {
    const c = JSON.parse(page.config_json)
    const maxWidth = typeof c.maxWidth === 'number' ? c.maxWidth : null
    return {
      modulesPerRow: typeof c.modulesPerRow === 'number' ? c.modulesPerRow : 2,
      maxWidth: maxWidth === DEFAULT_PAGE_GRID_MAX_WIDTH ? null : maxWidth,
    }
  } catch {
    return {modulesPerRow: 2, maxWidth: null}
  }
}

function getModuleColumnSpan(module, defaultSpan) {
  const fallback = Math.max(1, Math.min(12, Number(defaultSpan) || 12))

  const sources = [
    module?.config?.layout?.['module-column-span'],
    module?.config?.column_span,
  ]

  if (module?.config_json) {
    try {
      const parsed = JSON.parse(module.config_json)
      sources.push(parsed?.layout?.['module-column-span'])
      sources.push(parsed?.column_span)
    } catch {
      // ignore invalid persisted config
    }
  }

  for (const candidate of sources) {
    const value = Number(candidate)
    if (Number.isInteger(value) && value >= 1 && value <= 12) return value
  }

  return fallback
}

export function renderModuleCardBody(adapted, {hydrateBodies = false} = {}) {
  return hydrateBodies ? renderModuleBody(adapted) : renderModuleBodyShell(adapted)
}

function renderModuleCard(adapted, {hydrateBodies = false} = {}) {
  const syncAttr = adapted.syncId ? ` data-sync-id="${escapeHtml(adapted.syncId)}"` : ''
  const idAttr = adapted.moduleId != null ? ` data-module-id="${escapeHtml(String(adapted.moduleId))}"` : ''
  const hasActionsAttr = ['tabs', 'notes', 'feeds'].includes(adapted.type) && adapted.syncId ? ' data-has-module-actions' : ''
  const quicklinksAttr = adapted.type === 'tabs' && adapted?.config?.behavior?.['module-tabs-quicklinks'] === true
    ? ' data-module-sub-type="quicklinks" data-quicklinks'
    : ''
  return `
    <section data-module-card data-module-type="${escapeHtml(adapted.type || 'module')}"${syncAttr}${idAttr}${hasActionsAttr}${quicklinksAttr} data-module-contract="v1">
      <div data-module-card-body>
        ${renderModuleCardBody(adapted, {hydrateBodies})}
      </div>
      <span data-module-card-title>${escapeHtml(adapted.title)}</span>
    </section>
  `
}

function renderGridColumn({span, modules, hydrateBodies = false}) {
  const safeSpan = Number.isInteger(Number(span)) ? Math.max(1, Math.min(12, Number(span))) : 12
  const mobileBasis = `${Math.max(8.333333, (safeSpan / 12) * 100)}%`
  return `
    <div
      data-grid-col
      style="--st-grid-col-span: ${escapeHtml(String(safeSpan))}; --st-grid-col-track: span ${escapeHtml(String(safeSpan))} / span ${escapeHtml(String(safeSpan))}; flex: 0 0 ${escapeHtml(mobileBasis)}; grid-column: span ${escapeHtml(String(safeSpan))} / span ${escapeHtml(String(safeSpan))};"
    >
      ${modules.map((module) => renderModuleCard(module, {hydrateBodies})).join('')}
    </div>
  `
}

export function renderPageGrid(page, modules = [], {hydrateBodies = false} = {}) {
  const {modulesPerRow, maxWidth} = parsePageConfig(page)
  const perRow = Math.max(1, Math.min(12, modulesPerRow || 2))
  const defaultSpan = Math.max(1, Math.floor(12 / perRow))
  const gridStyle = maxWidth ? ` style="--st-page-grid-max-width-local:${escapeHtml(String(maxWidth))}px;"` : ''
  const isEmptyStyle = modules.length ? `` : ` data-empty-state data-swipe-ignore`;

  const columns = modules.length
    ? modules.map((module) => {
      const adapted = adaptModule(module)
      const span = getModuleColumnSpan(module, defaultSpan)
      return renderGridColumn({span, modules: [adapted], hydrateBodies})
    }).join('')
    : renderGridColumn({span: 12, modules: [{title: t('app.noModulesTitle'), body: t('app.noModulesDescription'), type: 'module', syncId: '', moduleId: null, tabs: []}], hydrateBodies})
  return `
    <div data-page-grid${gridStyle}>
      <section data-grid-row${isEmptyStyle}>${columns}</section>
    </div>
  `
}
