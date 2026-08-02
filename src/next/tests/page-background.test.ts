import {afterEach, describe, expect, it, vi} from 'vitest'
import {renderPageForm, syncPageFormActiveHint} from '../features/pages/page-form.js'
import {addBgSet, transitionWorkspaceBackground} from '../utils/workspace-background.js'

afterEach(() => {
  document.body.removeAttribute('data-workspace-background-layer')
  document.body.removeAttribute('style')
  vi.unstubAllGlobals()
})

describe('page background editor', () => {
  it('reuses the shared Background section with page actions', () => {
    const html = renderPageForm({
      id: 1,
      sync_id: 'page-sync-1',
      title: 'Page',
      config_json: JSON.stringify({modulesPerRow: 2, maxWidth: null}),
    }, {
      backgroundData: {
        background_properties: 'linear-gradient(red, blue)',
        background_asset_id: null,
        bgArchive: [{id: 1, name: 'BG #1', value: '#123456'}],
        bgAssets: [{id: 2, _objectUrl: 'blob:background'}],
      },
    })

    expect(html).toContain('value="linear-gradient(red, blue)"')
    expect(html).toContain('data-input="previewPageBgProperty"')
    expect(html).toContain('data-change="savePageBgProperty"')
    expect(html).toContain('data-click="loadPageBgArchiveItem"')
    expect(html).toContain('data-click="loadPageBgAsset"')
    expect(html).toContain('data-click="deleteBgArchiveItem"')
    expect(html).toContain('data-click="deleteBgAsset"')
    expect(html).toContain('data-change="uploadPageBgWallpaper"')
    expect(html).toContain('data-page-form-inactive-hint hidden')
  })

  it('shows the hint only while the edited page is not active', () => {
    const host = document.createElement('div')
    host.innerHTML = renderPageForm({
      id: 1,
      sync_id: 'page-sync-1',
      title: 'Page',
    }, {
      backgroundData: {
        background_properties: '',
        background_asset_id: null,
        bgArchive: [],
        bgAssets: [],
      },
    })
    const form = host.querySelector('[data-page-form]')
    const hint = host.querySelector('[data-page-form-inactive-hint]') as HTMLElement

    syncPageFormActiveHint(form, 'page-sync-2')
    expect(hint.hidden).toBe(false)

    syncPageFormActiveHint(form, 'page-sync-1')
    expect(hint.hidden).toBe(true)
  })

  it('does not show Background controls before a page exists', () => {
    const html = renderPageForm({title: 'New Page'}, {
      backgroundData: {
        background_properties: '#123456',
        bgArchive: [],
        bgAssets: [],
      },
    })

    expect(html).not.toContain('previewPageBgProperty')
    expect(html).not.toContain('uploadPageBgWallpaper')
  })

  it('crossfades by preparing the hidden layer before making it active', async () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(performance.now())
      return 1
    })
    addBgSet('#111111')

    await transitionWorkspaceBackground('#222222')

    expect(document.body.style.getPropertyValue('--st-workspace-background-a')).toBe('#111111')
    expect(document.body.style.getPropertyValue('--st-workspace-background-b')).toBe('#222222')
    expect(document.body.style.getPropertyValue('--st-workspace-background')).toBe('#222222')
    expect(document.body.dataset.workspaceBackgroundLayer).toBe('b')
  })
})
