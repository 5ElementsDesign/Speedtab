import {describe, expect, it} from 'vitest'

import {parseExampleNote} from '../features/example-workspace/seed.js'

describe('example workspace note parser', () => {
  it('derives html note title from filename and parses color metadata', () => {
    const parsed = parseExampleNote(
      '../../../../examples/en/workspace-1/Main/Notes - notes/Start/Welcome to Speedtab.html',
      'Color: dark\n\n<h2>Hello</h2>',
    )

    expect(parsed.title).toBe('Welcome to Speedtab')
    expect(parsed.type).toBe('html')
    expect(parsed.style_token).toBe('dark')
    expect(parsed.content).toBe('<h2>Hello</h2>')
  })

  it('parses encrypted note passphrase metadata', () => {
    const parsed = parseExampleNote(
      '../../../../examples/en/workspace-1/Main/Notes - notes/Start/Secret.crypt',
      'Color: danger\nPassphrase: Secret\n\nSpeedtab is awesome!',
    )

    expect(parsed.type).toBe('crypt')
    expect(parsed.passphrase).toBe('Secret')
    expect(parsed.style_token).toBe('danger')
  })

  it('parses code language metadata', () => {
    const parsed = parseExampleNote(
      '../../../../examples/en/workspace-1/Main/Notes - notes/❔/Code Snippets.code',
      'Language: css\n\n:root { --x: 1; }',
    )

    expect(parsed.type).toBe('code')
    expect(parsed.language).toBe('css')
  })
})
