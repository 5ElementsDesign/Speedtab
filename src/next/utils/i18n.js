import {db} from '../../db/db.ts'

export const SUPPORTED_LOCALES = ['en', 'de', 'tr', 'hi']
export const DEFAULT_LOCALE = 'en'
const UI_LANGUAGE_SETTING_KEY = 'ui_language'

// Core UI strings — one of these loads on init, never both. Same lazy-per-locale
// split the legacy app already uses (src/i18n.ts), so a German browser never
// fetches the English strings and vice versa.
const CORE_LOADERS = {
  en: () => import('../../locales/en.ts'),
  de: () => import('../../locales/de.ts'),
  tr: () => import('../../locales/tr.ts'),
  hi: () => import('../../locales/hi.ts'),
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
  if (document?.documentElement) {
    document.documentElement.lang = locale
  }
}

export function getLocale() {
  return locale
}

export function t(key, params = {}) {
  const value = key.split('.').reduce((node, part) => node?.[part], messages)
  if (typeof value !== 'string') return key
  return value.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
}
