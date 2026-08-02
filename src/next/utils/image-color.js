function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(Number(value) || 0)))
}

export function getDominantOpaqueRgb(pixels, {alphaThreshold = 32, bucketSize = 32} = {}) {
  if (!pixels?.length) return null
  const safeBucketSize = Math.max(1, Math.min(256, Math.round(bucketSize)))
  const buckets = new Map()

  for (let index = 0; index + 3 < pixels.length; index += 4) {
    if (pixels[index + 3] < alphaThreshold) continue
    const red = pixels[index]
    const green = pixels[index + 1]
    const blue = pixels[index + 2]
    const key = [red, green, blue]
      .map((channel) => Math.floor(channel / safeBucketSize))
      .join(':')
    const bucket = buckets.get(key) ?? {red: 0, green: 0, blue: 0, count: 0}
    bucket.red += red
    bucket.green += green
    bucket.blue += blue
    bucket.count += 1
    buckets.set(key, bucket)
  }

  let dominant = null
  for (const bucket of buckets.values()) {
    if (!dominant || bucket.count > dominant.count) dominant = bucket
  }
  if (!dominant?.count) return null

  return {
    red: clampChannel(dominant.red / dominant.count),
    green: clampChannel(dominant.green / dominant.count),
    blue: clampChannel(dominant.blue / dominant.count),
  }
}

export function rgbToHex({red, green, blue}) {
  return `#${[red, green, blue]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, '0'))
    .join('')}`
}

function linearizeChannel(channel) {
  const value = clampChannel(channel) / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

export function getReadableTextColor({red, green, blue}) {
  const luminance = (
    0.2126 * linearizeChannel(red)
    + 0.7152 * linearizeChannel(green)
    + 0.0722 * linearizeChannel(blue)
  )
  const whiteContrast = 1.05 / (luminance + 0.05)
  const darkContrast = (luminance + 0.05) / 0.05
  return whiteContrast >= darkContrast ? '#ffffff' : '#111827'
}
