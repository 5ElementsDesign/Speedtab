export const SPEED_DIAL_IMAGE_PADDING_MIN = 0
export const SPEED_DIAL_IMAGE_PADDING_MAX = 64

export function normalizeSpeedDialImagePadding(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(
    SPEED_DIAL_IMAGE_PADDING_MIN,
    Math.min(SPEED_DIAL_IMAGE_PADDING_MAX, Math.round(parsed)),
  )
}
