import {describe, expect, it} from 'vitest'
import {getDominantOpaqueRgb, getReadableTextColor, rgbToHex} from '../utils/image-color.js'

describe('favicon color helpers', () => {
  it('uses the most frequent opaque color bucket instead of averaging the image', () => {
    const pixels = new Uint8ClampedArray([
      6, 120, 210, 255,
      12, 126, 214, 255,
      8, 118, 215, 255,
      240, 75, 60, 255,
      255, 255, 255, 0,
    ])

    expect(getDominantOpaqueRgb(pixels)).toEqual({red: 9, green: 121, blue: 213})
  })

  it('serializes colors and chooses a readable foreground', () => {
    expect(rgbToHex({red: 9, green: 121, blue: 219})).toBe('#0979db')
    expect(getReadableTextColor({red: 9, green: 121, blue: 219})).toBe('#111827')
    expect(getReadableTextColor({red: 15, green: 20, blue: 25})).toBe('#ffffff')
  })
})
