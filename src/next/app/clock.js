let timeoutId = null
let started = false
const listeners = new Map()
const clockUnits = ['second', 'minute', 'hour', 'day']

function normalizeUnit(unit) {
  return clockUnits.includes(unit) ? unit : 'second'
}

function getUnitKey(now, unit) {
  const date = new Date(now)
  if (unit === 'second') return Math.floor(now / 1000)
  if (unit === 'minute') return Math.floor(now / 60_000)
  if (unit === 'hour') return Math.floor(now / 3_600_000)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function getNextTickDelay(unit) {
  const date = new Date()
  const now = date.getTime()
  if (unit === 'second') return Math.max(1, 1000 - date.getMilliseconds())
  if (unit === 'minute') return Math.max(1, 60_000 - ((date.getSeconds() * 1000) + date.getMilliseconds()))
  if (unit === 'hour') return Math.max(1, 3_600_000 - ((date.getMinutes() * 60_000) + (date.getSeconds() * 1000) + date.getMilliseconds()))
  const nextDay = new Date(now)
  nextDay.setHours(24, 0, 0, 0)
  return Math.max(1, nextDay.getTime() - now)
}

function getFinestActiveUnit() {
  for (const unit of clockUnits) {
    if ([...listeners.values()].some((entry) => entry.unit === unit)) return unit
  }
  return null
}

function notifyChangedListeners(now) {
  listeners.forEach((entry, listener) => {
    const nextKey = getUnitKey(now, entry.unit)
    if (nextKey === entry.lastKey) return
    entry.lastKey = nextKey
    listener(now)
  })
}

function notifyAllListeners(now) {
  listeners.forEach((entry, listener) => {
    entry.lastKey = getUnitKey(now, entry.unit)
    listener(now)
  })
}

function clearTick() {
  if (timeoutId !== null) window.clearTimeout(timeoutId)
  timeoutId = null
}

function scheduleTick() {
  clearTick()
  const unit = getFinestActiveUnit()
  if (!started || document.hidden || !unit) return
  const delay = getNextTickDelay(unit)
  timeoutId = window.setTimeout(() => {
    const now = Date.now()
    notifyChangedListeners(now)
    scheduleTick()
  }, delay)
}

function handleVisibilityChange() {
  if (document.hidden) {
    clearTick()
    return
  }
  if (started && listeners.size) {
    const now = Date.now()
    notifyAllListeners(now)
    scheduleTick()
  }
}

export function getAppClockNow() {
  return Date.now()
}

export function startAppClock() {
  if (started) return
  started = true
  document.addEventListener('visibilitychange', handleVisibilityChange)
  scheduleTick()
}

export function stopAppClock() {
  if (!started) return
  started = false
  clearTick()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
}

export function subscribeToAppClock(listener, unit = 'second') {
  if (typeof listener !== 'function') return () => {}
  listeners.set(listener, {
    unit: normalizeUnit(unit),
    lastKey: getUnitKey(Date.now(), normalizeUnit(unit)),
  })
  scheduleTick()
  return () => {
    listeners.delete(listener)
    scheduleTick()
  }
}
