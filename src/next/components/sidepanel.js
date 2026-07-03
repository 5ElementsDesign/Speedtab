import {SPEEDTAB_SVG} from '../components/icons.js'
import {escapeHtml} from '../utils/html.js'
import {t} from '../utils/i18n.js'

const OPEN = 'data-sidepanel-open'
let root = null
const closeCallbacks = []

/**
 * Admin configuration for DEV
 */
const stInternals = {
  // The HTML cache should be configurable
  // And we need a fitting name, i don't like neuther
  renderEachPageNew: false,

  historyMode: 'push',
}

export function onSidepanelClose(fn) {
  closeCallbacks.push(fn)
}

function runCloseCallbacks(reason = 'close') {
  closeCallbacks.splice(0).forEach((fn) => fn(reason))
}

function buildSidepanel({title = '', meta = '', showBack = false, backAction = '', footer = ''} = {}) {
  const disabled = !showBack
  const backActionAttr = !disabled && backAction ? ` data-click="${escapeHtml(backAction)}"` : ''
  return `
    <div data-sidepanel-panel role="complementary" aria-label="${escapeHtml(title)}">
      <header data-sidepanel-header>
        <div class="inline-flex flex-align-center gap-0">
          <button ${disabled ? 'disabled ' : ''}class="fix-top-1${disabled ? ' opacity-25' : ''}" type="button"${backActionAttr} data-sidepanel-back aria-label="${escapeHtml(t('common.back'))}">
            ${SPEEDTAB_SVG.arrow}
          </button>
          <h2 class="my-0" data-sidepanel-title>${escapeHtml(title)}</h2>
          ${meta ? `<span data-sidepanel-meta>${escapeHtml(meta)}</span>` : ''}
        </div>
        <button type="button" data-sidepanel-close aria-label="${escapeHtml(t('common.close'))}">${SPEEDTAB_SVG.sidepanelClose}</button>
      </header>
      <div data-sidepanel-body></div>
      ${footer ? `<footer data-sidepanel-footer>${footer}</footer>` : ''}
    </div>
  `
}

function ensureRoot() {
  if (root) return root
  root = document.createElement('div')
  root.setAttribute('data-sidepanel', '')
  root.setAttribute('inert', '')
  document.body.appendChild(root)
  return root
}

export function openSidepanel({title = '', meta = '', syncId = '', moduleType = '', panelKind = '', panelSize = '', showBack = false, backAction = '', footer = ''} = {}) {
  const el = ensureRoot()
  // If already open, fire cleanup for the previous panel state (e.g. switching form → list)
  if (el.hasAttribute(OPEN)) runCloseCallbacks('replace')
  el.innerHTML = buildSidepanel({title, meta, showBack, backAction, footer})
  el.dataset.syncId = syncId
  el.dataset.moduleType = moduleType
  el.dataset.panelKind = panelKind
  el.dataset.panelSize = panelSize
  el.removeAttribute('inert')
  el.setAttribute(OPEN, '')
  document.body.setAttribute('data-sidepanel-active', '')
  return el
}

export function closeSidepanel() {
  if (!root?.hasAttribute(OPEN)) return
  runCloseCallbacks('close')
  root.removeAttribute(OPEN)
  root.setAttribute('inert', '')
  document.body.removeAttribute('data-sidepanel-active')
}

export function isSidepanelOpen() {
  return Boolean(root?.hasAttribute(OPEN))
}

export function getSidepanelState() {
  if (!root?.hasAttribute(OPEN)) return {}
  return {
    syncId: root.dataset.syncId || '',
    moduleType: root.dataset.moduleType || '',
    panelKind: root.dataset.panelKind || '',
  }
}
