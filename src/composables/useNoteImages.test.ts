/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { extractNoteImageAssetIds, renderNoteHtmlWithAssets } from './useNoteImages'

describe('useNoteImages', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    URL.createObjectURL = vi.fn(() => 'blob:test-note-image')
    URL.revokeObjectURL = vi.fn()
  })

  it('does not treat asset tokens inside code-like wrappers as real image references', () => {
    const content = `
      <picture>{{asset:image:11}}</picture>
      <pre><code>&lt;figure&gt;
        {{asset:image:15}}
      &lt;/figure&gt;</code></pre>
    `

    expect(extractNoteImageAssetIds(content)).toEqual([11])
  })

  it('renders tokens in normal html flow but preserves example tokens inside pre/code', async () => {
    const database = {
      assets: {
        get: vi.fn(async (id: number) => ({
          id,
          blob: new Blob(['img'], { type: 'image/png' }),
        })),
      },
    } as never

    const content = `
      <picture>{{asset:image:11}}</picture>
      <pre><code>&lt;figure&gt;
        {{asset:image:15}}
        {{asset:image:16}}
      &lt;/figure&gt;</code></pre>
    `

    const rendered = await renderNoteHtmlWithAssets(content, database)

    expect(rendered.html).toContain('<picture><img')
    expect(rendered.html).toContain('{{asset:image:15}}')
    expect(rendered.html).toContain('{{asset:image:16}}')
    expect(rendered.html).not.toContain('<code><img')
  })

  it('reuses cached object urls for the same asset across repeated renders until all renders are revoked', async () => {
    const assetId = 99
    const database = {
      assets: {
        get: vi.fn(async (id: number) => ({
          id,
          checksum: `checksum:${id}`,
          blob: new Blob(['img'], { type: 'image/png' }),
        })),
      },
    } as never

    const first = await renderNoteHtmlWithAssets(`<picture>{{asset:image:${assetId}}}</picture>`, database)
    const second = await renderNoteHtmlWithAssets(`<picture>{{asset:image:${assetId}}}</picture>`, database)

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)

    first.revoke()
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()

    second.revoke()
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
  })
})
