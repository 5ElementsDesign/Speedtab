import {describe, expect, it, vi} from 'vitest'
import {activateFirstModuleTab} from '../utils/module-tabs.js'

describe('module tab fallback', () => {
  it('clicks the first remaining tab opener', () => {
    const moduleRoot = document.createElement('section')
    moduleRoot.innerHTML = `
      <div data-yai-tabs>
        <nav data-controller>
          <button data-open="tab-2">Second</button>
          <button data-open="tab-3">Third</button>
        </nav>
      </div>
    `
    const tabs = moduleRoot.querySelectorAll('[data-open]')
    const firstClick = vi.spyOn(tabs[0] as HTMLElement, 'click')
    const secondClick = vi.spyOn(tabs[1] as HTMLElement, 'click')

    expect(activateFirstModuleTab(moduleRoot)).toBe(true)
    expect(firstClick).toHaveBeenCalledOnce()
    expect(secondClick).not.toHaveBeenCalled()
  })

  it('does nothing when no tabs remain', () => {
    const moduleRoot = document.createElement('section')
    expect(activateFirstModuleTab(moduleRoot)).toBe(false)
  })
})
