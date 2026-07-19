import {SPEEDTAB_SVG} from '../../components/icons.js'
import {escapeHtml} from '../../utils/html.js'
import {t} from '../../utils/i18n.js'
import {renderFormActions} from '../forms/actions.js'
import {customizerDivider, customizerField, customizerSection} from '../../ui/primitives.js'

const PRESET_PAGE_ICONS = [
  '⭕', '⚡', '🏠', '⭐', '📁', '📌', '🧩', '📝', '📚', '📰',
  '📡', '🧠', '💼', '📊', '📈', '🛠️', '🔧', '🎯', '🚀', '🌐',
  '🧭', '🗂️', '📂', '💡', '🔒', '🔖', '🗞️', '🧪', '🎨', '🧵',
  '📷', '🎵', '🎬', '🛒', '💳', '🏦', '🧾', '🧰', '🖥️', '📱',
  '⌨️', '🕹️', '☁️', '🌙', '☀️', '🔥', '🌿', '🌊', '📍', '✅',
]

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

export function renderPageForm(page, options = {}) {
  const saveLabel = options.saveLabel ?? (page?.id ? t('pageForm.saveChanges') : t('pageForm.createPage'))
  const title = page?.title ?? ''
  const icon = page?.icon ?? ''
  const navGroup = page?.nav_group ?? 'main'
  const isHome = page?.is_home === 1
  const config = parsePageConfig(page)

  const iconPickerGrid = PRESET_PAGE_ICONS.map((emoji) =>
    `<button type="button" data-click="pageFormPickIcon" data-icon="${escapeHtml(emoji)}" data-page-icon-btn title="${escapeHtml(emoji)}">${escapeHtml(emoji)}</button>`
  ).join('')

  return `
    <form
      data-page-form
      data-submit="pageFormSave"
      data-page-id="${escapeHtml(String(page?.id ?? ''))}"
      data-page-sync-id="${escapeHtml(page?.sync_id ?? '')}"
      data-page-slug="${escapeHtml(page?.slug ?? '')}"
    >
      ${customizerSection({
        title: '',
        section: 'identity',
        children: `
          ${customizerField({
            type: 'text',
            label: t('moduleForm.title'),
            control: `<input type="text" name="page-title" value="${escapeHtml(title)}" placeholder="${escapeHtml(t('app.newPageTitle'))}" autocomplete="off" required>`,
          })}

          <div data-customizer-field>
            <span data-customizer-field-label>${t('pageForm.icon')}</span>
            <div data-page-icon-row>
              <input type="text" name="page-icon" value="${escapeHtml(icon)}" data-page-icon-input>
              <button type="button" data-btn="light" data-click="pageFormToggleIconPicker" data-page-icon-pick-btn>${t('settings.pick')}</button>
            </div>
          </div>

          <div data-icon-picker hidden>
            <div data-icon-picker-grid>
              ${iconPickerGrid}
            </div>
          </div>

          ${customizerField({
            label: t('pageForm.navGroup'),
            control: `
              <select name="page-nav-group">
                <option value="main"${navGroup === 'main' ? ' selected' : ''}>${t('pageForm.navGroupOptions.main')}</option>
                <option value="overflow"${navGroup === 'overflow' ? ' selected' : ''}>${t('pageForm.navGroupOptions.overflow')}</option>
              </select>
            `,
          })}

          ${customizerField({
            type: 'boolean',
            label: t('pageForm.defaultPage'),
            control: `<input type="checkbox" name="page-is-home"${isHome ? ' checked' : ''}>`,
          })}
        `,
      })}

      ${customizerDivider()}

      ${customizerSection({
        title: t('pageForm.sections.layout'),
        section: 'layout',
        children: `
          ${customizerField({
            type: 'integer',
            label: t('pageForm.columns'),
            control: `<input type="number" name="page-modules-per-row" value="${config.modulesPerRow}" min="1" max="12">`,
          })}
          ${customizerField({
            type: 'integer',
            label: t('customizer.fields.shellMaxWidth'),
            control: `<input type="number" name="page-max-width" value="${escapeHtml(String(config.maxWidth ?? ''))}" min="300" max="3840" placeholder="${escapeHtml(t('pageForm.globalDefault'))}">`,
          })}
        `,
      })}

      ${customizerDivider()}

      ${renderFormActions({saveLabel})}
    </form>
  `
}

export function renderModuleCreateForm(page) {
  const defaultSpan = 6
  const spanOptions = Array.from({length: 12}, (_, index) => {
    const value = index + 1
    return `<option value="${value}"${value === defaultSpan ? ' selected' : ''}>${value}</option>`
  }).join('')
  const firstTabValue = escapeHtml(t('moduleCard.newTabTitle'))

  return `
    <form
      data-page-module-form
      data-submit="pageModuleCreateSave"
      data-page-id="${escapeHtml(String(page?.id ?? ''))}"
      data-page-sync-id="${escapeHtml(page?.sync_id ?? '')}"
    >
      ${customizerSection({
        title: '',
        section: 'identity',
        children: `
          ${customizerField({
            label: t('moduleForm.type'),
            control: `
              <select name="module-type" required>
                <option value="tabs">${t('moduleForm.types.tabs')}</option>
                <option value="notes">${t('moduleForm.types.notes')}</option>
                <option value="feeds">${t('moduleForm.types.feeds')}</option>
              </select>
            `,
          })}

          ${customizerField({
            type: 'text',
            label: t('moduleForm.title'),
            control: `
              <input
                type="text"
                name="module-title"
                value=""
                placeholder="${escapeHtml(t('app.newModule'))}"
                autocomplete="off"
                required
              >
            `,
          })}

          ${customizerField({
            type: 'text',
            label: t('moduleForm.firstTabTitle'),
            control: `
              <div data-page-module-tabs-inputs>
                <div data-page-module-tab-row>
                  <input
                    type="text"
                    name="module-first-tab-title"
                    value=""
                    placeholder="${firstTabValue}"
                    autocomplete="off"
                    required
                  >
                  <button
                    type="button"
                    class="st-btn"
                    data-click="addModuleCreateTabInput"
                    data-page-module-add-tab
                    title="${escapeHtml(t('moduleCard.addTab'))}"
                    aria-label="${escapeHtml(t('moduleCard.addTab'))}"
                  >${SPEEDTAB_SVG.plus}</button>
                </div>
              </div>
            `,
          })}

          ${customizerField({
            label: t('customizer.fields.moduleColumnSpan'),
            control: `
              <select name="module-column-span" required>
                ${spanOptions}
              </select>
            `,
          })}
        `,
      })}

      ${customizerDivider()}

      ${renderFormActions({saveLabel: t('moduleForm.createModule')})}
    </form>
  `
}
