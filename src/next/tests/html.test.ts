import { describe, it, expect } from 'vitest'
import { escapeHtml, buildAttributes } from '../utils/html.js'

describe('escapeHtml', () => {
  it('returns plain strings unchanged', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World')
  })

  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })

  it('escapes less-than signs', () => {
    expect(escapeHtml('<div>')).toBe('&lt;div&gt;')
  })

  it('escapes double quotes', () => {
    expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;')
  })

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s')
  })

  it('escapes all special characters together', () => {
    expect(escapeHtml('<a href="x&y">it\'s</a>')).toBe(
      '&lt;a href=&quot;x&amp;y&quot;&gt;it&#39;s&lt;/a&gt;'
    )
  })

  it('coerces non-string values to string', () => {
    expect(escapeHtml(42 as unknown as string)).toBe('42')
    expect(escapeHtml(null as unknown as string)).toBe('null')
  })
})

describe('buildAttributes', () => {
  it('returns empty string for no attributes', () => {
    expect(buildAttributes({})).toBe('')
  })

  it('builds a single attribute string', () => {
    expect(buildAttributes({ id: 'main' })).toBe(' id="main"')
  })

  it('builds multiple attributes', () => {
    const result = buildAttributes({ type: 'text', name: 'email' })
    expect(result).toContain(' type="text"')
    expect(result).toContain(' name="email"')
  })

  it('escapes special characters in attribute names and values', () => {
    const result = buildAttributes({ 'data-label': '<Click & Go>' })
    expect(result).toBe(' data-label="&lt;Click &amp; Go&gt;"')
  })

  it('escapes quotes in attribute values', () => {
    const result = buildAttributes({ title: '"hello"' })
    expect(result).toBe(' title="&quot;hello&quot;"')
  })

  it('can skip empty and falsey values for primitive render helpers', () => {
    const result = buildAttributes({
      'data-test': 'ok',
      hidden: false,
      empty: '',
      nil: null,
      undef: undefined,
    }, {
      leadingSpace: false,
      skipFalsy: true,
      booleanBare: true,
    })
    expect(result).toBe('data-test="ok"')
  })

  it('can render boolean attributes without a value', () => {
    const result = buildAttributes({
      disabled: true,
      'data-id': 3,
    }, {
      leadingSpace: false,
      skipFalsy: true,
      booleanBare: true,
    })
    expect(result).toBe('disabled data-id="3"')
  })
})
