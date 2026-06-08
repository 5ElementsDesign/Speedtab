import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import FeedSourceForm from './FeedSourceForm.vue'

const feedMocks = vi.hoisted(() => ({
  fetchFeed: vi.fn(),
  parseFeed: vi.fn(),
}))

vi.mock('@/composables/useFeed', () => ({
  useFeed: () => feedMocks,
}))

function setChromeSendMessage(impl: (message: unknown) => unknown | Promise<unknown>) {
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: vi.fn(impl),
    },
  })
}

function findButton(wrapper: ReturnType<typeof mount>, label: string) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text().trim() === label)
  expect(button, `Expected button "${label}" to exist`).toBeDefined()
  return button!
}

describe('FeedSourceForm', () => {
  beforeEach(() => {
    feedMocks.fetchFeed.mockReset()
    feedMocks.parseFeed.mockReset()
    setChromeSendMessage(async () => ({ ok: true, html: '', contentType: 'text/html', finalUrl: 'https://example.com/' }))
  })

  it('copies a failed feed URL to a clean site base URL and exposes the tested URL link', async () => {
    feedMocks.fetchFeed.mockRejectedValue(new Error('HTTP 404: '))

    const wrapper = mount(FeedSourceForm, {
      props: {
        collectionId: 1,
      },
    })

    const inputs = wrapper.findAll('input[type="url"]')
    expect(inputs).toHaveLength(2)
    await inputs[0].setValue('https://feeds.feedburner.com/symfony/blog#calendar-aligned-fixed-windows')

    expect(findButton(wrapper, 'Lookup').attributes('disabled')).toBeDefined()

    await findButton(wrapper, 'Test').trigger('click')
    await flushPromises()

    expect(feedMocks.fetchFeed).toHaveBeenCalledWith('https://feeds.feedburner.com/symfony/blog#calendar-aligned-fixed-windows')
    expect((inputs[1].element as HTMLInputElement).value).toBe('https://feeds.feedburner.com/')

    const openLink = wrapper.find('a[title]')
    expect(openLink.exists()).toBe(true)
    expect(openLink.text()).toBe('Open URL')
    expect(openLink.attributes('title')).toBe('https://feeds.feedburner.com/symfony/blog#calendar-aligned-fixed-windows')
    expect(findButton(wrapper, 'Lookup').attributes('disabled')).toBeUndefined()
  })

  it('discovers homepage feeds and auto-tests a selected candidate', async () => {
    setChromeSendMessage(async () => ({
      ok: true,
      html: `
        <html>
          <body>
            <a href="https://feeds.feedburner.com/symfony/blog" title="Symfony Blog RSS">Symfony Blog RSS</a>
          </body>
        </html>
      `,
      contentType: 'text/html; charset=utf-8',
      finalUrl: 'https://symfony.com/',
    }))
    feedMocks.fetchFeed.mockResolvedValue('<rss><channel><title>Symfony Blog</title><item><title>Latest</title></item></channel></rss>')
    feedMocks.parseFeed.mockReturnValue([{ title: 'Latest' }])

    const wrapper = mount(FeedSourceForm, {
      props: {
        collectionId: 1,
      },
    })

    const inputs = wrapper.findAll('input[type="url"]')
    await inputs[1].setValue('https://symfony.com/')

    await findButton(wrapper, 'Lookup').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Found 1 possible feed.')
    expect(wrapper.text()).toContain('https://feeds.feedburner.com/symfony/blog')

    await wrapper.findAll('button').find((candidate) =>
      candidate.text().includes('https://feeds.feedburner.com/symfony/blog')
    )!.trigger('click')
    await flushPromises()

    expect(feedMocks.fetchFeed).toHaveBeenCalledWith('https://feeds.feedburner.com/symfony/blog')
    expect(feedMocks.parseFeed).toHaveBeenCalled()
    expect((inputs[0].element as HTMLInputElement).value).toBe('https://feeds.feedburner.com/symfony/blog')
    expect(wrapper.text()).toContain('Connection successful!')
  })
})
