import {customizerDivider, customizerField, customizerSection} from '../../ui/primitives.js'
import {escapeHtml} from '../../utils/html.js'
import {t} from '../../utils/i18n.js'
import {renderFormActions} from '../forms/actions.js'
import {renderBackgroundSettingsSection, renderBgArchiveSwatches, renderBgAssetThumbs} from '../settings/render.js'
import {getModuleColumnSpan, getPageGridDefaultSpan} from './modules/render.js'

const PRESET_PAGE_ICONS = [
  '⭕', '⚡', '🏠', '⭐', '📁', '📌', '🧩', '📝', '📚', '📰',
  '📡', '🧠', '💼', '📊', '📈', '🛠️', '🔧', '🎯', '🚀', '🌐',
  '🧭', '🗂️', '📂', '💡', '🔒', '🔖', '🗞️', '🧪', '🎨', '🧵',
  '📷', '🎵', '🎬', '🛒', '💳', '🏦', '🧾', '🧰', '🖥️', '📱',
  '⌨️', '🕹️', '☁️', '🌙', '☀️', '🔥', '🌿', '🌊', '📍', '✅',
]

const DEFAULT_PAGE_GRID_MAX_WIDTH = 1500
const PAGE_BACKGROUND_ARCHIVE_OPTIONS = {
  selectAction: 'loadPageBgArchiveItem',
  deleteAction: 'deleteBgArchiveItem',
}
const PAGE_BACKGROUND_ASSET_OPTIONS = {
  selectAction: 'loadPageBgAsset',
  deleteAction: 'deleteBgAsset',
}

export function renderPageBgArchiveSwatches(items) {
  return renderBgArchiveSwatches(items, PAGE_BACKGROUND_ARCHIVE_OPTIONS)
}

export function renderPageBgAssetThumbs(items) {
  return renderBgAssetThumbs(items, PAGE_BACKGROUND_ASSET_OPTIONS)
}

export function syncPageFormActiveHint(form, activePageSyncId) {
  if (!(form instanceof HTMLFormElement)) return
  const hint = form.querySelector('[data-page-form-inactive-hint]')
  if (!(hint instanceof HTMLElement)) return
  const pageSyncId = form.dataset.pageSyncId ?? ''
  hint.toggleAttribute('hidden', !pageSyncId || !activePageSyncId || pageSyncId === activePageSyncId)
}

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
  const backgroundData = page?.id ? options.backgroundData : null

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

      ${backgroundData ? `
        ${renderBackgroundSettingsSection(backgroundData, {
          textInputAction: 'previewPageBgProperty',
          changeAction: 'savePageBgProperty',
          textInputSettingKey: 'page_background',
          textInputName: 'pageBackgroundProperty',
          clearAction: 'clearPageBgProperty',
          archiveAction: 'archivePageBgProperty',
          uploadAction: 'uploadPageBgWallpaper',
          triggerUploadAction: 'triggerPageWallpaperUpload',
          uploadInputName: 'uploadPageBgWallpaperInput',
          uploadInputId: 'st-page-wallpaper-upload',
          archiveSelectAction: PAGE_BACKGROUND_ARCHIVE_OPTIONS.selectAction,
          archiveDeleteAction: PAGE_BACKGROUND_ARCHIVE_OPTIONS.deleteAction,
          assetSelectAction: PAGE_BACKGROUND_ASSET_OPTIONS.selectAction,
          assetDeleteAction: PAGE_BACKGROUND_ASSET_OPTIONS.deleteAction,
          formStateIgnore: true,
        })}

        ${customizerDivider()}
      ` : ''}

      ${renderFormActions({saveLabel})}
      ${backgroundData ? `<p data-customizer-empty data-page-form-inactive-hint hidden>${escapeHtml(t('pageForm.notActivePage'))}</p>` : ''}
    </form>
  `
}

export function renderModuleCreateForm(page, modules = []) {
  const defaultSpan = 6
  const spanOptions = Array.from({length: 12}, (_, index) => {
    const value = index + 1
    return `<option value="${value}"${value === defaultSpan ? ' selected' : ''}>${value}</option>`
  }).join('')
  const firstTabValue = escapeHtml(t('moduleCard.newTabTitle'))
  const defaultModuleSpan = getPageGridDefaultSpan(page)
  const renderPlacementSlot = (index, checked = false) => `<label data-module-placement-slot title="Insert here">
        <input type="radio" name="module-insert-at" value="${index}"${checked ? ' checked' : ''}>
        <span aria-hidden="true">+</span>
      </label>`
  const placementSlots = modules.length
    ? modules.map((module, index) => {
      const span = getModuleColumnSpan(module, defaultModuleSpan)
      return `${renderPlacementSlot(index)}<span data-module-placement-module data-module-placement-sync-id="${escapeHtml(module.sync_id || '')}" style="--st-module-placement-span: ${escapeHtml(String(span - 1))}">${escapeHtml(module.title || t('moduleForm.types.tabs'))}</span>`
    }).join('') + renderPlacementSlot(modules.length, true)
    : renderPlacementSlot(0, true)

  return `
    <form
      data-page-module-form
      data-module-type="tabs"
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
              <select name="module-type" data-change="pageModuleTypeChange" required>
                <option value="tabs">${t('moduleForm.types.tabs')}</option>
                <option value="speed-dial">${t('moduleForm.types.speedDial')}</option>
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
                  ><i data-icon="plus" aria-hidden="true"></i></button>
                </div>
              </div>
            `,
          })}

          <div data-module-column-span-field>
            ${customizerField({
              label: t('customizer.fields.moduleColumnSpan'),
              control: `
                <select name="module-column-span" required>
                  ${spanOptions}
                </select>
              `,
            })}
          </div>
        `,
      })}

      ${customizerDivider()}

      <div data-form-actions data-module-create-actions>
        <button type="submit" data-btn="primary" data-form-save-btn disabled>${escapeHtml(t('moduleForm.createModule'))}</button>
        <button type="button" data-btn="light" data-click="toggleModuleCreatePlacement" aria-expanded="false">Place</button>
      </div>

      ${customizerDivider()}

      <div data-module-create-placement hidden>
        <div data-module-placement-preview>${placementSlots}</div>
      </div>
    </form>
  `
}
