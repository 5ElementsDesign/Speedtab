/**
 * Phase 4 – DOMPurify sanitisation for the `html` note type.
 *
 * Runs in the jsdom environment so DOMPurify can attach to `window`.
 */
import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from './useSanitize'

describe('useSanitize – script and event handler removal', () => {
  it('strips <script> tags entirely', () => {
    const out = sanitizeHtml('<p>hello</p><script>alert(1)</script>')
    expect(out).toContain('<p>hello</p>')
    expect(out.toLowerCase()).not.toContain('<script')
    expect(out.toLowerCase()).not.toContain('alert')
  })

  it('strips inline event handler attributes', () => {
    const out = sanitizeHtml('<img src="x" onerror="alert(1)" />')
    expect(out.toLowerCase()).not.toContain('onerror')
    expect(out.toLowerCase()).not.toContain('alert')
  })

  it('strips onclick handlers on allowlisted tags', () => {
    const out = sanitizeHtml('<a href="https://example.com" onclick="steal()">x</a>')
    expect(out.toLowerCase()).not.toContain('onclick')
    expect(out.toLowerCase()).not.toContain('steal')
  })

  it('blocks javascript: URIs in href', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">click</a>')
    expect(out.toLowerCase()).not.toContain('javascript:')
    expect(out.toLowerCase()).not.toContain('alert')
  })

  it('strips <iframe>, <object>, <embed>, <form>, <input>', () => {
    const dirty = `
      <iframe src="https://evil.example"></iframe>
      <object data="evil.swf"></object>
      <embed src="evil.swf" />
      <form action="/evil"><input name="x"></form>
    `
    const out = sanitizeHtml(dirty).toLowerCase()
    expect(out).not.toContain('<iframe')
    expect(out).not.toContain('<object')
    expect(out).not.toContain('<embed')
    expect(out).not.toContain('<form')
    expect(out).not.toContain('<input')
  })

  it('strips <style> blocks (CSS-based exfiltration)', () => {
    const out = sanitizeHtml('<style>body{background:url(//evil)}</style><p>ok</p>')
    expect(out.toLowerCase()).not.toContain('<style')
    expect(out).toContain('<p>ok</p>')
  })
})

describe('useSanitize – allowlist preservation', () => {
  it('keeps safe formatting tags', () => {
    const html = '<p>Hi <strong>bold</strong> <em>em</em> <code>x</code></p>'
    expect(sanitizeHtml(html)).toBe(html)
  })

  it('keeps lists and headings', () => {
    const html = '<h2>Title</h2><ul><li>one</li><li>two</li></ul>'
    expect(sanitizeHtml(html)).toBe(html)
  })

  it('keeps tables with colspan/rowspan attrs', () => {
    const html = '<table><thead><tr><th colspan="2">H</th></tr></thead>'
                + '<tbody><tr><td>a</td><td>b</td></tr></tbody></table>'
    expect(sanitizeHtml(html)).toBe(html)
  })

  it('keeps blockquote, pre, code blocks', () => {
    const html = '<blockquote><p>quote</p></blockquote><pre><code>x = 1</code></pre>'
    expect(sanitizeHtml(html)).toBe(html)
  })
})

describe('useSanitize – anchor hardening hook', () => {
  it('adds target="_blank" and rel="noopener noreferrer" to all anchors', () => {
    const out = sanitizeHtml('<a href="https://example.com">x</a>')
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noopener noreferrer"')
  })

  it('overrides any user-supplied target value', () => {
    const out = sanitizeHtml('<a href="https://example.com" target="_self">x</a>')
    expect(out).toContain('target="_blank"')
  })
})

describe('useSanitize – data: URI and unknown protocols', () => {
  it('strips data: URIs from anchors', () => {
    const out = sanitizeHtml('<a href="data:text/html,<script>x</script>">x</a>')
    expect(out.toLowerCase()).not.toContain('data:')
  })

  it('strips unknown protocols like vbscript:', () => {
    const out = sanitizeHtml('<a href="vbscript:msgbox(1)">x</a>')
    expect(out.toLowerCase()).not.toContain('vbscript:')
  })
})
