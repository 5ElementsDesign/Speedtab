import {getUiConfigSpec} from '../../config/ui-config-spec.js'
import {escapeHtml} from '../../utils/html.js'
import {t} from '../../utils/i18n.js'
import {renderBgArchiveSwatches, renderBgAssetThumbs} from '../settings/render.js'
import {contrastRatio, GROUP_PAIR_KEYS, wcagLevel} from './contrast.js'

const FIELD_LABELS = {
  'shell-theme': 'next.customizer.fields.shellTheme',
  'shell-color-accent': 'next.customizer.fields.shellColorAccent',
  'shell-behavior': 'next.customizer.fields.shellBehavior',
  'shell-variant': 'next.customizer.fields.shellVariant',
  'shell-swipe': 'next.customizer.fields.shellSwipe',
  'shell-nav': 'next.customizer.fields.shellNav',
  'shell-reduced-motion': 'next.customizer.fields.shellReducedMotion',
  'shell-no-box-shadow': 'next.customizer.fields.shellNoBoxShadow',
  'module-tabs-color-accent': 'next.customizer.fields.moduleTabsColorAccent',
  'module-tabs-variant': 'next.customizer.fields.moduleTabsVariant',
  'module-tabs-behavior': 'next.customizer.fields.moduleTabsBehavior',
  'module-tabs-swipe-enabled': 'next.customizer.fields.moduleTabsSwipe',
  'module-hide-header': 'next.customizer.fields.moduleHideHeader',
  'module-tabs-show-add-tile': 'moduleForm.showAddTile',
  'module-tabs-quicklinks': 'moduleForm.quicklinksMode',
  'module-tabs-force-favicon': 'moduleForm.forceFavicon',
  'shell-max-width': 'next.customizer.fields.shellMaxWidth',
  'shell-header-height-px': 'next.customizer.fields.shellHeaderHeight',
  'shell-module-gap-px': 'next.customizer.fields.shellModuleGap',
  'module-column-span': 'next.customizer.fields.moduleColumnSpan',
  'module-min-height-px': 'next.customizer.fields.moduleMinHeight',
  '--st-ws-shell-header-background-color': 'next.customizer.fields.shellHeaderBackground',
  '--st-ws-shell-nav-background-color': 'next.customizer.fields.shellNavBackground',
  '--st-ws-shell-nav-active-background-color': 'next.customizer.fields.shellNavActiveBackground',
  '--st-ws-module-background-color': 'next.customizer.fields.moduleBackground',
  '--st-ws-module-shadow-color': 'next.customizer.fields.moduleShadowColor',
  '--st-module-bookmark-preview-background-color': 'next.customizer.fields.bookmarkBackground',
  '--st-ws-shell-header-text-color': 'next.customizer.fields.headerText',
  '--st-ws-shell-nav-text-color': 'next.customizer.fields.textColor',
  '--st-ws-shell-nav-active-text-color': 'next.customizer.fields.textColor',
  '--st-ws-module-text-color': 'next.customizer.fields.textColor',
  '--st-ws-module-header-background-color': 'next.customizer.fields.headerBackground',
  '--st-ws-module-header-text-color': 'next.customizer.fields.headerText',
  '--st-ws-module-content-background-color': 'next.customizer.fields.contentBackground',
  '--st-ws-module-content-text-color': 'next.customizer.fields.contentText',
}

export const INLINE_COLOR_FIELD_PAIRS = {
  '--st-ws-shell-header-background-color': '--st-ws-shell-header-text-color',
  '--st-ws-shell-nav-background-color': '--st-ws-shell-nav-text-color',
  '--st-ws-shell-nav-active-background-color': '--st-ws-shell-nav-active-text-color',
}

export const INLINE_COLOR_FIELD_SECONDARIES = new Set(Object.values(INLINE_COLOR_FIELD_PAIRS))

export const SHELL_SYNC_ID = 'app-shell'

const OPTION_LABELS = {
  fade: 'next.customizer.options.fade',
  'slide-up': 'next.customizer.options.slideUp',
  'slide-down': 'next.customizer.options.slideDown',
  'slide-left': 'next.customizer.options.slideLeft',
  'slide-right': 'next.customizer.options.slideRight',
  zoom: 'next.customizer.options.zoom',
  blur: 'next.customizer.options.blur',
  flip: 'next.customizer.options.flip',
  instant: 'next.customizer.options.instant',
  default: 'next.customizer.options.default',
  minimal: 'next.customizer.options.minimal',
  light: 'next.customizer.options.light',
  dark: 'next.customizer.options.dark',
  primary: 'next.customizer.options.primary',
  secondary: 'next.customizer.options.secondary',
  success: 'next.customizer.options.success',
  warning: 'next.customizer.options.warning',
  danger: 'next.customizer.options.danger',
  'new-tab': 'next.customizer.options.newTab',
  'same-tab': 'next.customizer.options.sameTab',
  top: 'next.customizer.options.top',
  left: 'next.customizer.options.left',
  right: 'next.customizer.options.right',
  bottom: 'next.customizer.options.bottom',
}

// Fallbacks used when a value is not yet set, for contrast preview only
const BG_FALLBACK = '#121315'
const TEXT_FALLBACK = '#e5e7eb'

function getModuleTypeLabel(type) {
  if (type === 'tabs' || type === 'notes' || type === 'feeds') return t(`app.moduleTypes.${type}`)
  return type || t('next.modules.untitled')
}

function toColorInputValue(value) {
  if (!value) return ''
  if (/^#[0-9a-fA-F]{6,8}$/.test(value)) return value
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const [, r, g, b] = value
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return ''
}

function toBackgroundColorInputValue(value) {
  return toColorInputValue(value?.trim?.() ?? value)
}

function renderBooleanField(key, spec, value, section) {
  const checked = value == null ? spec.defaultValue === true : value === true
  return `
    <label data-customizer-field data-customizer-field-type="boolean">
      <span data-customizer-field-label>${escapeHtml(t(FIELD_LABELS[key] ?? key))}</span>
      <input
        type="checkbox"
        name="${escapeHtml(key)}"
        data-change="customizerChange"
        data-config-section="${escapeHtml(section)}"
        ${checked ? 'checked' : ''}
      >
    </label>
  `
}

function renderEnumField(key, spec, value, section) {
  const options = (spec.allowedValues ?? []).map((v) =>
    `<option value="${escapeHtml(v)}"${value === v ? ' selected' : ''}>${escapeHtml(t(OPTION_LABELS[v] ?? v))}</option>`
  ).join('')
  return `
    <label data-customizer-field data-customizer-field-type="enum">
      <span data-customizer-field-label>${escapeHtml(t(FIELD_LABELS[key] ?? key))}</span>
      <select name="${escapeHtml(key)}" data-change="customizerChange" data-config-section="${escapeHtml(section)}">
        <option value="">${escapeHtml(t('next.customizer.defaultOption'))}</option>
        ${options}
      </select>
    </label>
  `
}

function renderIntegerField(key, spec, value, section) {
  const min = spec.min != null ? ` min="${spec.min}"` : ''
  const max = spec.max != null ? ` max="${spec.max}"` : ''
  return `
    <label data-customizer-field data-customizer-field-type="integer">
      <span data-customizer-field-label>${escapeHtml(t(FIELD_LABELS[key] ?? key))}</span>
      <input
        type="number"
        name="${escapeHtml(key)}"
        value="${escapeHtml(String(value ?? spec.defaultValue ?? ''))}"${min}${max}
        data-change="customizerChange"
        data-config-section="${escapeHtml(section)}"
        data-value-type="integer"
      >
    </label>
  `
}

function renderTextField({name, label, value = '', action = '', section = ''}) {
  const actionAttrs = action
    ? ` data-input="${escapeHtml(action)}" data-change="${escapeHtml(action)}"`
    : ''
  const sectionAttr = section ? ` data-config-section="${escapeHtml(section)}"` : ''
  return `
    <label data-customizer-field data-customizer-field-type="text">
      <span data-customizer-field-label>${escapeHtml(label)}</span>
      <input
        type="text"
        name="${escapeHtml(name)}"
        value="${escapeHtml(value)}"
        autocomplete="off"${actionAttrs}${sectionAttr}
      >
    </label>
  `
}

function renderColorInput(key, value, sectionName, extraAttrs = '') {
  const hexValue = toColorInputValue(value)
  return `<div data-color-item${extraAttrs ? ` ${extraAttrs}` : ''}>
    <input type="text" name="${escapeHtml(key)}" value="${escapeHtml(hexValue)}" data-coloris
      data-input-immediate="customizerChange" data-config-section="${escapeHtml(sectionName)}">
    <button type="button" data-click="customizerClearColor" data-config-section="${escapeHtml(sectionName)}"
      data-field-name="${escapeHtml(key)}" data-customizer-clear title="${escapeHtml(t('next.customizer.reset'))}" aria-label="${escapeHtml(t('next.customizer.reset'))}">&times;</button>
  </div>`
}

function renderColorField(key, spec, value, section, sectionValues = {}) {
  const pairKey = INLINE_COLOR_FIELD_PAIRS[key]
  const pairValue = pairKey ? (sectionValues?.[pairKey] ?? '') : ''
  const showPair = pairKey && (value || pairValue)
  return `
    <div data-customizer-field data-customizer-field-type="color">
      <span data-customizer-field-label>${escapeHtml(t(FIELD_LABELS[key] ?? key))}</span>
      <div data-color-pair-row>
        ${renderColorInput(key, value, section)}
        ${pairKey ? renderColorInput(
          pairKey,
          pairValue,
          section,
          `data-inline-secondary-for="${escapeHtml(key)}"${showPair ? '' : ' style="display:none"'}`
        ) : ''}
      </div>
    </div>
  `
}

function renderField(key, spec, value, section, sectionValues = {}) {
  if (spec.valueType === 'boolean') return renderBooleanField(key, spec, value, section)
  if (spec.valueType === 'enum') return renderEnumField(key, spec, value, section)
  if (spec.valueType === 'integer') return renderIntegerField(key, spec, value, section)
  if (spec.valueType === 'color') return renderColorField(key, spec, value, section, sectionValues)
  return ''
}

function renderContrastBadge(bgValue, textValue, groupId) {
  const hasBg = !!bgValue
  const hasText = !!textValue
  const effectiveBg = hasBg ? bgValue : BG_FALLBACK
  const effectiveText = hasText ? textValue : TEXT_FALLBACK
  const usingFallback = !hasBg || !hasText

  const ratio = contrastRatio(effectiveBg, effectiveText)
  if (ratio === null) return ''

  const level = wcagLevel(ratio)
  const pass = level !== 'Fail'
  const fallbackAttr = usingFallback ? ' data-fallback' : ''

  return `<div data-customizer-contrast-badge data-group="${escapeHtml(groupId)}" data-pass="${pass}"${fallbackAttr}><span data-contrast-preview style="--st-contrast-preview-bg:${effectiveBg};--st-contrast-preview-color:${effectiveText};" aria-hidden="true">Aa</span><span data-contrast-ratio>${ratio.toFixed(1)}:1${usingFallback ? `<span data-fallback-mark title="${escapeHtml(t('next.customizer.fallbackHint'))}">~</span>` : ''}</span><span data-contrast-level>${escapeHtml(level ?? '—')}</span></div>`
}

function renderSection(sectionName, sectionSpec, sectionValues) {
  const fields = Object.entries(sectionSpec)
    .map(([key, spec]) => {
      if (spec.valueType === 'color' && INLINE_COLOR_FIELD_SECONDARIES.has(key)) return ''
      const divider = spec.dividerAbove ? '<div data-customizer-divider aria-hidden="true"></div>' : ''
      return divider + renderField(key, spec, sectionValues?.[key], sectionName, sectionValues)
    })
    .join('')
  return `
    <div data-customizer-section data-section="${escapeHtml(sectionName)}">
      <p data-customizer-section-title>${escapeHtml(t(`next.customizer.sections.${sectionName}`))}</p>
      ${fields}
    </div>
  `
}

function renderColorPairRow(bgKey, bgValue, textKey, textValue, sectionName, groupId) {
  const badge = renderContrastBadge(bgValue, textValue, groupId)
  const showTextColor = !!(bgValue || textValue)
  return `
    <div data-customizer-field data-customizer-field-type="color">
      <span data-customizer-field-label>${escapeHtml(t(FIELD_LABELS[bgKey] ?? bgKey))}</span>
      <div data-color-pair-row>
      ${renderColorInput(bgKey, bgValue, sectionName)}
      ${showTextColor ? renderColorInput(textKey, textValue, sectionName) : ''}
      ${badge}
      </div>
    </div>
  `
}

function renderGroupedSection(sectionName, sectionSpec, sectionValues) {
  const groups = new Map()
  const standalone = []

  for (const [key, spec] of Object.entries(sectionSpec)) {
    if (spec.group) {
      if (!groups.has(spec.group)) groups.set(spec.group, [])
      groups.get(spec.group).push([key, spec])
    } else {
      standalone.push([key, spec])
    }
  }

  if (!groups.size) return renderSection(sectionName, sectionSpec, sectionValues)

  const standaloneHtml = standalone
    .map(([key, spec]) => renderField(key, spec, sectionValues?.[key], sectionName))
    .join('')

  let groupIdx = 0
  const groupsHtml = [...groups.entries()].map(([groupId, entries]) => {
    const needsDivider = groupIdx > 0 || standalone.length > 0
    groupIdx++

    const bgEntry = entries.find(([k]) => k.includes('background'))
    const textEntry = entries.find(([k]) => k.includes('text'))
    const otherEntries = entries.filter(([k]) => !k.includes('background') && !k.includes('text'))

    const bgValue = bgEntry ? (sectionValues?.[bgEntry[0]] ?? '') : ''
    const textValue = textEntry ? (sectionValues?.[textEntry[0]] ?? '') : ''

    const divider = needsDivider ? '<div data-customizer-divider aria-hidden="true"></div>' : ''
    const groupLabel = t(`next.customizer.groups.${groupId}`)

    const pairRow = (bgEntry && textEntry)
      ? renderColorPairRow(bgEntry[0], bgValue, textEntry[0], textValue, sectionName, groupId)
      : (bgEntry || textEntry)
        ? `<div data-customizer-field data-customizer-field-type="color"><span data-customizer-field-label>${escapeHtml(groupLabel)}</span><div data-color-pair-row>${renderColorInput(bgEntry?.[0] ?? textEntry[0], bgEntry ? bgValue : textValue, sectionName)}</div></div>`
        : ''

    const otherHtml = otherEntries.map(([key, spec]) =>
      renderField(key, spec, sectionValues?.[key], sectionName)
    ).join('')

    return `${divider}
      <div data-customizer-color-group data-group="${escapeHtml(groupId)}">
        <div data-color-group-header>
          <span data-color-group-label>${escapeHtml(groupLabel)}</span>
          <button type="button" data-click="customizerResetGroup" data-config-section="${escapeHtml(sectionName)}" data-group="${escapeHtml(groupId)}" data-customizer-reset-group aria-label="${escapeHtml(t('next.customizer.resetGroupAria', {group: groupLabel}))}" title="${escapeHtml(t('next.customizer.reset'))}">↺</button>
        </div>
        ${pairRow}${otherHtml}
      </div>`
  }).join('')

  return `
    <div data-customizer-section data-section="${escapeHtml(sectionName)}">
      <p data-customizer-section-title>${escapeHtml(t(`next.customizer.sections.${sectionName}`))}</p>
      ${standaloneHtml}${groupsHtml}
    </div>
  `
}

// Called from customizer actions after a color change to refresh the badge
export function updateContrastBadgeDOM(groupId, appearanceValues) {
  const sidepanel = document.querySelector('[data-sidepanel][data-sidepanel-open]')
  if (!sidepanel) return
  const badge = sidepanel.querySelector(`[data-customizer-contrast-badge][data-group="${CSS.escape(groupId)}"]`)
  if (!badge) return
  const pairKeys = GROUP_PAIR_KEYS[groupId]
  if (!pairKeys) return
  const bgValue = appearanceValues?.[pairKeys.bg] ?? ''
  const textValue = appearanceValues?.[pairKeys.text] ?? ''
  const temp = document.createElement('div')
  temp.innerHTML = renderContrastBadge(bgValue, textValue, groupId)
  const newBadge = temp.firstElementChild
  if (newBadge) badge.replaceWith(newBadge)
}

export function renderCustomizerList(moduleCards, shellHasConfig = false, pageLabel = t('nav.page'), pageSyncId = '', showResetOptions = false) {
  const renderListRow = ({action, label, type, syncId = '', moduleType = '', pageSyncIdValue = '', showReset = false}) => `
    <div data-customizer-list-row>
      <button
        type="button"
        data-click="${escapeHtml(action)}"
        ${syncId ? `data-sync-id="${escapeHtml(syncId)}"` : ''}
        ${moduleType ? `data-module-type="${escapeHtml(moduleType)}"` : ''}
        ${pageSyncIdValue ? `data-page-sync-id="${escapeHtml(pageSyncIdValue)}"` : ''}
        data-customizer-list-item
      >
        <span data-customizer-list-item-label>${escapeHtml(label)}</span>
        ${showReset ? '<span data-customizer-config-dot></span>' : ''}
        <span data-customizer-list-item-type>${escapeHtml(type)}</span>
      </button>
      ${showReset && showResetOptions ? `<button
        type="button"
        data-click="customizerResetStyles"
        data-reset-sync-id="${escapeHtml(syncId)}"
        data-reset-module-type="${escapeHtml(moduleType)}"
        data-reset-label="${escapeHtml(label)}"
        title="${escapeHtml(t('next.customizer.resetStyle'))}"
        aria-label="${escapeHtml(t('next.customizer.resetStyle'))}"
        data-customizer-list-reset
      >${escapeHtml(t('next.customizer.resetStyle'))}</button>` : ''}
    </div>
  `

  const shellItem = renderListRow({
    action: 'openCustomizerFor',
    label: t('app.shell'),
    type: t('next.customizer.types.shell'),
    syncId: SHELL_SYNC_ID,
    moduleType: 'app',
    showReset: shellHasConfig,
  })

  const pageItem = pageSyncId ? `
    ${renderListRow({
      action: 'openPageForm',
      label: pageLabel,
      type: t('next.customizer.types.page'),
      pageSyncIdValue: pageSyncId,
      showReset: false,
    })}
  ` : `<p data-customizer-list-section>${escapeHtml(pageLabel)}</p>`

  const moduleItems = moduleCards.map((card) => {
    const title = card.querySelector('[data-module-card-title]')?.textContent?.trim() ?? t('next.modules.untitled')
    const syncId = escapeHtml(card.dataset.syncId)
    const moduleType = escapeHtml(card.dataset.moduleType ?? '')
    const hasConfig = card.hasAttribute('data-ui-configured')
    return renderListRow({
      action: 'openCustomizerFor',
      label: title,
      type: getModuleTypeLabel(moduleType),
      syncId,
      moduleType,
      showReset: hasConfig,
    })
  }).join('')

  return `
    <div data-customizer-list>
      ${shellItem}
      <div data-customizer-divider aria-hidden="true"></div>
      ${pageItem}
      <div data-customizer-divider aria-hidden="true"></div>
      ${moduleItems}
    </div>
  `
}

function renderShellBackgroundSection(bgData) {
  const {background_properties = '', bgArchive = [], bgAssets = []} = bgData ?? {}
  const backgroundColorValue = toBackgroundColorInputValue(background_properties)
  return `
    <div data-customizer-section data-section="background">
      <p data-customizer-section-title>${t('next.customizer.sections.background')}</p>
      <div data-customizer-field data-customizer-field-layout="background-input">
        <div data-color-item>
          <input
            type="text"
            name="previewBgPropertyColorInput"
            data-coloris
            data-input-immediate="previewBgProperty"
            data-change="changeAppSetting"
            data-setting-key="background_properties"
            data-bg-color-input
            value="${escapeHtml(backgroundColorValue)}"
          >
          <button
            type="button"
            data-click="clearBgProperty"
            data-customizer-clear
            title="${escapeHtml(t('next.customizer.reset'))}"
            aria-label="${escapeHtml(t('next.customizer.reset'))}"
          >&times;</button>
        </div>
        <input
          type="text"
          name="previewBgPropertyInput"
          class="w-100"
          data-input="previewBgProperty"
          data-change="changeAppSetting"
          data-setting-key="background_properties"
          data-bg-property-input
          value="${escapeHtml(background_properties)}"
          placeholder="${escapeHtml(t('next.customizer.backgroundPlaceholder'))}"
        />
        <button type="button" data-btn="primary" data-click="archiveBgProperty" data-customizer-compact-btn>${t('next.customizer.archive')}</button>
        <button type="button" data-btn="warning" data-click="clearBgProperty" data-customizer-compact-btn>${t('settings.clear')}</button>
      </div>
      ${bgArchive.length
        ? `<div data-bg-archive-list>${renderBgArchiveSwatches(bgArchive)}</div>`
        : '<div data-bg-archive-list></div>'}
      <div data-customizer-field data-customizer-field-layout="stack" data-customizer-gap="md">
        <label data-customizer-upload-row>
          <span data-customizer-field-label>${t('next.customizer.uploadWallpaper')}</span>
          <input type="file" name="uploadBgWallpaperInput" accept="image/*" data-change="uploadBgWallpaper" hidden id="st-wallpaper-upload">
          <button type="button" data-click="triggerWallpaperUpload" data-customizer-compact-btn>${t('next.customizer.chooseImage')}</button>
        </label>
      </div>
      ${bgAssets.length
        ? `<div data-bg-asset-list>${renderBgAssetThumbs(bgAssets)}</div>`
        : '<div data-bg-asset-list></div>'}
    </div>
  `
}

function renderModuleIdentitySection(moduleTitle = '') {
  return `
    <div data-customizer-section data-section="identity">
      <p data-customizer-section-title>${escapeHtml(t('next.moduleCrud.sections.identity'))}</p>
      ${renderTextField({
        name: 'module-title',
        label: t('moduleForm.title'),
        value: moduleTitle,
        action: 'customizerModuleTitleChange',
        section: 'identity',
      })}
    </div>
  `
}

const SECTION_DIVIDER = '<div data-customizer-divider aria-hidden="true"></div>'

function omitFields(sectionSpec, keys = []) {
  if (!keys.length) return sectionSpec
  return Object.fromEntries(
    Object.entries(sectionSpec).filter(([key]) => !keys.includes(key))
  )
}

export function renderCustomizerForm(entityType, moduleType, config = {}, bgData = null, moduleData = null, effectiveConfig = config) {
  const spec = getUiConfigSpec(entityType, moduleType)
  const sections = []
  const behaviorSpec = entityType === 'shell'
    ? omitFields(spec.behavior, ['shell-theme'])
    : spec.behavior

  if (entityType === 'module') {
    sections.push(renderModuleIdentitySection(moduleData?.title ?? ''))
  }
  if (Object.keys(behaviorSpec).length) {
    sections.push(renderSection('behavior', behaviorSpec, config.behavior))
  }
  if (Object.keys(spec.layout).length) {
    sections.push(renderSection('layout', spec.layout, config.layout))
  }
  if (Object.keys(spec.appearance).length) {
    sections.push(renderGroupedSection('appearance', spec.appearance, effectiveConfig.appearance))
  }
  if (entityType === 'shell') {
    sections.push(renderShellBackgroundSection(bgData))
  }

  return `<div data-customizer-form>${sections.join(SECTION_DIVIDER)}</div>`
}
