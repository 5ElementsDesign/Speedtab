/**
 * RadioActive - lightweight DOM reactivity bridge for YEH-driven UIs.
 *
 * Use this when code mutates a real control programmatically but still wants the
 * normal delegated input/change/submit/click flow to run as if the user caused
 * it. This keeps form tracking and data-* handlers on the same event path.
 */

function createBubblingEvent(type, detail = {}) {
  if (type.startsWith('key')) {
    return new KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      key: detail.key || 'Enter',
      code: detail.code || detail.key || 'Enter',
      ...detail,
    })
  }

  if (type === 'submit') {
    return new Event('submit', {
      bubbles: true,
      cancelable: true,
    })
  }

  if (Object.keys(detail).length) {
    return new CustomEvent(type, {
      bubbles: true,
      cancelable: true,
      detail,
    })
  }

  return new Event(type, {
    bubbles: true,
    cancelable: true,
  })
}

export function radioActive(target, {
  eventType = 'change',
  value,
  checked,
  detail = {},
} = {}) {
  if (!(target instanceof HTMLElement)) return null

  if (typeof value !== 'undefined') {
    if ('value' in target) {
      target.value = value
    } else {
      target.setAttribute('value', String(value))
    }
  }

  if (typeof checked !== 'undefined' && 'checked' in target) {
    target.checked = checked
  }

  if (eventType === 'click') {
    target.click()
    return target
  }

  const dispatchTarget = eventType === 'submit'
    ? target.closest('form') || target
    : target

  dispatchTarget.dispatchEvent(createBubblingEvent(eventType, detail))
  return dispatchTarget
}

