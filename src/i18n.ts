import { createI18n, type I18n } from 'vue-i18n'

export const UI_LANGUAGE_SETTING_KEY = 'ui_language'
export const SUPPORTED_LOCALES = ['en', 'de'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: SupportedLocale = 'en'

type LocaleMessages = Record<string, any>

const LOCALE_LOADERS: Record<SupportedLocale, () => Promise<{ default: LocaleMessages }>> = {
  en: () => import('@/locales/en'),
  de: () => import('@/locales/de'),
}

const loadedLocaleMessages = new Map<SupportedLocale, LocaleMessages>()
let speedtabI18n: I18n | null = null

function normalizeLocale(value: string | null | undefined): SupportedLocale {
  if (!value) return DEFAULT_LOCALE
  const normalized = value.toLowerCase().split('-')[0]
  return SUPPORTED_LOCALES.includes(normalized as SupportedLocale)
    ? normalized as SupportedLocale
    : DEFAULT_LOCALE
}

export function resolveSupportedLocale(value: string | null | undefined): SupportedLocale {
  return normalizeLocale(value)
}

export function detectPreferredLocale(): SupportedLocale {
  const browserLocale = typeof navigator === 'undefined' ? null : navigator.language
  return normalizeLocale(browserLocale)
}

export async function loadLocaleMessages(locale: SupportedLocale): Promise<LocaleMessages> {
  const cached = loadedLocaleMessages.get(locale)
  if (cached) return cached

  const mod = await LOCALE_LOADERS[locale]()
  loadedLocaleMessages.set(locale, mod.default)
  return mod.default
}

export async function createSpeedtabI18n(initialLocale?: string | null): Promise<I18n> {
  const locale = normalizeLocale(initialLocale ?? detectPreferredLocale())
  const messages = Object.fromEntries(
    await Promise.all(
      Array.from(new Set([DEFAULT_LOCALE, locale])).map(async (entry) => [entry, await loadLocaleMessages(entry)] as const),
    ),
  )

  speedtabI18n = createI18n({
    legacy: false,
    locale,
    fallbackLocale: DEFAULT_LOCALE,
    messages,
  })
  return speedtabI18n
}

export function getSpeedtabI18n(): I18n | null {
  return speedtabI18n
}
