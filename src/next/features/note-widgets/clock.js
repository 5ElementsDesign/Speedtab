import {subscribeToAppClock} from '../../app/clock.js'
import {getLocale, toBcp47} from '../../utils/i18n.js'
import {renderAnalogClockSvg} from '../widgets/render.js'

let unsubscribe = null
let subscribedUnit = null
let subscribedKeepAlive = false
const clockScopes = new Set()
const validTimeZones = new Map()
const formatterCache = new Map()
const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
const formatterOptions = Object.freeze({
  time: {hour: '2-digit', minute: '2-digit', hour12: false},
  timeSeconds: {hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false},
  date: {weekday: 'short', day: 'numeric', month: 'short'},
  dayShort: {weekday: 'short'},
  dayName: {weekday: 'long'},
  day: {day: 'numeric'},
  dayPadded: {day: '2-digit'},
  monthShort: {month: 'short'},
  monthName: {month: 'long'},
  month: {month: 'numeric'},
  monthPadded: {month: '2-digit'},
  yearShort: {year: '2-digit'},
  year: {year: 'numeric'},
  date: {dateStyle: 'medium'},
  datetime: {dateStyle: 'medium', timeStyle: 'short'},
  parts: {hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'},
  offsetParts: {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'},
})
const dateTokenFormats = Object.freeze({
  d: 'dayPadded',
  D: 'dayShort',
  j: 'day',
  l: 'dayName',
  m: 'monthPadded',
  M: 'monthShort',
  n: 'month',
  F: 'monthName',
  y: 'yearShort',
  Y: 'year',
  dayShort: 'dayShort',
  dayName: 'dayName',
  day: 'day',
  monthShort: 'monthShort',
  monthName: 'monthName',
  month: 'month',
  yearShort: 'yearShort',
  year: 'year',
  datetime: 'datetime',
  date: 'date',
})

function getFormatter(locale, timeZone, format) {
  let localeCache = formatterCache.get(locale)
  if (!localeCache) formatterCache.set(locale, localeCache = new Map())
  let zoneCache = localeCache.get(timeZone)
  if (!zoneCache) localeCache.set(timeZone, zoneCache = new Map())
  let formatter = zoneCache.get(format)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {...formatterOptions[format], timeZone})
    zoneCache.set(format, formatter)
  }
  return formatter
}

export function getValidTimeZone(value) {
  const zone = String(value ?? '').trim()
  if (!zone) return undefined
  if (validTimeZones.has(zone)) return validTimeZones.get(zone)
  try {
    new Intl.DateTimeFormat(undefined, {timeZone: zone})
    validTimeZones.set(zone, zone)
    return zone
  } catch {
    return undefined
  }
}

function getZone(element) {
  const zoneRoot = element.closest('[data-clock-zone]')
  return getValidTimeZone(zoneRoot?.dataset.clockZone)
    ?? getValidTimeZone(zoneRoot?.parentElement?.closest('[data-clock-zone]')?.dataset.clockZone)
    ?? getValidTimeZone(browserTimeZone)
}

function formatZoneLabel(timeZone = '') {
  return timeZone.split('/').at(-1)?.replaceAll('_', ' ') || ''
}

function formatTime(now, locale, timeZone, seconds = false) {
  return getFormatter(locale, timeZone, seconds ? 'timeSeconds' : 'time').format(now)
}

function formatDate(now, locale, timeZone) {
  return getFormatter(locale, timeZone, 'date').format(now)
}

function formatDateToken(now, locale, timeZone, token) {
  if (token === 'iso') return formatZonedIso(now, timeZone)
  const format = dateTokenFormats[token]
  return format ? getFormatter(locale, timeZone, format).format(now) : ''
}

function formatDateTemplate(now, locale, timeZone, template = '') {
  return template.replace(/\{([a-zA-Z]+)\}/g, (_match, token) => formatDateToken(now, locale, timeZone, token))
}

function getClockParts(now, timeZone) {
  const parts = getFormatter('en-GB', timeZone, 'parts').formatToParts(now)
  const read = (type) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  return {hour: read('hour'), minute: read('minute'), second: read('second')}
}

function getZoneOffsetSeconds(now, timeZone) {
  const parts = getFormatter('en-GB', timeZone, 'offsetParts').formatToParts(now)
  const read = (type) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  const zonedTimestamp = Date.UTC(read('year'), read('month') - 1, read('day'), read('hour'), read('minute'), read('second'))
  return Math.round((zonedTimestamp - Number(now)) / 1000)
}

function formatZonedIso(now, timeZone) {
  const parts = getFormatter('en-GB', timeZone, 'offsetParts').formatToParts(now)
  const read = (type) => parts.find((part) => part.type === type)?.value ?? '00'
  const offset = getZoneOffsetSeconds(now, timeZone)
  const sign = offset < 0 ? '-' : '+'
  const absoluteOffset = Math.abs(offset)
  const offsetHours = String(Math.floor(absoluteOffset / 3600)).padStart(2, '0')
  const offsetMinutes = String(Math.floor((absoluteOffset % 3600) / 60)).padStart(2, '0')
  return `${read('year')}-${read('month')}-${read('day')}T${read('hour')}:${read('minute')}:${read('second')}${sign}${offsetHours}:${offsetMinutes}`
}

function getDeviationRange(seconds) {
  if (!seconds) return '0'
  const prefix = seconds < 0 ? '-' : ''
  const distance = Math.abs(seconds)
  if (distance <= 60 * 60) return `${prefix}1`
  if (distance <= 3 * 60 * 60) return `${prefix}2`
  if (distance <= 6 * 60 * 60) return `${prefix}3`
  return `${prefix}4`
}

function syncClockDeviations(root, now) {
  root.querySelectorAll('[data-world-clock-items][data-world-clock-default-timezone]').forEach((group) => {
    const defaultZone = getValidTimeZone(group.dataset.worldClockDefaultTimezone)
    const items = group.querySelectorAll('[data-world-clock-item][data-clock-zone]')
    if (!defaultZone) {
      items.forEach((item) => {
        delete item.dataset.deviatesFromDefault
        delete item.dataset.deviatesFromDefaultRange
        item.removeAttribute('data-default')
      })
      return
    }

    const offsets = new Map()
    const getOffset = (timeZone) => {
      if (!offsets.has(timeZone)) offsets.set(timeZone, getZoneOffsetSeconds(now, timeZone))
      return offsets.get(timeZone)
    }
    const defaultOffset = getOffset(defaultZone)
    items.forEach((item) => {
      const timeZone = getValidTimeZone(item.dataset.clockZone)
      if (!timeZone) return
      const deviation = getOffset(timeZone) - defaultOffset
      item.dataset.deviatesFromDefault = String(deviation)
      item.dataset.deviatesFromDefaultRange = getDeviationRange(deviation)
      item.toggleAttribute('data-default', timeZone === defaultZone)
    })
  })
}

function getClockRoots(scope = document) {
  const roots = []
  if (scope instanceof HTMLElement && scope.matches('[data-world-clock]') && scope.closest('[data-floating-window]')) roots.push(scope)
  roots.push(...[...scope.querySelectorAll?.('[data-world-clock]') ?? []].filter((root) => root.closest('[data-floating-window]')))
  return roots
}

function renderWorldClocks(scope, now) {
  const locale = toBcp47(getLocale())
  getClockRoots(scope).forEach((root) => {
    syncClockDeviations(root, now)
    root.querySelectorAll('[data-clock-zone=""]').forEach((label) => {
      if (label.querySelector('[data-date], [data-clock]')) return
      const timeZone = getZone(label)
      if (!timeZone) return
      label.textContent = formatZoneLabel(timeZone)
    })
    root.querySelectorAll('[data-clock]').forEach((clock) => {
      const timeZone = getZone(clock)
      if (!timeZone) return
      const seconds = clock.hasAttribute('data-seconds')
      if (clock.hasAttribute('data-analog')) {
        clock.classList.add('st-clock-widget-analog')
        clock.innerHTML = renderAnalogClockSvg({...getClockParts(now, timeZone), showSeconds: seconds})
        return
      }
      clock.classList.remove('st-clock-widget-analog')
      clock.textContent = formatTime(now, locale, timeZone, seconds)
    })
    root.querySelectorAll('[data-date]').forEach((date) => {
      const timeZone = getZone(date)
      if (!timeZone) return
      date.textContent = date.dataset.dateFormat
        ? formatDateTemplate(now, locale, timeZone, date.dataset.dateFormat)
        : formatDate(now, locale, timeZone)
    })
  })
}

function syncSubscription() {
  const scopes = [document, ...clockScopes]
  const roots = scopes.flatMap((scope) => getClockRoots(scope))
  if (!roots.length) {
    unsubscribe?.()
    unsubscribe = null
    subscribedUnit = null
    subscribedKeepAlive = false
    return
  }
  const nextUnit = roots.some((root) => root.querySelector('[data-clock][data-seconds]')) ? 'second' : 'minute'
  const keepAlive = clockScopes.size > 0
  if (unsubscribe && subscribedUnit === nextUnit && subscribedKeepAlive === keepAlive) return
  unsubscribe?.()
  subscribedUnit = nextUnit
  subscribedKeepAlive = keepAlive
  unsubscribe = subscribeToAppClock((now) => {
    for (const scope of [document, ...clockScopes]) renderWorldClocks(scope, now)
  }, nextUnit, {keepAlive})
}

export function syncNoteWidgets(scope = document) {
  renderWorldClocks(scope, Date.now())
  syncSubscription()
}

export function registerNoteWidgetScope(scope) {
  if (!scope || scope === document) return
  clockScopes.add(scope)
  syncNoteWidgets(scope)
}

export function unregisterNoteWidgetScope(scope) {
  if (!clockScopes.delete(scope)) return
  syncSubscription()
}
