export function roundClockTimestamp(timestamp = Date.now()) {
  const value = Number(timestamp) || 0
  return value - (value % 1000)
}

export function getClockTimeParts(timestamp) {
  const date = new Date(roundClockTimestamp(timestamp))
  return {
    hours: date.getHours(),
    minutes: date.getMinutes(),
    seconds: date.getSeconds(),
  }
}

export function normalizeClockInputParts(hours = 0, minutes = 0, seconds = 0) {
  const daySeconds = 86_400
  const rawTotalSeconds = (
    (Number.parseInt(String(hours), 10) || 0) * 3600
    + (Number.parseInt(String(minutes), 10) || 0) * 60
    + (Number.parseInt(String(seconds), 10) || 0)
  )
  const totalSeconds = ((rawTotalSeconds % daySeconds) + daySeconds) % daySeconds
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  }
}

export function getClockTargetTimestamp(baseTimestamp, nextParts = {}) {
  const roundedBaseTimestamp = roundClockTimestamp(baseTimestamp)
  const baseDate = new Date(roundedBaseTimestamp)
  const currentParts = getClockTimeParts(roundedBaseTimestamp)
  const normalizedParts = normalizeClockInputParts(
    nextParts.hours ?? currentParts.hours,
    nextParts.minutes ?? currentParts.minutes,
    nextParts.seconds ?? currentParts.seconds,
  )
  const nextDate = new Date(baseDate)
  nextDate.setHours(normalizedParts.hours, normalizedParts.minutes, normalizedParts.seconds, 0)
  let targetTimestamp = nextDate.getTime()
  if (targetTimestamp < roundedBaseTimestamp) targetTimestamp += 86_400_000
  return targetTimestamp
}

export function getClockDraftDurationMs(draft = {}) {
  const base = roundClockTimestamp(draft?.baseTimestamp || 0)
  const target = roundClockTimestamp(draft?.targetTimestamp || base)
  const dayMs = 86_400_000
  let delta = target - base
  if (Math.abs(delta) < 1000) return 0
  if (delta < 0) delta += dayMs
  return delta
}

export function formatClockDraftSummary(draft = {}) {
  const totalSeconds = Math.floor(getClockDraftDurationMs(draft) / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours}h ${minutes}m ${seconds}s`
}

export function createClockDraft({baseTimestamp = Date.now(), targetTimestamp = baseTimestamp} = {}) {
  const roundedBaseTimestamp = roundClockTimestamp(baseTimestamp)
  const roundedTargetTimestamp = roundClockTimestamp(targetTimestamp)
  const dayMs = 86_400_000
  let delta = roundedTargetTimestamp - roundedBaseTimestamp
  delta = ((delta % dayMs) + dayMs) % dayMs
  const normalizedTargetTimestamp = roundedBaseTimestamp + delta
  const parts = getClockTimeParts(normalizedTargetTimestamp)
  const draft = {
    baseTimestamp: roundedBaseTimestamp,
    targetTimestamp: normalizedTargetTimestamp,
    hours: parts.hours,
    minutes: parts.minutes,
    seconds: parts.seconds,
  }
  return {
    ...draft,
    summaryLabel: formatClockDraftSummary(draft),
  }
}

export function createCurrentClockDraft(now = Date.now()) {
  const roundedNow = roundClockTimestamp(now)
  return createClockDraft({baseTimestamp: roundedNow, targetTimestamp: roundedNow})
}

export function createClockDraftFromParts(baseTimestamp, nextParts = {}) {
  return createClockDraft({
    baseTimestamp,
    targetTimestamp: getClockTargetTimestamp(baseTimestamp, nextParts),
  })
}

export function createClockDraftFromDuration(baseTimestamp, durationMs = 0) {
  const roundedBaseTimestamp = roundClockTimestamp(baseTimestamp)
  const safeDuration = Math.max(0, Number(durationMs) || 0)
  return createClockDraft({
    baseTimestamp: roundedBaseTimestamp,
    targetTimestamp: roundedBaseTimestamp + safeDuration,
  })
}

