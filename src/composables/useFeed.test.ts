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

  it('uses dc:date when an RSS item has no pubDate', () => {
    const rss = `
      <rss xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0">
        <channel>
          <item>
            <title>Item</title>
            <dc:date>2026-07-03T10:11:10</dc:date>
          </item>
        </channel>
      </rss>
    `
    const items = parseFeed(rss, 1)
    expect(items[0].published_at).toBe(new Date('2026-07-03T10:11:10').getTime())
  })

  it('uses an image enclosure as the item media fallback', () => {
    const rss = `
      <rss version="2.0"><channel><item>
        <title>Image only</title>
        <enclosure url="https://example.com/image.webp" type="image/jpeg"/>
      </item></channel></rss>
    `
    const [item] = parseFeed(rss, 1)
    expect(JSON.parse(item.payload_json || '{}')).toEqual({kind: 'media', image_url: 'https://example.com/image.webp'})
  })

  it('does not duplicate enclosure media already present in the description', () => {
    const imageUrl = 'https://example.com/image.webp'
    const rss = `<rss version="2.0"><channel><item>
      <title>Image in description</title>
      <description><![CDATA[<img src="${imageUrl}">]]></description>
      <enclosure url="${imageUrl}" type="image/jpeg"/>
    </item></channel></rss>`
    const [item] = parseFeed(rss, 1)
    expect(item.payload_json).toBeNull()
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

  it('parses YouTube Atom metadata into payload_json', () => {
    const atom = `
      <?xml version="1.0" encoding="UTF-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom"
            xmlns:yt="http://www.youtube.com/xml/schemas/2015"
            xmlns:media="http://search.yahoo.com/mrss/">
        <entry>
          <id>yt:video:crGctJWuXsU</id>
          <yt:videoId>crGctJWuXsU</yt:videoId>
          <yt:channelId>UCldfgbzNILYZA4dmDt4Cd6A</yt:channelId>
          <title>Example YouTube Video</title>
          <link rel="alternate" href="https://www.youtube.com/watch?v=crGctJWuXsU"/>
          <author>
            <name>Secular Talk</name>
          </author>
          <published>2026-05-25T20:30:05+00:00</published>
          <updated>2026-05-25T20:35:09+00:00</updated>
          <media:group>
            <media:thumbnail url="https://i4.ytimg.com/vi/crGctJWuXsU/hqdefault.jpg" width="480" height="360"/>
            <media:description>Support The Show On Patreon</media:description>
            <media:community>
              <media:starRating count="1326" average="5.00" min="1" max="5"/>
              <media:statistics views="9599"/>
            </media:community>
          </media:group>
        </entry>
      </feed>
    `.trim()

    const items = parseFeed(atom, 789)
    expect(items).toHaveLength(1)
    expect(items[0].url).toBe('https://www.youtube.com/watch?v=crGctJWuXsU')

    const payload = JSON.parse(items[0].payload_json || '{}')
    expect(payload).toMatchObject({
      kind: 'youtube',
      video_id: 'crGctJWuXsU',
      channel_id: 'UCldfgbzNILYZA4dmDt4Cd6A',
      thumbnail_url: 'https://i4.ytimg.com/vi/crGctJWuXsU/hqdefault.jpg',
      description: 'Support The Show On Patreon',
      view_count: 9599,
      star_count: 1326,
    })
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
