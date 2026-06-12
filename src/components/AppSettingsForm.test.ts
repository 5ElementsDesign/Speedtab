import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import AppSettingsForm from './AppSettingsForm.vue'
import { createTestI18n } from '@/test/createTestI18n'

vi.mock('@/composables/useLiveQuery', () => ({
  useLiveQuery: () => ({
    data: ref([]),
    loading: ref(false),
    error: ref(null),
  }),
}))

const baseProps = {
  backgroundAssetId: null,
  backgroundTheme: null,
  backgroundPreset: 'dark',
  backgroundProperties: 'linear-gradient(90deg, #111, #333)',
  uiLanguage: 'en',
  openBookmarksInNewTab: false,
  feedSearchUrlTemplate: 'https://www.google.com/search?q=%s',
  feedContentScale: 1,
  noteContentScale: 1,
  widgetRailEnabled: false,
  widgetRailPosition: 'bottom' as const,
  widgetRailAlign: 'left' as const,
  weatherEnabled: false,
  weatherUnits: 'metric' as const,
  weatherRefreshIntervalMinutes: 30,
  weatherDisplayLabel: '',
  weatherLocation: null,
  weatherApiKey: '',
}

describe('AppSettingsForm', () => {
  const originalCSS = globalThis.CSS

  beforeEach(() => {
    vi.stubGlobal('CSS', {
      supports: vi.fn((_property: string, value: string) => value.includes('linear-gradient')),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (originalCSS) {
      globalThis.CSS = originalCSS as typeof globalThis.CSS
    } else {
      delete (globalThis as any).CSS
    }
  })

  it('clears the effective custom background when the input becomes invalid', async () => {
    const wrapper = mount(AppSettingsForm, {
      props: baseProps,
      global: {
        plugins: [createTestI18n()],
      },
    })

    const input = wrapper.get('input[name="background_properties"]')
    expect((input.element as HTMLInputElement).value).toBe(baseProps.backgroundProperties)

    await input.setValue('background: definitely-not-valid-css;')
    await flushPromises()

    expect(wrapper.text()).toContain('Not a valid CSS background value.')

    const previews = wrapper.emitted('preview') ?? []
    const lastPreview = previews.at(-1)?.[0] as { backgroundProperties?: string | null } | undefined
    expect(lastPreview?.backgroundProperties).toBeNull()
  })
})
