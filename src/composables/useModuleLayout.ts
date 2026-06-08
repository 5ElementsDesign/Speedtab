export type ModuleColumnSpan = number | 'full' | null
export const MODULE_MIN_HEIGHT_MIN = 130
export const MODULE_MIN_HEIGHT_MAX = 1000

export function normalizeModuleColumnSpanFromConfig(configJson: string | null | undefined): ModuleColumnSpan {
  if (!configJson) return null
  try {
    const parsed = JSON.parse(configJson) as Record<string, unknown>
    if (parsed.column_span === 'full') return 'full'
    if (typeof parsed.column_span === 'number' && Number.isFinite(parsed.column_span) && parsed.column_span >= 2) {
      return Math.floor(parsed.column_span)
    }
    if (parsed.full_width === true) return 'full'
    return null
  } catch {
    return null
  }
}

export function normalizeModuleMinHeightFromConfig(configJson: string | null | undefined): number | null {
  if (!configJson) return null
  try {
    const parsed = JSON.parse(configJson) as Record<string, unknown>
    if (typeof parsed.min_height_px !== 'number' || !Number.isFinite(parsed.min_height_px)) return null
    return Math.max(MODULE_MIN_HEIGHT_MIN, Math.min(MODULE_MIN_HEIGHT_MAX, Math.floor(parsed.min_height_px)))
  } catch {
    return null
  }
}

export function computeModuleGridColumn(requestedSpan: ModuleColumnSpan, availableColumns: number): string | null {
  const clampedColumns = Math.max(1, Math.floor(availableColumns || 1))
  if (clampedColumns <= 1) return null
  if (requestedSpan === 'full') return '1 / -1'
  if (typeof requestedSpan !== 'number') return null
  const clampedSpan = Math.max(1, Math.min(Math.floor(requestedSpan), clampedColumns))
  return clampedSpan <= 1 ? null : `span ${clampedSpan}`
}
