import {describe, expect, it} from 'vitest'
import {renderCustomizerList} from '../features/customizer/render.js'

describe('Customize sidepanel list', () => {
  it('lists every page before the current page modules', () => {
    const currentModule = document.createElement('section')
    currentModule.dataset.syncId = 'current-module'
    currentModule.dataset.moduleType = 'tabs'
    currentModule.innerHTML = '<h2 data-module-card-title>Current Module</h2>'
    const html = renderCustomizerList([
      {sync_id: 'page-one', title: 'Page One'},
      {sync_id: 'page-two', title: 'Page Two'},
    ], [currentModule])

    const pageOneIndex = html.indexOf('data-page-sync-id="page-one"')
    const pageTwoIndex = html.indexOf('data-page-sync-id="page-two"')
    const moduleIndex = html.indexOf('data-sync-id="current-module"')

    expect(pageOneIndex).toBeGreaterThan(-1)
    expect(pageOneIndex).toBeLessThan(pageTwoIndex)
    expect(pageTwoIndex).toBeLessThan(moduleIndex)
  })

  it('keeps all pages visible when the current page has no modules', () => {
    const html = renderCustomizerList([
      {sync_id: 'empty-page', title: 'Empty Page'},
      {sync_id: 'other-page', title: 'Other Page'},
    ], [])

    expect(html).toContain('data-page-sync-id="empty-page"')
    expect(html).toContain('data-page-sync-id="other-page"')
  })
})
