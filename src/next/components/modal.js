import {buildAttributes, escapeHtml} from '../utils/html.js'
import {SPEEDTAB_SVG} from '../components/icons.js'
import {t} from '../utils/i18n.js'

const OPEN = 'data-modal-open'
let root = null
let closeHook = null

// content is raw HTML (developer-composed, e.g. another render function's output) —
// same trust model as buildDropdown's `trigger`. title is plain text and gets escaped.
export function buildModal({title = '', content = '', panelClass = '', panelStyle = '', headerActions = ''} = {}) {
  const panelAttrs = buildAttributes({
    ...(panelClass ? {class: panelClass} : {}),
    ...(panelStyle ? {style: panelStyle} : {}),
  })
  return `
    <div data-modal-backdrop></div>
    <div data-modal-panel role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"${panelAttrs}>
      <header data-modal-header>
        <h2 data-modal-title>${escapeHtml(title)}</h2>
        <div data-modal-header-actions>
          ${headerActions}
          <button type="button" data-modal-close aria-label="${escapeHtml(t('common.close'))}">${SPEEDTAB_SVG.sidepanelClose}</button>
        </div>
      </header>
      <div data-modal-body>${content}</div>
    </div>
  `
}

function ensureRoot() {
  if (root) return root
  root = document.createElement('div')
  root.setAttribute('data-modal', '')
  root.setAttribute('inert', '')
  document.body.appendChild(root)
  return root
}

export function openModal({title, content, onClose = null, panelClass = '', panelStyle = '', headerActions = ''} = {}) {
  const el = ensureRoot()
  closeHook = typeof onClose === 'function' ? onClose : null
  el.innerHTML = buildModal({title, content, panelClass, panelStyle, headerActions})
  el.removeAttribute('inert')
  el.setAttribute(OPEN, '')
}

export function closeModal() {
  if (!root?.hasAttribute(OPEN)) return
  root.removeAttribute(OPEN)
  root.setAttribute('inert', '')
  const hook = closeHook
  closeHook = null
  if (typeof hook === 'function') hook()
}

export function isModalOpen() {
  return Boolean(root?.hasAttribute(OPEN))
}
