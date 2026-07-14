export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function buildAttributes(attributes = {}, options = {}) {
  const {
    leadingSpace = true,
    skipFalsy = false,
    booleanBare = false,
  } = options

  const rendered = Object.entries(attributes)
    .filter(([, value]) => {
      if (!skipFalsy) return true
      return value !== null && value !== undefined && value !== false && value !== ''
    })
    .map(([name, value]) => {
      if (booleanBare && value === true) return escapeHtml(name)
      return `${escapeHtml(name)}="${escapeHtml(String(value))}"`
    })
    .join(leadingSpace ? ' ' : ' ')

  if (!rendered) return ''
  return leadingSpace ? ` ${rendered}` : rendered
}
