import {SPEEDTAB_SVG} from '../components/icons.js'
import {on} from '../app/dispatch.js'
import {escapeHtml} from '../utils/html.js'
import {t} from '../utils/i18n.js'

let root = null
const activeToasts = new Map()
let toastEventsBound = false

function ensureRoot() {
  if (root) return root
  root = document.createElement('div')
  root.setAttribute('data-toast-root', '')
  root.setAttribute('aria-live', 'polite')
  root.setAttribute('aria-atomic', 'false')
  document.body.appendChild(root)
  return root
}

function cleanupToastRecord(id) {
  const record = activeToasts.get(id)
  if (!record) return
  activeToasts.delete(id)
}

export function dismissToastById(id = '') {
  const record = activeToasts.get(id)
  if (!record) return
  record.el.remove()
  cleanupToastRecord(id)
}

export function dismissToast(target) {
  const toast = target?.closest?.('[data-toast-id]')
  const id = toast?.dataset?.toastId || ''
  if (!id) return
  dismissToastById(id)
}

export function showToast({
  title = '',
  message = '',
  tone = 'default',
} = {}) {
  const host = ensureRoot()
  const id = crypto.randomUUID()
  const el = document.createElement('section')
  el.className = `st-toast${tone && tone !== 'default' ? ` is-${tone}` : ''}`
  el.setAttribute('role', 'status')
  el.setAttribute('data-toast-id', id)
  el.innerHTML = `
    <div class="st-toast-copy">
      ${title ? `<strong class="st-toast-title">${escapeHtml(title)}</strong>` : ''}
      <div class="st-toast-message">${escapeHtml(message)}</div>
    </div>
    <button
      type="button"
      class="st-toast-close"
      data-click="dismissToast"
      data-toast-id="${escapeHtml(id)}"
      title="${escapeHtml(t('common.close'))}"
      aria-label="${escapeHtml(t('common.close'))}"
    >${SPEEDTAB_SVG.sidepanelClose}</button>
  `
  host.appendChild(el)

  activeToasts.set(id, {el})
  return id
}

export function initToastEvents() {
  if (toastEventsBound) return
  on('toast', (event) => {
    const detail = event?.detail ?? {}
    showToast(detail)
  })
  toastEventsBound = true
}
