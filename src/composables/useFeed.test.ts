import { describe, it, expect } from 'vitest'
import { useFeed } from './useFeed'

const { parseFeed } = useFeed()

describe('useFeed - RSS Parsing', () => {
  it('parses a basic RSS 2.0 feed', () => {
    const rss = `
      <?xml version=\"1.0\" encoding=\"UTF-8\" ?>
      <rss version=\"2.0\">
      <channel>
        <title>RSS Title</title>
        <item>
          <title>Example item</title>
          <description>Description text</description>
          <link>http://www.example.com/1</link>
          <guid>guid-1</guid>
          <pubDate>Sun, 06 Sep 2009 16:20:00 +0000</pubDate>
        </item>
      </channel>
      </rss>
    `.trim()

    const items = parseFeed(rss, 123)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      feed_source_id: 123,
      external_id: 'guid-1',
      title: 'Example item',
      url: 'http://www.example.com/1',
      summary: 'Description text',
    })
    expect(items[0].published_at).toBe(new Date('Sun, 06 Sep 2009 16:20:00 +0000').getTime())
  })

  it('handles RSS with dc:creator author', () => {
    const rss = `
      <rss xmlns:dc=\"http://purl.org/dc/elements/1.1/\" version=\"2.0\">
      <channel>
        <item>
          <title>Item</title>
          <dc:creator>Jane Doe</dc:creator>
        </item>
      </channel>
      </rss>
    `
    const items = parseFeed(rss, 1)
    expect(items[0].author).toBe('Jane Doe')
  })
})

describe('useFeed - Atom Parsing', () => {
  it('parses a basic Atom 1.0 feed', () => {
    const atom = `
      <?xml version=\"1.0\" encoding=\"utf-8\"?>
      <feed xmlns=\"http://www.w3.org/2005/Atom\">
        <title>Example Feed</title>
        <entry>
          <title>Atom Entry</title>
          <link href=\"http://example.org/atom\"/>
          <id>urn:uuid:123</id>
          <updated>2003-12-13T18:30:02Z</updated>
          <summary>Summary text</summary>
        </entry>
      </feed>
    `.trim()

    const items = parseFeed(atom, 456)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      feed_source_id: 456,
      external_id: 'urn:uuid:123',
      title: 'Atom Entry',
      url: 'http://example.org/atom',
      summary: 'Summary text',
    })
    expect(items[0].published_at).toBe(new Date('2003-12-13T18:30:02Z').getTime())
  })
})

describe('useFeed - Error Handling', () => {
  it('throws on invalid XML', () => {
    expect(() => parseFeed('not xml', 1)).toThrow()
  })

  it('returns empty array for valid XML that is not a feed', () => {
    const xml = '<root><not-an-item>hi</not-an-item></root>'
    expect(parseFeed(xml, 1)).toEqual([])
  })
})
