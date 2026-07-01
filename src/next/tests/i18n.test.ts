import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db as testDb } from '../../db/db'

// Mock the global db instance imported by utils/i18n.js
vi.mock('../../db/db', async (importOriginal) => {
  const actual = (await importOriginal()) as any
  const { IDBFactory, IDBKeyRange } = await import('fake-indexeddb')
  const testDb = new actual.SpeedtabDB({ indexedDB: new IDBFactory(), IDBKeyRange })
  return {
    ...actual,
    db: testDb,
  }
})

import { getLocale, initI18n, t } from '../utils/i18n.js'

describe('i18n utility', () => {
  beforeEach(async () => {
    await testDb.open()
  })

  afterEach(async () => {
    await testDb.app_settings.clear()
    await testDb.close()
    vi.unstubAllGlobals()
  })

  it('initializes with default locale if no settings are present', async () => {
    // navigator.language is mocked or defaults to 'en-US' in JSDOM
    await initI18n()
    expect(getLocale()).toBe('en')
  })

  it('initializes with German locale if browser language is German', async () => {
    vi.stubGlobal('navigator', { language: 'de-DE' })
    await initI18n()
    expect(getLocale()).toBe('de')
  })

  it('initializes with saved setting locale', async () => {
    await testDb.app_settings.put({
      key: 'ui_language',
      value_json: JSON.stringify('de'),
      updated_at: Date.now(),
    })
    await initI18n()
    expect(getLocale()).toBe('de')
  })

  it('translates nested keys successfully', async () => {
    await initI18n()
    const result = t('common.save')
    expect(result).toBe('Save')
  })

  it('returns key name if translation does not exist', async () => {
    await initI18n()
    const result = t('common.nonexistent_key_123')
    expect(result).toBe('common.nonexistent_key_123')
  })

  it('interpolates parameters correctly', async () => {
    await initI18n()
    const result = t('app.searchResults', { count: 5, query: 'vue' })
    expect(result).toBe('5 results for "vue"')
  })
})
