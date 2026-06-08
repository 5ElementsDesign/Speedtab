import { describe, expect, it } from 'vitest'

import {
  computeModuleGridColumn,
  normalizeModuleColumnSpanFromConfig,
  normalizeModuleMinHeightFromConfig,
} from './useModuleLayout'

describe('useModuleLayout', () => {
  it('normalizes explicit numeric column spans', () => {
    expect(normalizeModuleColumnSpanFromConfig(JSON.stringify({ column_span: 4 }))).toBe(4)
  })

  it('normalizes legacy full_width to full span', () => {
    expect(normalizeModuleColumnSpanFromConfig(JSON.stringify({ full_width: true }))).toBe('full')
  })

  it('returns auto for invalid or missing span config', () => {
    expect(normalizeModuleColumnSpanFromConfig(JSON.stringify({ column_span: 1 }))).toBeNull()
    expect(normalizeModuleColumnSpanFromConfig(JSON.stringify({ column_span: 'bad' }))).toBeNull()
    expect(normalizeModuleColumnSpanFromConfig(null)).toBeNull()
  })

  it('normalizes module min height config into the supported range', () => {
    expect(normalizeModuleMinHeightFromConfig(JSON.stringify({ min_height_px: 220 }))).toBe(220)
    expect(normalizeModuleMinHeightFromConfig(JSON.stringify({ min_height_px: 90 }))).toBe(130)
    expect(normalizeModuleMinHeightFromConfig(JSON.stringify({ min_height_px: 999 }))).toBe(999)
    expect(normalizeModuleMinHeightFromConfig(JSON.stringify({ min_height_px: 1400 }))).toBe(1000)
    expect(normalizeModuleMinHeightFromConfig(JSON.stringify({ min_height_px: 'bad' }))).toBeNull()
    expect(normalizeModuleMinHeightFromConfig(null)).toBeNull()
  })

  it('computes full-width grid columns', () => {
    expect(computeModuleGridColumn('full', 6)).toBe('1 / -1')
  })

  it('clamps spans to the available page columns', () => {
    expect(computeModuleGridColumn(5, 3)).toBe('span 3')
  })

  it('returns no explicit grid column when only one column is available', () => {
    expect(computeModuleGridColumn(4, 1)).toBeNull()
    expect(computeModuleGridColumn('full', 1)).toBeNull()
  })
})
