import {getUiConfigSpec} from '../../config/ui-config-spec.js'
import {escapeHtml} from '../../utils/html.js'
import {t} from '../../utils/i18n.js'
import {renderBackgroundSettingsSection} from '../settings/render.js'
import {contrastRatio, GROUP_PAIR_KEYS, wcagLevel} from './contrast.js'

const FIELD_LABELS = {
  'shell-theme': 'customizer.fields.shellTheme',
  'shell-color-accent': 'customizer.fields.shellColorAccent',
  'shell-behavior': 'customizer.fields.shellBehavior',
  'shell-variant': 'customizer.fields.shellVariant',
  'shell-tabs-align': 'customizer.fields.moduleTabsAlign',
  'shell-tabs-grow': 'customizer.fields.moduleTabsGrow',
  'shell-swipe': 'customizer.fields.shellSwipe',
  'shell-reduced-motion': 'customizer.fields.shellReducedMotion',
  'shell-no-box-shadow': 'customizer.fields.shellNoBoxShadow',
  'module-tabs-color-accent': 'customizer.fields.moduleTabsColorAccent',
  'module-tabs-variant': 'customizer.fields.moduleTabsVariant',
  'module-tabs-behavior': 'customizer.fields.moduleTabsBehavior',
  'module-tabs-swipe-enabled': 'customizer.fields.moduleTabsSwipe',
  'module-tabs-grow': 'customizer.fields.moduleTabsGrow',
  'module-tabs-align': 'customizer.fields.moduleTabsAlign',
  'module-hide-header': 'customizer.fields.moduleHideHeader',
  'module-tabs-show-add-tile': 'moduleForm.showAddTile',
  'module-tabs-quicklinks': 'moduleForm.quicklinksMode',
  'module-tabs-force-favicon': 'moduleForm.forceFavicon',
  'module-tabs-show-title-below': 'moduleForm.showTitleBelow',
  'shell-max-width': 'customizer.fields.shellMaxWidth',
  'shell-header-height-px': 'customizer.fields.shellHeaderHeight',
  'shell-module-gap-px': 'customizer.fields.shellModuleGap',
  'shell-module-content-gap-px': 'customizer.fields.shellModuleContentGap',
  'module-column-span': 'customizer.fields.moduleColumnSpan',
  'module-content-gap-px': 'customizer.fields.moduleContentGap',
  'module-min-height-px': 'customizer.fields.moduleMinHeight',
  '--st-ws-shell-header-background-color': 'customizer.fields.shellHeaderBackground',
  '--st-ws-shell-nav-background-color': 'customizer.fields.shellNavBackground',
  '--st-ws-shell-nav-active-background-color': 'customizer.fields.shellNavActiveBackground',
  '--st-ws-module-background-color': 'customizer.fields.moduleBackground',
  '--st-ws-module-shadow-color': 'customizer.fields.moduleShadowColor',
  '--st-module-bookmark-preview-background-color': 'customizer.fields.bookmarkBackground',
  '--st-module-bookmark-preview-text-color': 'customizer.fields.textColor',
  '--st-notes-preview-content-bg': 'customizer.fields.notePreviewBackground',
  '--st-notes-preview-content-color': 'customizer.fields.notePreviewText',
  '--st-notes-preview-content-font-scale': 'customizer.fields.notePreviewFontScale',
  '--st-notes-open-content-bg': 'customizer.fields.noteOpenBackground',
  '--st-notes-open-content-color': 'customizer.fields.noteOpenText',
  '--st-notes-open-link-color': 'customizer.fields.noteOpenLinkColor',
  '--st-notes-open-content-font-scale': 'customizer.fields.noteOpenFontScale',
  '--st-ws-shell-header-text-color': 'customizer.fields.headerText',
  '--st-ws-shell-nav-text-color': 'customizer.fields.textColor',
  '--st-ws-shell-nav-active-text-color': 'customizer.fields.textColor',
  '--st-ws-module-text-color': 'customizer.fields.textColor',
  '--st-ws-module-header-background-color': 'customizer.fields.headerBackground',
  '--st-ws-module-header-text-color': 'customizer.fields.headerText',
  '--st-ws-module-content-background-color': 'customizer.fields.contentBackground',
  '--st-ws-module-content-text-color': 'customizer.fields.contentText',
}

export const INLINE_COLOR_FIELD_PAIRS = {
  '--st-ws-shell-header-background-color': '--st-ws-shell-header-text-color',
  '--st-ws-shell-nav-background-color': '--st-ws-shell-nav-text-color',
  '--st-ws-shell-nav-active-background-color': '--st-ws-shell-nav-active-text-color',
  '--st-module-bookmark-preview-background-color': '--st-module-bookmark-preview-text-color',
  '--st-notes-preview-content-bg': '--st-notes-preview-content-color',
  '--st-notes-open-content-bg': '--st-notes-open-content-color',
}

export const INLINE_COLOR_FIELD_SECONDARIES = new Set(Object.values(INLINE_COLOR_FIELD_PAIRS))

export const SHELL_SYNC_ID = 'app-shell'

const OPTION_LABELS = {
  fade: 'customizer.options.fade',
  'slide-up': 'customizer.options.slideUp',
  'slide-down': 'customizer.options.slideDown',
  'slide-left': 'customizer.options.slideLeft',
  'slide-right': 'customizer.options.slideRight',
  zoom: 'customizer.options.zoom',
  blur: 'customizer.options.blur',
  flip: 'customizer.options.flip',
  instant: 'customizer.options.instant',
  default: 'customizer.options.default',
  minimal: 'customizer.options.minimal',
  light: 'customizer.options.light',
  dark: 'customizer.options.dark',
  primary: 'customizer.options.primary',
  secondary: 'customizer.options.secondary',
  success: 'customizer.options.success',
  warning: 'customizer.options.warning',
  danger: 'customizer.options.danger',
  'new-tab': 'customizer.options.newTab',
  'same-tab': 'customizer.options.sameTab',
  left: 'customizer.options.left',
  center: 'customizer.options.center',
  right: 'customizer.options.right',
}

const FIELD_DISPLAY_DEFAULTS = {
  'shell-max-width': '1500px',
  'shell-header-height-px': '44px',
  'shell-module-gap-px': '20px',
  'shell-module-content-gap-px': '4px',
  '--st-notes-preview-content-font-scale': '100%',
  '--st-notes-open-content-font-scale': '100%',
}

const APPEARANCE_FIELD_ORDER = [
  '--st-ws-module-background-color',
  '--st-ws-shell-header-background-color',
  '--st-ws-shell-nav-background-color',
  '--st-ws-shell-nav-active-background-color',
  '--st-module-bookmark-preview-background-color',
  '--st-ws-module-shadow-color',
  '--st-notes-preview-content-bg',
  '--st-notes-open-content-bg',
]

const SHELL_APPEARANCE_FIELDS = [
  '--st-ws-shell-header-background-color',
  '--st-ws-shell-header-text-color',
  '--st-ws-shell-nav-background-color',
  '--st-ws-shell-nav-text-color',
  '--st-ws-shell-nav-active-background-color',
  '--st-ws-shell-nav-active-text-color',
  '--st-ws-module-background-color',
  '--st-ws-module-shadow-color',
  '--st-module-bookmark-preview-background-color',
  '--st-module-bookmark-preview-text-color',
]

// Fallbacks used when a value is not yet set, for contrast preview only
const BG_FALLBACK = '#121315'
const TEXT_FALLBACK = '#e5e7eb'
const GROUP_FALLBACKS = {
  notePreview: {bg: '#ffffff', text: '#222222'},
  noteOpen: {bg: '#ffffff', text: '#222222'},
}

function getModuleTypeLabel(type) {
  if (type === 'tabs' || type === 'notes' || type === 'feeds') return t(`app.moduleTypes.${type}`)
  return type || t('modules.untitled')
}

function getOrderedEntries(entries = []) {
  return [...entries].sort(([a], [b]) => {
    const aIdx = APPEARANCE_FIELD_ORDER.indexOf(a)
    const bIdx = APPEARANCE_FIELD_ORDER.indexOf(b)
    const aRank = aIdx === -1 ? Number.MAX_SAFE_INTEGER : aIdx
    const bRank = bIdx === -1 ? Number.MAX_SAFE_INTEGER : bIdx
    if (aRank !== bRank) return aRank - bRank
    return a.localeCompare(b)
  })
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

function getFieldLabel(key) {
  const baseLabel = t(FIELD_LABELS[key] ?? key)
  const displayDefault = FIELD_DISPLAY_DEFAULTS[key]
  if (!displayDefault) return escapeHtml(baseLabel)
  return `${escapeHtml(baseLabel)} <span data-customizer-field-default>${escapeHtml(t('customizer.defaultValue', {value: displayDefault}))}</span>`
}

function renderBooleanField(key, spec, value, section) {
  const checked = value == null ? spec.defaultValue === true : value === true
  return `
    <label data-customizer-field data-customizer-field-type="boolean">
      <span data-customizer-field-label>${getFieldLabel(key)}</span>
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
      <span data-customizer-field-label>${getFieldLabel(key)}</span>
      <select name="${escapeHtml(key)}" data-change="customizerChange" data-config-section="${escapeHtml(section)}">
        <option value="">${escapeHtml(t('customizer.defaultOption'))}</option>
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
      <span data-customizer-field-label>${getFieldLabel(key)}</span>
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
      data-field-name="${escapeHtml(key)}" data-customizer-clear title="${escapeHtml(t('customizer.reset'))}" aria-label="${escapeHtml(t('customizer.reset'))}">&times;</button>
  </div>`
}

function renderColorField(key, spec, value, section, sectionValues = {}) {
  const pairKey = INLINE_COLOR_FIELD_PAIRS[key]
  const pairValue = pairKey ? (sectionValues?.[pairKey] ?? '') : ''
  const showPair = pairKey && (value || pairValue)
  return `
    <div data-customizer-field data-customizer-field-type="color">
      <span data-customizer-field-label>${getFieldLabel(key)}</span>
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

function renderStandaloneColorField(key, value, section) {
  return `
    <div data-customizer-field data-customizer-field-type="color">
      <span data-customizer-field-label>${getFieldLabel(key)}</span>
      <div data-color-pair-row>
        ${renderColorInput(key, value, section)}
      </div>
    </div>
  `
}

function renderStandaloneAppearanceFields(sectionName, sectionSpec, sectionValues, keys = []) {
  return keys
    .filter((key) => key in sectionSpec)
    .map((key) => {
      const spec = sectionSpec[key]
      const divider = spec.dividerAbove ? '<div data-customizer-divider aria-hidden="true"></div>' : ''
      return divider + renderField(key, spec, sectionValues?.[key], sectionName, sectionValues)
    })
    .join('')
}

function renderStandaloneGroup(sectionName, groupId, groupLabel, innerHtml) {
  return `
    <div data-customizer-color-group data-group="${escapeHtml(groupId)}">
      <div data-color-group-header>
        <span data-color-group-label>${escapeHtml(groupLabel)}</span>
        <div data-customizer-group-actions>
          <button type="button" data-click="customizerResetGroup" data-config-section="${escapeHtml(sectionName)}" data-group="${escapeHtml(groupId)}" data-customizer-reset-group aria-label="${escapeHtml(t('customizer.resetGroupAria', {group: groupLabel}))}" title="${escapeHtml(t('customizer.reset'))}">↺</button>
        </div>
      </div>
      ${innerHtml}
    </div>
  `
}

function renderShellAppearancePanelSection(sectionName, sectionSpec, sectionValues) {
  const shellBlock = renderStandaloneGroup(
    sectionName,
    'shellAppearance',
    t('common.appearance'),
    renderStandaloneAppearanceFields(sectionName, sectionSpec, sectionValues, [
      '--st-ws-shell-header-background-color',
      '--st-ws-shell-nav-background-color',
      '--st-ws-shell-nav-active-background-color',
      '--st-ws-module-background-color',
      '--st-ws-module-shadow-color',
    ]),
  )

  const bookmarkBlock = renderStandaloneGroup(
    sectionName,
    'bookmarkSurface',
    t('customizer.groups.bookmarkSurface'),
    renderStandaloneAppearanceFields(sectionName, sectionSpec, sectionValues, [
      '--st-module-bookmark-preview-background-color',
    ]),
  )

  const noteSpec = {
    '--st-notes-preview-content-bg': sectionSpec['--st-notes-preview-content-bg'],
    '--st-notes-preview-content-color': sectionSpec['--st-notes-preview-content-color'],
    '--st-notes-preview-content-font-scale': sectionSpec['--st-notes-preview-content-font-scale'],
    '--st-notes-open-content-bg': sectionSpec['--st-notes-open-content-bg'],
    '--st-notes-open-content-color': sectionSpec['--st-notes-open-content-color'],
    '--st-notes-open-link-color': sectionSpec['--st-notes-open-link-color'],
    '--st-notes-open-content-font-scale': sectionSpec['--st-notes-open-content-font-scale'],
  }

  const notesHtml = renderExpandedGroupedSection(sectionName, noteSpec, sectionValues)
    .replace(/^<div data-customizer-section[^>]*>/, '')
    .replace(/<\/div>\s*$/, '')

  return `
    <div data-customizer-section data-section="${escapeHtml(sectionName)}">
      ${shellBlock}
      <div data-customizer-divider aria-hidden="true"></div>
      ${bookmarkBlock}
      <div data-customizer-divider aria-hidden="true"></div>
      ${notesHtml}
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
  const groupFallback = GROUP_FALLBACKS[groupId] ?? {}
  const hasBg = !!bgValue
  const hasText = !!textValue
  const effectiveBg = hasBg ? bgValue : (groupFallback.bg ?? BG_FALLBACK)
  const effectiveText = hasText ? textValue : (groupFallback.text ?? TEXT_FALLBACK)
  const usingFallback = !hasBg || !hasText

  const ratio = contrastRatio(effectiveBg, effectiveText)
  if (ratio === null) return ''

  const level = wcagLevel(ratio)
  const pass = level !== 'Fail'
  const fallbackAttr = usingFallback ? ' data-fallback' : ''

  return `<div data-customizer-contrast-badge data-group="${escapeHtml(groupId)}" data-pass="${pass}"${fallbackAttr}><span data-contrast-preview style="--st-contrast-preview-bg:${effectiveBg};--st-contrast-preview-color:${effectiveText};" aria-hidden="true">Aa</span><span data-contrast-ratio>${ratio.toFixed(1)}:1${usingFallback ? `<span data-fallback-mark title="${escapeHtml(t('customizer.fallbackHint'))}">~</span>` : ''}</span><span data-contrast-level>${escapeHtml(level ?? '—')}</span></div>`
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
      <p data-customizer-section-title>${escapeHtml(t(`customizer.sections.${sectionName}`))}</p>
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

  for (const [key, spec] of getOrderedEntries(Object.entries(sectionSpec))) {
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

    const pairKeys = GROUP_PAIR_KEYS[groupId]
    const bgEntry = pairKeys
      ? entries.find(([k]) => k === pairKeys.bg)
      : entries.find(([k]) => k.includes('background'))
    const textEntry = pairKeys
      ? entries.find(([k]) => k === pairKeys.text)
      : entries.find(([k]) => k.includes('text'))
    const otherEntries = entries.filter(([k]) => {
      if (pairKeys) return k !== pairKeys.bg && k !== pairKeys.text
      return !k.includes('background') && !k.includes('text')
    })

    const bgValue = bgEntry ? (sectionValues?.[bgEntry[0]] ?? '') : ''
    const textValue = textEntry ? (sectionValues?.[textEntry[0]] ?? '') : ''

    const divider = needsDivider ? '<div data-customizer-divider aria-hidden="true"></div>' : ''
    const groupLabel = t(`customizer.groups.${groupId}`)

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
          <button type="button" data-click="customizerResetGroup" data-config-section="${escapeHtml(sectionName)}" data-group="${escapeHtml(groupId)}" data-customizer-reset-group aria-label="${escapeHtml(t('customizer.resetGroupAria', {group: groupLabel}))}" title="${escapeHtml(t('customizer.reset'))}">↺</button>
        </div>
        ${pairRow}${otherHtml}
      </div>`
  }).join('')

  return `
    <div data-customizer-section data-section="${escapeHtml(sectionName)}">
      <p data-customizer-section-title>${escapeHtml(t(`customizer.sections.${sectionName}`))}</p>
      ${standaloneHtml}${groupsHtml}
    </div>
  `
}

function renderExpandedGroupedSection(sectionName, sectionSpec, sectionValues) {
  const groups = new Map()
  const standalone = []

  for (const [key, spec] of getOrderedEntries(Object.entries(sectionSpec))) {
    if (spec.group) {
      if (!groups.has(spec.group)) groups.set(spec.group, [])
      groups.get(spec.group).push([key, spec])
    } else {
      standalone.push([key, spec])
    }
  }

  if (!groups.size) return renderSection(sectionName, sectionSpec, sectionValues)

  const standaloneHtml = standalone
    .filter(([key, spec]) => !(spec.valueType === 'color' && INLINE_COLOR_FIELD_SECONDARIES.has(key)))
    .map(([key, spec]) => {
      const divider = spec.dividerAbove ? '<div data-customizer-divider aria-hidden="true"></div>' : ''
      return divider + renderField(key, spec, sectionValues?.[key], sectionName, sectionValues)
    })
    .join('')

  let groupIdx = 0
  const groupsHtml = [...groups.entries()].map(([groupId, entries]) => {
    const needsDivider = groupIdx > 0 || standalone.length > 0
    groupIdx++

    const pairKeys = GROUP_PAIR_KEYS[groupId]
    const bgEntry = pairKeys
      ? entries.find(([k]) => k === pairKeys.bg)
      : entries.find(([k]) => k.includes('background'))
    const textEntry = pairKeys
      ? entries.find(([k]) => k === pairKeys.text)
      : entries.find(([k]) => k.includes('text'))
    const otherEntries = entries.filter(([k]) => {
      if (pairKeys) return k !== pairKeys.bg && k !== pairKeys.text
      return !k.includes('background') && !k.includes('text')
    })

    const bgValue = bgEntry ? (sectionValues?.[bgEntry[0]] ?? '') : ''
    const textValue = textEntry ? (sectionValues?.[textEntry[0]] ?? '') : ''
    const badge = (bgEntry && textEntry) ? renderContrastBadge(bgValue, textValue, groupId) : ''

    const divider = needsDivider ? '<div data-customizer-divider aria-hidden="true"></div>' : ''
    const groupLabel = t(`customizer.groups.${groupId}`)

    const colorFields = [
      bgEntry ? renderStandaloneColorField(bgEntry[0], bgValue, sectionName) : '',
      textEntry ? renderStandaloneColorField(textEntry[0], textValue, sectionName) : '',
    ].join('')

    const otherHtml = otherEntries.map(([key, spec]) =>
      renderField(key, spec, sectionValues?.[key], sectionName, sectionValues)
    ).join('')

    return `${divider}
      <div data-customizer-color-group data-group="${escapeHtml(groupId)}">
        <div data-color-group-header>
          <span data-color-group-label>${escapeHtml(groupLabel)}</span>
          <div data-customizer-group-actions>
            ${badge}
            <button type="button" data-click="customizerResetGroup" data-config-section="${escapeHtml(sectionName)}" data-group="${escapeHtml(groupId)}" data-customizer-reset-group aria-label="${escapeHtml(t('customizer.resetGroupAria', {group: groupLabel}))}" title="${escapeHtml(t('customizer.reset'))}">↺</button>
          </div>
        </div>
        ${colorFields}${otherHtml}
      </div>`
  }).join('')

  return `
    <div data-customizer-section data-section="${escapeHtml(sectionName)}">
      <p data-customizer-section-title>${escapeHtml(t(`customizer.sections.${sectionName}`))}</p>
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
        title="${escapeHtml(t('customizer.resetStyle'))}"
        aria-label="${escapeHtml(t('customizer.resetStyle'))}"
        data-customizer-list-reset
      >${escapeHtml(t('customizer.resetStyle'))}</button>` : ''}
    </div>
  `

  const shellItem = renderListRow({
    action: 'openCustomizerFor',
    label: t('app.shell'),
    type: t('customizer.types.shell'),
    syncId: SHELL_SYNC_ID,
    moduleType: 'app',
    showReset: shellHasConfig,
  })

  const pageItem = pageSyncId ? `
    ${renderListRow({
      action: 'openPageForm',
      label: pageLabel,
      type: t('customizer.types.page'),
      pageSyncIdValue: pageSyncId,
      showReset: false,
    })}
  ` : `<p data-customizer-list-section>${escapeHtml(pageLabel)}</p>`

  const moduleItems = moduleCards.map((card) => {
    const title = card.querySelector('[data-module-card-title]')?.textContent?.trim() ?? t('modules.untitled')
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

function renderModuleIdentitySection(moduleTitle = '') {
  return `
    <div data-customizer-section data-section="identity">
      <p data-customizer-section-title>${escapeHtml(t('moduleCrud.sections.identity'))}</p>
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

function renderAppearanceLauncherSection(bgData = null) {
  const uiTheme = bgData?.ui_theme ?? 'dark'
  const isDark = uiTheme !== 'light'
  const isBackgroundRemoved = bgData?.background_properties === 'none' && !bgData?.background_asset_id
  const backgroundToggleLabel = isBackgroundRemoved
    ? t('customizer.speedtabBackgroundShort')
    : t('customizer.removeBackgroundShort')

  return `
    <div data-customizer-section data-section="appearance-launcher">
      <p data-customizer-section-title>${escapeHtml(t('common.appearance'))}</p>
      <div data-customizer-inline-actions>
        <div>
          <button
            type="button"
            class="st-btn"
            data-btn="dark"
            data-click="setShellThemePreset"
            data-theme-value="dark"
            aria-pressed="${isDark ? 'true' : 'false'}"
          ><i data-icon="moon" aria-hidden="true"></i> ${escapeHtml(t('customizer.options.dark'))}</button>
          <button
            type="button"
            class="st-btn"
            data-btn="light"
            data-click="setShellThemePreset"
            data-theme-value="light"
            aria-pressed="${isDark ? 'false' : 'true'}"
          ><i data-icon="sun" aria-hidden="true"></i> ${escapeHtml(t('customizer.options.light'))}</button>
          <button
            type="button"
            class="st-btn"
            data-btn="primary"
            data-click="openCustomizerAppearance"
            data-customizer-nav-button
          >🖥️ ${escapeHtml(t('common.appearance'))}</button>
          <button
            type="button"
            class="st-btn"
            data-btn="danger"
            data-outline
            data-click="toggleShellWallpaper"
            title="${escapeHtml(backgroundToggleLabel)}"
            aria-label="${escapeHtml(backgroundToggleLabel)}"
          >❌ ${escapeHtml(backgroundToggleLabel)}</button>
        </div>
      </div>
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
  if (entityType === 'shell' && Object.keys(spec.appearance).length) {
    sections.push(renderAppearanceLauncherSection(bgData))
    if (bgData) {
      sections.push(renderBackgroundSettingsSection(bgData))
    }
  } else if (Object.keys(spec.appearance).length) {
    sections.push(renderGroupedSection('appearance', spec.appearance, effectiveConfig.appearance))
  }

  return `<div data-customizer-form>${sections.join(SECTION_DIVIDER)}</div>`
}

export function renderCustomizerAppearancePanel(entityType, moduleType, config = {}, bgData = null, effectiveConfig = config) {
  const spec = getUiConfigSpec(entityType, moduleType)
  const sections = []

  if (Object.keys(spec.appearance).length) {
    if (entityType === 'shell') {
      sections.push(renderShellAppearancePanelSection('appearance', spec.appearance, effectiveConfig.appearance))
    } else {
      sections.push(renderExpandedGroupedSection('appearance', spec.appearance, effectiveConfig.appearance))
    }
  }

  return `<div data-customizer-form data-customizer-appearance-panel>${sections.join(SECTION_DIVIDER)}</div>`
}
