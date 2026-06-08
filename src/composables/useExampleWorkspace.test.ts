import { SpeedtabDB } from '@/db/db'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { WIDGET_SETTINGS_KEY, parseWidgetSettings } from './useWidgetSettings'
import { seedExampleWorkspace } from './useExampleWorkspace'

let db: SpeedtabDB

beforeEach(async () => {
  db = new SpeedtabDB({ indexedDB: new IDBFactory(), IDBKeyRange })
  await db.open()
})

afterEach(async () => {
  await db.delete()
})

describe('seedExampleWorkspace', () => {
  it('creates the curated starter workspace and widget settings', async () => {
    await seedExampleWorkspace(db)

    const pages = await db.pages.toArray()
    const modules = await db.modules.orderBy('sort_order').toArray()
    const collections = await db.collections.orderBy('sort_order').toArray()
    const tabs = await db.tabs.orderBy('sort_order').toArray()
    const notes = await db.notes.orderBy('sort_order').toArray()
    const feedSources = await db.feed_sources.orderBy('sort_order').toArray()

    expect(pages).toHaveLength(1)
    expect(JSON.parse(pages[0].config_json ?? '{}').modulesPerRow).toBe(12)

    expect(modules.map((module) => module.title)).toEqual(['Web', 'Notes', 'Qbox', 'News'])
    expect(JSON.parse(modules[0].config_json ?? '{}').column_span).toBe(7)
    expect(JSON.parse(modules[1].config_json ?? '{}').column_span).toBe(5)
    expect(JSON.parse(modules[2].config_json ?? '{}')).toMatchObject({
      column_span: 4,
      quicklinks: true,
      force_favicon: true,
      show_add_tile: false,
      show_hover_actions: false,
      open_in_new_tab: true,
    })
    expect(JSON.parse(modules[3].config_json ?? '{}').column_span).toBe(8)

    expect(collections.map((collection) => collection.title)).toEqual(['Apps', 'Start', 'AI', 'Breaking', 'Com', 'Features', '❔'])

    const appBookmarks = tabs.filter((tab) => tab.collection_id === collections.find((c) => c.title === 'Apps')?.id)
    const aiBookmarks = tabs.filter((tab) => tab.collection_id === collections.find((c) => c.title === 'AI')?.id)
    const toolBookmarks = tabs.filter((tab) => tab.collection_id === collections.find((c) => c.title === 'Com')?.id)
    expect(appBookmarks.map((tab) => tab.title)).toEqual(['Google', 'Gemini', 'Google Maps', 'Google Translate', 'YouTube'])
    expect(aiBookmarks.map((tab) => tab.title)).toEqual(['ChatGPT', 'Claude', 'Grok', 'Qwen', 'Duck.ai'])
    expect(toolBookmarks.map((tab) => tab.title)).toEqual(['WhatsApp', 'Telegram', 'Discord', 'Slack'])

    const startNotes = notes.filter((note) => note.collection_id === collections.find((c) => c.title === 'Start')?.id)
    const featureNotes = notes.filter((note) => note.collection_id === collections.find((c) => c.title === 'Features')?.id)
    const helpNotes = notes.filter((note) => note.collection_id === collections.find((c) => c.title === '❔')?.id)

    expect(startNotes.map((note) => note.title)).toContain('Welcome to Speedtab')
    expect(startNotes.find((note) => note.title === 'Welcome to Speedtab')?.style_token).toBe('default')
    expect(featureNotes.map((note) => note.title)).toEqual([
      'Bookmarks',
      'Notes',
      'Feed reader',
      'Weather widget',
      'HTML',
      'Assets',
      'CLEANUP',
    ])
    expect(featureNotes.find((note) => note.title === 'Bookmarks')?.style_token).toBe('info')
    expect(featureNotes.find((note) => note.title === 'Assets')?.style_token).toBe('default')
    expect(featureNotes.find((note) => note.title === 'HTML')?.style_token).toBe('default')
    expect(featureNotes.find((note) => note.title === 'HTML')?.meta_json).toBe(JSON.stringify({ language: 'html' }))
    expect(featureNotes.find((note) => note.title === 'Weather widget')?.style_token).toBe('warning')
    expect(helpNotes.map((note) => note.title)).toEqual([
      'About Speedtab',
      'Quick Start Tips',
      'FAQ',
      'Link Stack',
      'Code Snippets',
      'Data Safety',
    ])
    expect(helpNotes.find((note) => note.title === 'About Speedtab')?.style_token).toBe('dark')
    expect(helpNotes.find((note) => note.title === 'Code Snippets')?.meta_json).toBe(JSON.stringify({ language: 'css' }))

    const widgetSetting = await db.app_settings.get(WIDGET_SETTINGS_KEY)
    const widgetSettings = parseWidgetSettings(widgetSetting?.value_json)
    expect(widgetSettings.rail_enabled).toBe(true)
    expect(widgetSettings.rail_position).toBe('bottom')
    expect(widgetSettings.weather.enabled).toBe(true)
    expect(widgetSettings.weather.refresh_interval_minutes).toBe(120)
    expect(widgetSettings.weather.location).toBeNull()

    expect(feedSources).toHaveLength(1)
    expect(feedSources[0].title).toBe('GTmetrix Blog')
    expect(feedSources[0].feed_url).toBe('https://gtmetrix.com/blog/feed/')
    expect(feedSources[0].site_url).toBe('https://gtmetrix.com/blog/')
  })
})
