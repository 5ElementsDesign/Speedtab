const PREFIX = 'st:'

export function dispatch(type, detail = null) {
  document.dispatchEvent(new CustomEvent(PREFIX + type, { detail }))
}

export function on(type, handler) {
  const t = PREFIX + type
  document.addEventListener(t, handler)
  return () => document.removeEventListener(t, handler)
}
