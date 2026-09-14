import {describe, expect, it} from 'vitest'
import {YaiTabs} from '../../lib/yai/yai-tabs.js'

describe('YaiTabs hash initialization', () => {
  it('preserves defaults inside nested components unrelated to the hash route', () => {
    document.body.innerHTML = `
      <div data-yai-tabs data-ref-path="pages">
        <nav data-controller><button data-open="home" data-default>Home</button></nav>
        <div data-content>
          <div data-tab="home">
            <div data-yai-tabs>
              <nav data-controller><button data-open="welcome" data-default>Welcome</button></nav>
              <div data-content><div data-tab="welcome"></div></div>
            </div>
          </div>
        </div>
      </div>
    `

    const tabs = Object.create(YaiTabs.prototype) as YaiTabs
    tabs.config = {rootSelector: '[data-yai-tabs]'} as any
    tabs.tabOpenAttribute = 'data-open'
    tabs.routeMap = new Map()
    tabs.parseHash = () => ({pages: 'home'})
    tabs.$ = (selector: string) => document.querySelector(selector)
    tabs.find = (selector: string, container: Element = document) => container.querySelector(selector)

    tabs.processHashBeforeInit()

    expect(document.querySelector('[data-ref-path="pages"] > [data-controller] [data-open="home"]')?.hasAttribute('data-default')).toBe(true)
    const nested = document.querySelector('[data-yai-tabs]:not([data-ref-path])')
    expect(nested?.querySelector('[data-default]')).toBeTruthy()
  })

  it('hydrates a hash route when its component mounts after initial boot', () => {
    document.body.innerHTML = `
      <div data-yai-tabs data-ref-path="note-help">
        <nav data-controller>
          <button data-open="overview" data-default>Overview</button>
          <button data-open="details">Details</button>
        </nav>
        <div data-content><div data-tab="overview"></div><div data-tab="details"></div></div>
      </div>
    `

    const tabs = Object.create(YaiTabs.prototype) as YaiTabs
    tabs.tabOpenAttribute = 'data-open'
    tabs.routeMap = new Map()
    tabs.parseHash = () => ({'note-help': 'details'})
    tabs.find = (selector: string, container: Element = document) => container.querySelector(selector)

    const container = document.querySelector('[data-ref-path="note-help"]') as HTMLElement
    tabs._applyHashRoutesToContainers([container])

    expect(container.querySelector('[data-open="overview"]')?.hasAttribute('data-default')).toBe(false)
    expect(container.querySelector('[data-open="details"]')?.hasAttribute('data-default')).toBe(true)
    expect(tabs.routeMap.get('note-help')).toBe('details')
  })
})
