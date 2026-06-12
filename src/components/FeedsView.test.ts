import 'fake-indexeddb/auto'

import { db, makeCreateMetadata } from '@/db/db'
import type { Collection, FeedItem, FeedSource } from '@/types/db'
import { createTestI18n } from '@/test/createTestI18n'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FeedsView from './FeedsView.vue'

vi.mock('@/composables/useFavicon', () => ({
  useFavicon: () => ({
    getFaviconUrl: () => '/stub-favicon.ico',
  }),
}))

vi.mock('@/composables/useFeed', () => ({
  useFeed: () => ({
    fetchFeed: vi.fn(),
    parseFeed: vi.fn(() => []),
  }),
}))

function withMeta<T extends object>(data: T) {
  return { ...makeCreateMetadata(1_700_000_000_000), ...data }
}

async function seedFeedSource(collectionId: number, title: string, sortOrder = 0) {
  return db.feed_sources.add(withMeta({
    collection_id: collectionId,
    title,
    feed_url: `https://${title.toLowerCase().replace(/\s+/g, '-')}.example.test/feed.xml`,
    site_url: `https://${title.toLowerCase().replace(/\s+/g, '-')}.example.test`,
    sort_order: sortOrder,
    style_token: null,
    last_hash: null,
    last_fetched_at: null,
    last_error_at: null,
    last_error_message: null,
    fetch_options_json: null,
  } satisfies Omit<FeedSource, 'id' | 'sync_id' | 'created_at' | 'updated_at' | 'deleted_at'>)) as Promise<number>
}

async function seedFeedItem(sourceId: number, title: string, readAt: number | null = null) {
  return db.feed_items.add({
    feed_source_id: sourceId,
    external_id: title.toLowerCase().replace(/\s+/g, '-'),
    title,
    url: `https://example.test/${title.toLowerCase().replace(/\s+/g, '-')}`,
    author: 'Author',
    published_at: Date.now(),
    summary: `${title} summary`,
    content: `${title} content body`,
    payload_json: null,
    fetched_at: Date.now(),
    read_at: readAt,
  } satisfies FeedItem)
}

async function settleFeedView(wrapper: ReturnType<typeof mount>, minItems = 1) {
  for (let i = 0; i < 20; i += 1) {
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 10))
    if (wrapper.findAll('.feed-item-stub').length >= minItems) return
  }
}

async function settleUntil(predicate: () => boolean) {
  for (let i = 0; i < 20; i += 1) {
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 10))
    if (predicate()) return
  }
}

describe('FeedsView', () => {
  const collectionA: Collection = {
    ...withMeta({
      id: 101,
      module_id: 1,
      title: 'Alpha',
      sort_order: 0,
      config_json: null,
    }),
  }

  const collectionB: Collection = {
    ...withMeta({
      id: 102,
      module_id: 1,
      title: 'Beta',
      sort_order: 1,
      config_json: null,
    }),
  }

  beforeEach(async () => {
    await db.open()
    await db.feed_items.clear()
    await db.feed_sources.clear()
    await db.saved_feed_items.clear()
  })

  afterEach(async () => {
    await db.feed_items.clear()
    await db.feed_sources.clear()
    await db.saved_feed_items.clear()
  })

  it('filters loaded feed items by local feed search query', async () => {
    const sourceId = await seedFeedSource(collectionA.id!, 'Alpha Source')
    await seedFeedItem(sourceId, 'Vue release today')
    await seedFeedItem(sourceId, 'Rust weekly digest')

    const wrapper = mount(FeedsView, {
      props: {
        collection: collectionA,
        filterQuery: 'rust',
      },
      global: {
        plugins: [createTestI18n()],
        stubs: {
          Modal: { template: '<div><slot /></div>' },
          FeedSourceForm: true,
          FeedArchiveForm: true,
          FeedItemCard: {
            props: ['item'],
            template: '<div class="feed-item-stub">{{ item.title }}</div>',
          },
        },
      },
    })

    await settleFeedView(wrapper)

    const rendered = wrapper.findAll('.feed-item-stub').map((node) => node.text())
    expect(rendered).toEqual(['Rust weekly digest'])
    expect(wrapper.find('.st-module-feed-title').text()).toContain('Search: rust')
  })

  it('resets the unread filter when switching collections', async () => {
    const sourceA = await seedFeedSource(collectionA.id!, 'Alpha Source')
    const sourceB = await seedFeedSource(collectionB.id!, 'Beta Source')

    await seedFeedItem(sourceA, 'Unread Alpha item', null)
    await seedFeedItem(sourceA, 'Read Alpha item', Date.now())
    await seedFeedItem(sourceB, 'Unread Beta item', null)

    const wrapper = mount(FeedsView, {
      props: {
        collection: collectionA,
      },
      global: {
        plugins: [createTestI18n()],
        stubs: {
          Modal: { template: '<div><slot /></div>' },
          FeedSourceForm: true,
          FeedArchiveForm: true,
          FeedItemCard: {
            props: ['item'],
            template: '<div class="feed-item-stub">{{ item.title }}</div>',
          },
        },
      },
    })

    await settleFeedView(wrapper, 2)

    await wrapper.find('.st-module-feed-toolbar-badge').trigger('click')
    await settleFeedView(wrapper)

    expect(wrapper.find('.st-module-feed-title').text()).toBe('Unread')
    expect(wrapper.findAll('.feed-item-stub')).toHaveLength(1)
    expect(wrapper.text()).toContain('Unread Alpha item')

    await wrapper.setProps({ collection: collectionB })
    await settleFeedView(wrapper)
    await settleUntil(() =>
      wrapper.find('.st-module-feed-title').text() === 'All sources' &&
      wrapper.findAll('.feed-item-stub').length === 1 &&
      wrapper.text().includes('Unread Beta item'),
    )

    expect(wrapper.find('.st-module-feed-title').text()).toBe('All sources')
    expect(wrapper.findAll('.feed-item-stub')).toHaveLength(1)
    expect(wrapper.text()).toContain('Unread Beta item')
  })

  it('delegates feed item toggle and archive actions from the module root', async () => {
    const sourceId = await seedFeedSource(collectionA.id!, 'Alpha Source')
    const itemId = await seedFeedItem(sourceId, 'Delegated item', null)

    const wrapper = mount(FeedsView, {
      props: {
        collection: collectionA,
      },
      global: {
        plugins: [createTestI18n()],
        stubs: {
          Modal: {
            props: ['show', 'title'],
            template: '<div v-if="show"><div class="modal-title">{{ title }}</div><slot /></div>',
          },
          FeedSourceForm: true,
          FeedArchiveForm: {
            props: ['item'],
            template: '<div class="archive-form-stub">{{ item.title }}</div>',
          },
        },
      },
    })

    await settleFeedView(wrapper)

    await wrapper.find('.st-module-feed-item-toggle').trigger('click')
    await flushPromises()

    expect(wrapper.find('.st-module-feed-item-body').exists()).toBe(true)
    expect((await db.feed_items.get(itemId))?.read_at).not.toBeNull()

    await wrapper.find('.st-module-feed-item-save').trigger('click')
    await flushPromises()

    expect(wrapper.find('.modal-title').text()).toBe('Archive Feed Item')
    expect(wrapper.find('.archive-form-stub').text()).toContain('Delegated item')
  })
})
