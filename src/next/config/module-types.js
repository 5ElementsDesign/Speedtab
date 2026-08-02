const BOOKMARK_MODULE_TYPES = new Set(['tabs', 'speed-dial'])
const COLLECTION_MODULE_TYPES = new Set(['tabs', 'speed-dial', 'notes', 'feeds'])

export function isBookmarkModuleType(type) {
  return BOOKMARK_MODULE_TYPES.has(type)
}

export function moduleCreatesDefaultCollection(type) {
  return COLLECTION_MODULE_TYPES.has(type)
}

export function getFixedModuleColumnSpan(type) {
  return type === 'speed-dial' ? 12 : null
}

export function isSpeedDialModuleType(type) {
  return type === 'speed-dial'
}

export function getModuleTypeMessageKey(type) {
  return isSpeedDialModuleType(type) ? 'speedDial' : type
}
