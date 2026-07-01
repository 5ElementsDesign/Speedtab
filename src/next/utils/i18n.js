import {db} from '../../db/db.ts'

export const SUPPORTED_LOCALES = ['en', 'de']
export const DEFAULT_LOCALE = 'en'
const UI_LANGUAGE_SETTING_KEY = 'ui_language'

// Core UI strings — one of these loads on init, never both. Same lazy-per-locale
// split the legacy app already uses (src/i18n.ts), so a German browser never
// fetches the English strings and vice versa.
const CORE_LOADERS = {
  en: () => import('../../locales/en.ts'),
  de: () => import('../../locales/de.ts'),
}

// Namespaces that aren't core UI — only needed once, for a rare flow. Loaded
// via loadNamespace(), never pulled in by initI18n(). exampleWorkspace's
// *labels* live here; note that's only the small text file. The actual heavy
// seed-data builder is useExampleWorkspace.ts (assets/pages/modules content),
// which isn't a translation concern and needs its own dynamic import when
// next/ grows a "seed example workspace" action.
const NAMESPACE_LOADERS = {
  exampleWorkspace: {
    en: () => import('../../locales/exampleWorkspace/en.ts'),
    de: () => import('../../locales/exampleWorkspace/de.ts'),
  },
}

let locale = DEFAULT_LOCALE
let messages = {}

function normalizeLocale(value) {
  const short = value?.toLowerCase().split('-')[0]
  return SUPPORTED_LOCALES.includes(short) ? short : DEFAULT_LOCALE
}

async function readSavedLocale() {
  const saved = await db.app_settings.get(UI_LANGUAGE_SETTING_KEY)
  try {
    return saved?.value_json ? JSON.parse(saved.value_json) : null
  } catch {
    return null
  }
}

export async function initI18n() {
  const saved = await readSavedLocale()
  locale = normalizeLocale(saved ?? navigator.language)
  messages = (await CORE_LOADERS[locale]()).default
}

export function getLocale() {
  return locale
}

export function t(key, params = {}) {
  const value = key.split('.').reduce((node, part) => node?.[part], messages)
  if (typeof value !== 'string') return key
  return value.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
}

// On-demand namespace loading. Call once before a rarely-used feature needs
// its strings (e.g. right before offering "load example workspace" on an
// empty page list) — results are cached, so a second call is free.
export async function loadNamespace(name) {
  if (messages[name]) return messages[name]
  const loader = NAMESPACE_LOADERS[name]?.[locale] ?? NAMESPACE_LOADERS[name]?.[DEFAULT_LOCALE]
  if (!loader) return null
  messages[name] = (await loader()).default
  return messages[name]
}
