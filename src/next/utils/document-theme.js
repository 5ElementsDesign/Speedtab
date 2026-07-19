import {loadAppSettings} from '../data/app-settings.js'

export function normalizeDocumentTheme(value) {
  return value === 'light' ? 'light' : 'dark'
}

export function applyDocumentTheme(theme = 'dark') {
  const nextTheme = normalizeDocumentTheme(theme)
  const root = document.documentElement
  root.classList.remove('dark', 'light')
  root.classList.add(nextTheme)
  root.setAttribute('data-ui-theme', nextTheme)

  const meta = document.querySelector('meta[name="color-scheme"]')
  if (meta instanceof HTMLMetaElement) {
    meta.setAttribute('content', nextTheme)
  }

  return nextTheme
}

export async function loadAndApplyDocumentTheme() {
  const settings = await loadAppSettings()
  return applyDocumentTheme(settings.ui_theme)
}
