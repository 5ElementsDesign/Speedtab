type StorageAreaLike = Pick<chrome.storage.StorageArea, 'get' | 'set'>

export type ScratchpadState = {
  open: boolean
  top: number
  left: number
  width: number
  height: number
  content: string
}

export const SCRATCHPAD_STORAGE_KEY = 'speedtab_scratchpad'

export const DEFAULT_SCRATCHPAD_STATE: ScratchpadState = {
  open: false,
  top: 56,
  left: 16,
  width: 360,
  height: 240,
  content: '',
}

function getStorageArea(): StorageAreaLike {
  const storageArea = globalThis.chrome?.storage?.local
  if (!storageArea) {
    throw new Error('chrome.storage.local is unavailable')
  }
  return storageArea
}

function getChromeRuntimeError(): Error | null {
  const message = globalThis.chrome?.runtime?.lastError?.message
  return message ? new Error(message) : null
}

function storageGet(area: StorageAreaLike, key: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    area.get([key], (items) => {
      const error = getChromeRuntimeError()
      if (error) {
        reject(error)
        return
      }
      resolve(items as Record<string, unknown>)
    })
  })
}

function storageSet(area: StorageAreaLike, values: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    area.set(values, () => {
      const error = getChromeRuntimeError()
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalizeScratchpadState(value: unknown): ScratchpadState {
  if (!value || typeof value !== 'object') return { ...DEFAULT_SCRATCHPAD_STATE }

  const parsed = value as Partial<ScratchpadState>
  return {
    open: parsed.open === true,
    top: clamp(typeof parsed.top === 'number' ? parsed.top : DEFAULT_SCRATCHPAD_STATE.top, 8, 4000),
    left: clamp(typeof parsed.left === 'number' ? parsed.left : DEFAULT_SCRATCHPAD_STATE.left, 8, 4000),
    width: clamp(typeof parsed.width === 'number' ? parsed.width : DEFAULT_SCRATCHPAD_STATE.width, 240, 1600),
    height: clamp(typeof parsed.height === 'number' ? parsed.height : DEFAULT_SCRATCHPAD_STATE.height, 140, 1200),
    content: typeof parsed.content === 'string' ? parsed.content : DEFAULT_SCRATCHPAD_STATE.content,
  }
}

export async function getScratchpadState(area: StorageAreaLike = getStorageArea()): Promise<ScratchpadState> {
  const stored = await storageGet(area, SCRATCHPAD_STORAGE_KEY)
  return normalizeScratchpadState(stored[SCRATCHPAD_STORAGE_KEY])
}

export async function updateScratchpadState(
  patch: Partial<ScratchpadState>,
  area: StorageAreaLike = getStorageArea(),
): Promise<ScratchpadState> {
  const nextState = normalizeScratchpadState({
    ...(await getScratchpadState(area)),
    ...patch,
  })

  await storageSet(area, {
    [SCRATCHPAD_STORAGE_KEY]: nextState,
  })

  return nextState
}

export async function appendScratchpadContent(
  text: string,
  area: StorageAreaLike = getStorageArea(),
): Promise<ScratchpadState> {
  const nextText = text.trim()
  const currentState = await getScratchpadState(area)
  const content = currentState.content.trim()
    ? `${currentState.content}\n\n----\n\n${nextText}`
    : nextText

  return updateScratchpadState({ content }, area)
}
