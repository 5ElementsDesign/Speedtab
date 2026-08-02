export function readQuickModuleSettingValue(moduleRoot, key) {
  if (!(moduleRoot instanceof HTMLElement) || !key) return null
  const tabsRoot = moduleRoot.querySelector('[data-yai-tabs]')
  const gridCol = moduleRoot.closest('[data-grid-col]')

  if (key === 'module-tabs-grow') return tabsRoot?.querySelector('[data-controller]')?.hasAttribute('data-grow') === true
  if (key === 'module-tabs-quicklinks') return tabsRoot?.hasAttribute('data-bookmarks-quicklinks') === true
  if (key === 'module-tabs-force-favicon') return tabsRoot?.hasAttribute('data-bookmarks-force-favicon') === true
  if (key === 'module-tabs-show-title-below') return tabsRoot?.hasAttribute('data-bookmarks-show-title-below') === true
  if (key === 'module-tabs-show-add-tile') return tabsRoot?.hasAttribute('data-bookmarks-inline-add-tile') === true
  if (key === 'module-hide-header') return moduleRoot.hasAttribute('data-hide-header')
  if (key === 'speed-dial-fill-height') return moduleRoot.hasAttribute('data-speed-dial-fill-height')
  if (key === 'module-column-span') {
    const raw = gridCol?.style?.getPropertyValue('--st-grid-col-span')?.trim()
      || gridCol?.getAttribute('style')?.match(/--st-grid-col-span:\s*([0-9]+)/)?.[1]
      || '12'
    const value = parseInt(raw, 10)
    return Number.isInteger(value) ? value : 12
  }
  return null
}
