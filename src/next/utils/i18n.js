import {db} from '../../db/db.ts'

export const SUPPORTED_LOCALES = ['en', 'de', 'nl', 'tr', 'hi', 'ru', 'zh', 'zh_CN']
export const DEFAULT_LOCALE = 'en'
const UI_LANGUAGE_SETTING_KEY = 'ui_language'

// Core UI strings — one of these loads on init, never both. Same lazy-per-locale
// split the legacy app already uses (src/i18n.ts), so a German browser never
// fetches the English strings and vice versa.
const CORE_LOADERS = {
  en: () => import('../../locales/en.ts'),
  de: () => import('../../locales/de.ts'),
  nl: () => import('../../locales/nl.ts'),
  tr: () => import('../../locales/tr.ts'),
  hi: () => import('../../locales/hi.ts'),
  ru: () => import('../../locales/ru.ts'),
  zh: () => import('../../locales/zh_CN.ts'),
  zh_CN: () => import('../../locales/zh_CN.ts'),
}

let locale = DEFAULT_LOCALE
let messages = {}

// Aliases for locales whose canonical form is region-specific (e.g. 'zh' → 'zh_CN').
// normalizeLocale always returns a value that is safe to use both as a locale key
// and as the matching folder name under examples/.
const LOCALE_ALIASES = { zh: 'zh_CN' }

export function normalizeLocale(value) {
  if (value == null) return DEFAULT_LOCALE
  const lower = String(value).toLowerCase()
  const exact = SUPPORTED_LOCALES.find((l) => l.toLowerCase() === lower)
  if (exact) return LOCALE_ALIASES[exact] ?? exact
  const short = lower.split('-')[0]
  const match = SUPPORTED_LOCALES.find((l) => l.toLowerCase() === short)
  return match ? (LOCALE_ALIASES[match] ?? match) : DEFAULT_LOCALE
}

// Internal locale identifiers use underscores (e.g. 'zh_CN') so they line up
// with the SUPPORTED_LOCALES keys and the folder names under examples/.
// Web platform APIs (Intl.*, document.documentElement.lang) expect BCP-47,
// which uses hyphens (e.g. 'zh-CN'). Convert at the boundary.
export function toBcp47(locale) {
  return String(locale).replace(/_/g, '-')
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
    document.documentElement.lang = toBcp47(locale)
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
