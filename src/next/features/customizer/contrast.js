export function hexToLuminance(hex) {
  // Accept 6 or 8-digit hex (alpha is ignored for luminance — treated as opaque)
  const h = typeof hex === 'string' ? hex.trim() : ''
  if (!/^#[0-9a-fA-F]{6,8}$/.test(h)) return -1
  const r = parseInt(h.slice(1, 3), 16) / 255
  const g = parseInt(h.slice(3, 5), 16) / 255
  const b = parseInt(h.slice(5, 7), 16) / 255
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export function contrastRatio(hex1, hex2) {
  const l1 = hexToLuminance(hex1)
  const l2 = hexToLuminance(hex2)
  if (l1 < 0 || l2 < 0) return null
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

export function wcagLevel(ratio) {
  if (ratio === null) return null
  if (ratio >= 7) return 'AAA'
  if (ratio >= 4.5) return 'AA'
  if (ratio >= 3) return 'A'
  return 'Fail'
}

// Which grouped module color pair an appearance key belongs to
export function getGroupForKey(key) {
  if (key.startsWith('--st-notes-preview-content-')) return 'notePreview'
  if (key.startsWith('--st-notes-open-content-') || key === '--st-notes-open-link-color') return 'noteOpen'
  if (key.startsWith('--st-ws-module-content-')) return 'content'
  if (key.startsWith('--st-ws-module-header-')) return 'header'
  if (key.startsWith('--st-ws-module-')) return 'card'
  return null
}

// The bg+text key pair for each group
export const GROUP_PAIR_KEYS = {
  notePreview: {bg: '--st-notes-preview-content-bg', text: '--st-notes-preview-content-color'},
  noteOpen: {bg: '--st-notes-open-content-bg', text: '--st-notes-open-content-color'},
  card: {bg: '--st-ws-module-background-color', text: '--st-ws-module-text-color'},
  header: {bg: '--st-ws-module-header-background-color', text: '--st-ws-module-header-text-color'},
  content: {bg: '--st-ws-module-content-background-color', text: '--st-ws-module-content-text-color'},
}
