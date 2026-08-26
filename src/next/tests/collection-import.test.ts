import {describe, expect, it} from 'vitest'
import {getCollectionImportKind, parseCollectionImport} from '../features/modules/collection-import.js'

describe('collection imports', () => {
  it('selects the content kind from the module type', () => {
    expect(getCollectionImportKind('tabs')).toBe('bookmark')
    expect(getCollectionImportKind('speed-dial')).toBe('bookmark')
    expect(getCollectionImportKind('notes')).toBe('note')
    expect(getCollectionImportKind('todo')).toBe('todo')
    expect(getCollectionImportKind('feeds')).toBe('')
  })

  it('normalizes and orders visual bookmarks without importing internal fields', () => {
    const items = parseCollectionImport(JSON.stringify([
      {title: 'Later', url: 'https://example.com', sort_order: 2, id: 3},
      {title: 'First', url: 'https://discord.com/app', sort_order: 1, meta_json: {source: 'manual'}},
    ]), 'speed-dial')

    expect(items.map((item) => item.title)).toEqual(['First', 'Later'])
    expect(items[0]).toMatchObject({url: 'https://discord.com/app', meta_json: '{"source":"manual"}'})
    expect(items[0]).not.toHaveProperty('id')
  })

  it('normalizes note and todo payloads', () => {
    expect(parseCollectionImport('[{"title":"Idea","content":"Keep this."}]', 'notes')[0]).toMatchObject({
      title: 'Idea', type: 'html', content: 'Keep this.', style_token: null,
    })

    expect(parseCollectionImport('[{"title":"Email","due_at":"2026-08-24T12:36:00+02:00","completed_at":null,"priority":"high"}]', 'todo')[0]).toMatchObject({
      title: 'Email', priority: 'high', completed_at: null,
    })
  })

  it('rejects malformed imports before anything can be persisted', () => {
    expect(() => parseCollectionImport('{', 'tabs')).toThrow('invalid-json')
    expect(() => parseCollectionImport('[]', 'todo')).toThrow('empty-import')
    expect(() => parseCollectionImport('[{"title":"No URL"}]', 'tabs')).toThrow('invalid-item')
    expect(() => parseCollectionImport('[{"title":"Bad date","due_at":"later"}]', 'todo')).toThrow('invalid-item')
  })
})
