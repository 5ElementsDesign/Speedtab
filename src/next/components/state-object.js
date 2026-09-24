const activeTriggers = new WeakMap()
const syncedStates = new Map()

function getTriggerButton(target) {
  return target instanceof Element ? target.closest('button') : null
}

/**
 * Claims a trigger until the returned cleanup function is called.
 * A claimed trigger cannot start the same work twice.
 */
export function activateTrigger(target) {
  const button = getTriggerButton(target)
  if (!(button instanceof HTMLButtonElement)) return () => {}
  if (activeTriggers.has(button)) return null

  const wasDisabled = button.disabled
  activeTriggers.set(button, {wasDisabled})
  button.setAttribute('data-state-active', '')
  button.disabled = true

  return () => deactivateTrigger(button)
}

export function deactivateTrigger(button) {
  const state = activeTriggers.get(button)
  if (!state) return
  activeTriggers.delete(button)
  button.removeAttribute('data-state-active')
  button.disabled = state.wasDisabled
}

export function getState(name, defaultState = null) {
  return syncedStates.has(name) ? syncedStates.get(name) : defaultState
}

function applySyncedState(element, value) {
  if (element instanceof HTMLInputElement && element.type === 'checkbox') {
    element.checked = Boolean(value)
  }
  if (element instanceof HTMLButtonElement) {
    element.toggleAttribute('data-state-active', Boolean(value))
    element.setAttribute('aria-pressed', String(Boolean(value)))
  }
}

/** Hydrates opt-in controls inserted after their state was first set. */
export function syncState(root = document, name = null) {
  const elements = root instanceof Element
    ? [root, ...root.querySelectorAll('[data-state-sync]')]
    : [...root.querySelectorAll('[data-state-sync]')]

  elements.forEach((element) => {
    const stateName = element.dataset?.stateSync
    if (!stateName || (name && stateName !== name) || !syncedStates.has(stateName)) return
    applySyncedState(element, syncedStates.get(stateName))
  })
}

/**
 * Updates every opt-in control without making a component own an event listener.
 */
export function setState(name, value) {
  syncedStates.set(name, value)
  syncState(document, name)
}
