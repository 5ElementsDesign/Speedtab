export function activateFirstModuleTab(moduleRoot) {
  if (!(moduleRoot instanceof HTMLElement)) return false
  const firstTab = moduleRoot.querySelector('[data-yai-tabs] > [data-controller] [data-open]')
  if (!(firstTab instanceof HTMLElement)) return false
  firstTab.click()
  return true
}
