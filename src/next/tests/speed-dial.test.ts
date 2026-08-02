import {describe, expect, it} from 'vitest'
import {getFixedModuleColumnSpan, isBookmarkModuleType} from '../config/module-types.js'
import {normalizeSpeedDialImagePadding} from '../config/speed-dial.js'
import {renderBookmarkCrudForm, shouldAutoDetectBookmarkColors} from '../features/modules/bookmark-form.js'
import {adaptModule, renderModuleBody} from '../features/modules/registry.js'
import {renderCustomizerForm} from '../features/customizer/render.js'
import {renderPageGrid} from '../features/pages/modules/render.js'
import {renderSpeedDialModule} from '../features/pages/modules/speed-dial/render.js'
import {readQuickModuleSettingValue} from '../utils/module-quick-settings.js'

describe('Speed Dial module contract', () => {
  it('is bookmark-backed and fixed to all 12 columns', () => {
    expect(isBookmarkModuleType('speed-dial')).toBe(true)
    expect(getFixedModuleColumnSpan('speed-dial')).toBe(12)
  })

  it('renders a transparent, top-aligned, 12-column module card', () => {
    const html = renderPageGrid(
      {config_json: JSON.stringify({modulesPerRow: 3})},
      [{
        id: 9,
        sync_id: 'speed-dial-1',
        type: 'speed-dial',
        title: 'Start',
        config_json: JSON.stringify({layout: {'module-column-span': 4}}),
        tabs: [],
      }],
      {hydrateBodies: false},
    )

    expect(html).toContain('data-page-align="start"')
    expect(html).toContain('data-module-type="speed-dial"')
    expect(html).toContain('data-surface="transparent"')
    expect(html).toContain('--st-grid-col-span: 12')
  })

  it('hides a single collection nav and uses link buttons for multiple collections', () => {
    const single = renderSpeedDialModule([
      {id: 1, sync_id: 'tab-1', title: 'Main', bookmarks: []},
    ], '', 9, 'speed-dial-1')
    const multiple = renderSpeedDialModule([
      {id: 1, sync_id: 'tab-1', title: 'Main', bookmarks: []},
      {id: 2, sync_id: 'tab-2', title: 'Work', bookmarks: []},
    ], '', 9, 'speed-dial-1')

    expect(single).toContain('data-module-presentation="speed-dial" data-single-tab')
    expect(multiple).not.toContain('data-single-tab')
    expect(multiple.match(/data-btn="link"/g)).toHaveLength(2)
  })

  it('only derives tile colors for untouched new bookmarks', () => {
    const baseState = {
      moduleType: 'speed-dial',
      record: null,
      colorsEdited: false,
      color: '',
      backgroundColor: '',
    }

    expect(shouldAutoDetectBookmarkColors(baseState)).toBe(true)
    expect(shouldAutoDetectBookmarkColors({...baseState, colorsEdited: true})).toBe(false)
    expect(shouldAutoDetectBookmarkColors({...baseState, record: {id: 1}})).toBe(false)
  })

  it('renders content alignment first in Layout with exactly three positions', () => {
    const html = renderCustomizerForm('module', 'speed-dial', {layout: {}})
    const layoutHtml = html.slice(html.indexOf('data-section="layout"'))

    expect(layoutHtml.indexOf('name="speed-dial-content-align"'))
      .toBeLessThan(layoutHtml.indexOf('name="module-min-height-px"'))
    expect(layoutHtml).toContain('<option value="start" selected>')
    expect(layoutHtml).toContain('<option value="center">')
    expect(layoutHtml).toContain('<option value="end">')
  })

  it('offers Fill Available Page Height as a live Quick Setting', () => {
    const html = renderModuleBody(adaptModule({
      id: 9,
      sync_id: 'speed-dial-1',
      type: 'speed-dial',
      title: 'Start',
      tabs: [{id: 1, sync_id: 'tab-1', title: 'Main', bookmarks: []}],
    }))
    expect(html).toContain('data-quick-setting-key="speed-dial-fill-height"')
    expect(html).toContain('data-quick-setting-section="layout"')

    const moduleRoot = document.createElement('section')
    expect(readQuickModuleSettingValue(moduleRoot, 'speed-dial-fill-height')).toBe(false)
    moduleRoot.setAttribute('data-speed-dial-fill-height', '')
    expect(readQuickModuleSettingValue(moduleRoot, 'speed-dial-fill-height')).toBe(true)
  })

  it('applies bounded per-tile padding directly to custom images', () => {
    const html = renderSpeedDialModule([{
      id: 1,
      sync_id: 'tab-1',
      title: 'Main',
      bookmarks: [{
        id: 2,
        sync_id: 'bookmark-1',
        title: 'Example',
        url: 'https://example.com',
        preview_asset_id: 7,
        preview_padding: 12,
      }],
    }], '', 9, 'speed-dial-1')

    expect(html).toContain('style="--st-speed-dial-image-padding:12px"')
    expect(normalizeSpeedDialImagePadding(-4)).toBe(0)
    expect(normalizeSpeedDialImagePadding(80)).toBe(64)
  })

  it('shows image padding only for a Speed Dial bookmark with a custom image', () => {
    const state = {
      record: {id: 2, sync_id: 'bookmark-1'},
      moduleSyncId: 'speed-dial-1',
      moduleType: 'speed-dial',
      parentId: 1,
      parentSyncId: 'tab-1',
      title: 'Example',
      url: 'https://example.com',
      description: '',
      color: '',
      backgroundColor: '',
      previewPadding: 12,
      selectedFaviconAssetId: null,
      selectedFaviconAssetUrl: null,
      selectedPreviewAssetId: 7,
      selectedPreviewAssetUrl: 'blob:preview',
      croppedPreviewUrl: null,
      croppedPreviewBlob: null,
      imageDataUrl: null,
      isFaviconPickerOpen: false,
      isPreviewPickerOpen: false,
      hasUnlockedFaviconPicker: false,
      isTesting: false,
      testError: null,
      testSuccess: false,
    }

    expect(renderBookmarkCrudForm(state)).toContain('name="preview_padding"')
    expect(renderBookmarkCrudForm({...state, moduleType: 'tabs'})).not.toContain('name="preview_padding"')
    expect(renderBookmarkCrudForm({...state, selectedPreviewAssetUrl: null})).not.toContain('name="preview_padding"')
  })
})
