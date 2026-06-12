import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export function useLocaleFormatters() {
  const { locale } = useI18n()
  const currentLocale = computed(() => locale.value || 'en')

  function toDate(value: number | string | Date) {
    return value instanceof Date ? value : new Date(value)
  }

  function formatDate(value: number | string | Date, options?: Intl.DateTimeFormatOptions) {
    return new Intl.DateTimeFormat(currentLocale.value, options).format(toDate(value))
  }

  function formatDateTime(value: number | string | Date, options?: Intl.DateTimeFormatOptions) {
    return new Intl.DateTimeFormat(currentLocale.value, options).format(toDate(value))
  }

  function formatTime(value: number | string | Date, options?: Intl.DateTimeFormatOptions) {
    return new Intl.DateTimeFormat(currentLocale.value, options).format(toDate(value))
  }

  function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
    return new Intl.NumberFormat(currentLocale.value, options).format(value)
  }

  return {
    currentLocale,
    formatDate,
    formatDateTime,
    formatTime,
    formatNumber,
  }
}
