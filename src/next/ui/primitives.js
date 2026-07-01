import {escapeHtml} from '../utils/html.js'

function attrsToString(attrs = {}) {
  return Object.entries(attrs)
    .filter(([, value]) => value !== null && value !== undefined && value !== false && value !== '')
    .map(([key, value]) => {
      if (value === true) return key
      return `${key}="${escapeHtml(String(value))}"`
    })
    .join(' ')
}

export function section({title = '', helper = '', children = '', attrs = {}} = {}) {
  const attrString = attrsToString(attrs)
  return `
    <section data-section${attrString ? ` ${attrString}` : ''}>
      ${title ? `<p data-section-title>${escapeHtml(title)}</p>` : ''}
      ${helper ? `<p data-section-helper>${escapeHtml(helper)}</p>` : ''}
      ${children}
    </section>
  `
}

export function divider() {
  return `<div data-divider aria-hidden="true"></div>`
}

export function customizerDivider() {
  return `<div data-customizer-divider aria-hidden="true"></div>`
}

export function helperText(text = '') {
  if (!text) return ''
  return `<p data-helper-text>${escapeHtml(text)}</p>`
}

export function field({
  type = 'text',
  label = '',
  control = '',
  layout = '',
  attrs = {},
} = {}) {
  const attrString = attrsToString(attrs)
  const layoutAttr = layout ? ` data-field-layout="${escapeHtml(layout)}"` : ''
  return `
    <label data-field data-field-type="${escapeHtml(type)}"${layoutAttr}${attrString ? ` ${attrString}` : ''}>
      <span data-field-label>${escapeHtml(label)}</span>
      ${control}
    </label>
  `
}

export function customizerSection({title = '', section = '', children = ''} = {}) {
  return `
    <div data-customizer-section${section ? ` data-section="${escapeHtml(section)}"` : ''}>
      ${title ? `<p data-customizer-section-title>${escapeHtml(title)}</p>` : ''}
      ${children}
    </div>
  `
}

export function customizerField({
  label = '',
  control = '',
  layout = '',
  type = '',
  attrs = {},
  labelTag = 'span',
} = {}) {
  const attrString = attrsToString(attrs)
  const layoutAttr = layout ? ` data-customizer-field-layout="${escapeHtml(layout)}"` : ''
  const typeAttr = type ? ` data-customizer-field-type="${escapeHtml(type)}"` : ''
  const safeLabelTag = labelTag === 'p' ? 'p' : 'span'
  return `
    <label data-customizer-field${typeAttr}${layoutAttr}${attrString ? ` ${attrString}` : ''}>
      <${safeLabelTag} data-customizer-field-label>${escapeHtml(label)}</${safeLabelTag}>
      ${control}
    </label>
  `
}

export function textInput({name, value = '', attrs = {}} = {}) {
  const attrString = attrsToString(attrs)
  return `<input type="text" name="${escapeHtml(name)}" value="${escapeHtml(value)}"${attrString ? ` ${attrString}` : ''}>`
}

export function urlInput({name, value = '', attrs = {}} = {}) {
  const attrString = attrsToString(attrs)
  return `<input type="url" name="${escapeHtml(name)}" value="${escapeHtml(value)}"${attrString ? ` ${attrString}` : ''}>`
}

export function numberInput({name, value = '', attrs = {}} = {}) {
  const attrString = attrsToString(attrs)
  return `<input type="number" name="${escapeHtml(name)}" value="${escapeHtml(String(value ?? ''))}"${attrString ? ` ${attrString}` : ''}>`
}

export function passwordInput({name, value = '', attrs = {}} = {}) {
  const attrString = attrsToString(attrs)
  return `<input type="password" name="${escapeHtml(name)}" value="${escapeHtml(value)}"${attrString ? ` ${attrString}` : ''}>`
}

export function textarea({name, value = '', rows = 4, attrs = {}} = {}) {
  const attrString = attrsToString(attrs)
  return `<textarea name="${escapeHtml(name)}" rows="${escapeHtml(String(rows))}"${attrString ? ` ${attrString}` : ''}>${escapeHtml(value)}</textarea>`
}

export function select({name, value = '', options = [], attrs = {}} = {}) {
  const attrString = attrsToString(attrs)
  const optionsHtml = options.map((option) => {
    const optionAttrs = attrsToString(option.attrs ?? {})
    return `<option value="${escapeHtml(option.value)}"${String(option.value) === String(value) ? ' selected' : ''}${optionAttrs ? ` ${optionAttrs}` : ''}>${escapeHtml(option.label)}</option>`
  }).join('')
  return `<select name="${escapeHtml(name)}"${attrString ? ` ${attrString}` : ''}>${optionsHtml}</select>`
}

export function checkbox({name, checked = false, attrs = {}} = {}) {
  const attrString = attrsToString(attrs)
  return `<input type="checkbox" name="${escapeHtml(name)}"${checked ? ' checked' : ''}${attrString ? ` ${attrString}` : ''}>`
}

export function button({
  label = '',
  variant = 'secondary',
  type = 'button',
  icon = '',
  attrs = {},
  useStClass = false,
} = {}) {
  const attrString = attrsToString({
    'data-btn': variant,
    ...(useStClass ? {class: 'st-btn'} : {}),
    ...attrs,
    type,
  })
  return `<button ${attrString}>${icon ? `${icon} ` : ''}${escapeHtml(label)}</button>`
}

export function buttonRow(buttons = [], attrs = {}) {
  const attrString = attrsToString(attrs)
  return `
    <div data-button-row${attrString ? ` ${attrString}` : ''}>
      ${buttons.join('')}
    </div>
  `
}

export function actionFooter({save = '', cancel = '', delete: deleteAction = '', close = ''} = {}) {
  return `
    <div data-form-actions>
      ${save}
      ${cancel}
      ${deleteAction}
      ${close}
    </div>
  `
}
