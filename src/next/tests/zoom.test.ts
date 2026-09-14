import {describe, expect, it} from 'vitest'
import {shouldCollapseGridForZoom} from '../app/zoom.js'

describe('zoom grid detection', () => {
  it('collapses the grid at 150% zoom', () => {
    expect(shouldCollapseGridForZoom(1.5)).toBe(true)
  })

  it('keeps the grid at 125% zoom', () => {
    expect(shouldCollapseGridForZoom(1.25)).toBe(false)
  })

  it('does not use viewport width as a proxy for zoom', () => {
    expect(shouldCollapseGridForZoom(1)).toBe(false)
  })
})
