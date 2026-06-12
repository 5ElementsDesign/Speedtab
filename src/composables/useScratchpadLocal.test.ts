import {
  appendScratchpadContent,
  DEFAULT_SCRATCHPAD_STATE,
  getScratchpadState,
  type ScratchpadState,
  updateScratchpadState,
} from '@/composables/useScratchpadLocal'
import { afterEach, describe, expect, it, vi } from 'vitest'

type StoredValue = ScratchpadState | undefined

function installChromeStorageMock(seed?: StoredValue) {
  let storedValue = seed
  const local = {
    get: vi.fn((keys: string | string[] | Record<string, unknown> | null | undefined, callback: (items: Record<string, StoredValue>) => void) => {
      const requestedKeys = Array.isArray(keys)
        ? keys
        : typeof keys === 'string'
          ? [keys]
          : keys && typeof keys === 'object'
            ? Object.keys(keys)
            : []

      const result: Record<string, StoredValue> = {}
      if (requestedKeys.includes('speedtab_scratchpad') && storedValue !== undefined) {
        result.speedtab_scratchpad = storedValue
      }
      callback(result)
    }),
    set: vi.fn((items: Record<string, StoredValue>, callback?: () => void) => {
      storedValue = items.speedtab_scratchpad
      callback?.()
    }),
  }

  vi.stubGlobal('chrome', {
    runtime: {},
    storage: { local },
  })

  return {
    local,
    read: () => storedValue,
  }
}

describe('useScratchpadLocal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the default state when nothing is stored', async () => {
    installChromeStorageMock()

    await expect(getScratchpadState()).resolves.toEqual(DEFAULT_SCRATCHPAD_STATE)
  })

  it('persists and normalizes scratchpad updates in chrome.storage.local', async () => {
    const storage = installChromeStorageMock({
      ...DEFAULT_SCRATCHPAD_STATE,
      open: true,
      left: 24,
    })

    const nextState = await updateScratchpadState({
      top: 4,
      width: 5000,
      height: 120,
      content: 'Draft text',
    })

    expect(nextState).toEqual({
      open: true,
      top: 8,
      left: 24,
      width: 1600,
      height: 140,
      content: 'Draft text',
    })
    expect(storage.local.set).toHaveBeenCalledTimes(1)
    expect(storage.read()).toEqual(nextState)
  })

  it('appends selection text using the expected divider', async () => {
    const storage = installChromeStorageMock({
      ...DEFAULT_SCRATCHPAD_STATE,
      content: 'First note',
    })

    const nextState = await appendScratchpadContent('Second note')

    expect(nextState.content).toBe('First note\n\n----\n\nSecond note')
    expect(storage.read()?.content).toBe('First note\n\n----\n\nSecond note')
  })
})
