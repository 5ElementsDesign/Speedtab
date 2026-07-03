import {SPEEDTAB_SVG} from './icons.js'
import {buildAttributes, escapeHtml} from '../utils/html.js'

const OPEN = 'data-dropdown-open'

function buildMenuItem(item) {
  const {label, action, href, attributes, submenu} = item
  if (item.content) return item.content
  const attrs = buildAttributes(attributes)
  if (Array.isArray(submenu) && submenu.length) {
    return `
      <div data-dropdown-submenu>
        <button
          type="button"
          role="menuitem"
          aria-haspopup="menu"
          data-dropdown-submenu-trigger
          ${attrs}
        >
          <span data-dropdown-submenu-label>${escapeHtml(label)}</span>
          <span data-dropdown-submenu-value></span>
          <span data-dropdown-submenu-chevron>${SPEEDTAB_SVG.chevron}</span>
        </button>
        <div data-dropdown-submenu-panel>
          <menu role="menu">
            ${submenu.map((child) => `
              <li role="none"
                ${child.dividerTop ? ' data-divider-top' : ''}
                ${child.dividerBottom ? ' data-divider-bottom' : ''}
              >
                ${buildMenuItem(child)}
              </li>
            `).join('')}
          </menu>
        </div>
      </div>
    `
  }

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

      <div data-dropdown-panel data-align="${escapeHtml(align)}" inert>
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

function readQuickSettingValue(moduleRoot, key) {
  if (!(moduleRoot instanceof HTMLElement) || !key) return null
  const tabsRoot = moduleRoot.querySelector('[data-yai-tabs]')
  const gridCol = moduleRoot.closest('[data-grid-col]')

  if (key === 'module-tabs-quicklinks') {
    return tabsRoot?.hasAttribute('data-bookmarks-quicklinks') === true
  }

  if (key === 'module-tabs-force-favicon') {
    return tabsRoot?.hasAttribute('data-bookmarks-force-favicon') === true
  }

  if (key === 'module-tabs-show-add-tile') {
    return tabsRoot?.hasAttribute('data-bookmarks-inline-add-tile') === true
  }

  if (key === 'module-hide-header') {
    return moduleRoot.hasAttribute('data-hide-header')
  }

  if (key === 'module-column-span') {
    const raw = gridCol?.style?.getPropertyValue('--st-grid-col-span')?.trim()
      || gridCol?.getAttribute('style')?.match(/--st-grid-col-span:\s*([0-9]+)/)?.[1]
      || '12'
    const value = parseInt(raw, 10)
    return Number.isInteger(value) ? value : 12
  }

  return null
}

function syncQuickSettingState(root, panel) {
  const moduleRoot = root?.closest?.('[data-module-card]')
  if (!(moduleRoot instanceof HTMLElement) || !(panel instanceof HTMLElement)) return

  panel.querySelectorAll('[data-quick-setting-key]').forEach((item) => {
    const key = item.getAttribute('data-quick-setting-key')
    if (!key) return
    const currentValue = readQuickSettingValue(moduleRoot, key)
    const explicitValue = item.getAttribute('data-quick-setting-value')

    if (explicitValue !== null) {
      const isActive = String(currentValue) === explicitValue
      item.toggleAttribute('data-quick-setting-active', isActive)
      return
    }

    item.toggleAttribute('data-quick-setting-active', currentValue === true)
  })

}

export function getOpenDropdownTrigger() {
  return _openRoot?.querySelector?.('[data-dropdown-trigger]') ?? null
}

export function isDropdownOpen() {
  return Boolean(_openRoot)
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
  syncQuickSettingState(root, panel)
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
