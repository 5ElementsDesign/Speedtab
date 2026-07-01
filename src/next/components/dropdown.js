import {buildAttributes, escapeHtml} from '../utils/html.js'

const OPEN = 'data-dropdown-open'

function buildMenuItem({label, action, href, attributes}) {
  const attrs = buildAttributes(attributes)
  if (href) {
    return `<a role="menuitem" href="${escapeHtml(href)}"${attrs}>${escapeHtml(label)}</a>`
  }
  return `<button type="button" role="menuitem" data-click="${escapeHtml(action)}"${attrs}>${escapeHtml(label)}</button>`
}

// items: [{ label, action, href, divider, attributes }] — `divider` draws a separator above the item,
// `attributes` is an object of extra attributes set on the rendered <a>/<button> (e.g. {'data-id': moduleId})
export function buildDropdown({trigger, ariaLabel, align = 'right', triggerClass = '', items = []}) {
  return `
    <div data-dropdown data-align="${escapeHtml(align)}">
      <button
        type="button"
        data-dropdown-trigger
        aria-haspopup="menu"
        aria-expanded="false"
        aria-label="${escapeHtml(ariaLabel)}"
        class="${escapeHtml(triggerClass)}"
      >${trigger}</button>

      <div data-dropdown-panel inert>
        <menu role="menu">
          ${items.map((item) => `
            <li role="none"
              ${item.dividerTop ? ' data-divider-top' : ''}
              ${item.dividerBottom ? ' data-divider-bottom' : ''}
            >
              ${buildMenuItem(item)}
            </li>
          `).join('')}
        </menu>
      </div>
    </div>
  `
}

// Currently open panel (teleported to body) and its root [data-dropdown]
let _openPanel = null
let _openRoot  = null

export function getOpenDropdownTrigger() {
  return _openRoot?.querySelector?.('[data-dropdown-trigger]') ?? null
}

export function positionPanel(root, panel) {
  const trigger = root.querySelector('[data-dropdown-trigger]')
  const p = panel ?? root.querySelector('[data-dropdown-panel]')
  if (!trigger || !p) return

  const rect = trigger.getBoundingClientRect()

  if (window.innerHeight - rect.bottom < rect.top) {
    p.style.top    = ''
    p.style.bottom = (window.innerHeight - rect.top + 2) + 'px'
  } else {
    p.style.top    = (rect.bottom + 2) + 'px'
    p.style.bottom = ''
  }

  if (rect.left <= window.innerWidth - rect.right) {
    p.style.left  = rect.left + 'px'
    p.style.right = ''
  } else {
    p.style.left  = ''
    p.style.right = (window.innerWidth - rect.right) + 'px'
  }
}

export function openDropdown(root) {
  closeAll()

  const panel = root.querySelector('[data-dropdown-panel]')
  if (!panel) return

  // Teleport to body — escapes transform containment ([data-tab].active has
  // transform:translate(0) from the fade behavior, which traps position:fixed children)
  document.body.appendChild(panel)
  _openPanel = panel
  _openRoot  = root

  positionPanel(root, panel)
  root.setAttribute(OPEN, '')
  panel.removeAttribute('inert')
  root.querySelector('[data-dropdown-trigger]')?.setAttribute('aria-expanded', 'true')
}

export function closeDropdown(root) {
  root.removeAttribute(OPEN)
  root.querySelector('[data-dropdown-trigger]')?.setAttribute('aria-expanded', 'false')

  // Retrieve panel: if it was teleported to body, get it from the tracker
  const panel = (_openRoot === root) ? _openPanel : root.querySelector('[data-dropdown-panel]')
  if (panel) {
    panel.setAttribute('inert', '')
    root.appendChild(panel)
  }

  if (_openRoot === root) {
    _openPanel = null
    _openRoot  = null
  }
}

export function closeAll() {
  document.querySelectorAll(`[data-dropdown][${OPEN}]`).forEach(closeDropdown)
}

export function toggle(root) {
  root?.hasAttribute(OPEN) ? closeDropdown(root) : openDropdown(root)
}
