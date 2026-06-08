import { encryptNote, serialiseCryptPayload } from '@/composables/useCrypt'
import { ensureFaviconAssetIdForUrl } from '@/composables/useFavicon'
import { WIDGET_SETTINGS_KEY } from '@/composables/useWidgetSettings'
import { db as defaultDb, makeCreateMetadata, type SpeedtabDB } from '@/db/db'
import exampleHtmlNote from '../../examples/HTML.example.md?raw'
import featureAssetsHtml from '../../examples/features/ASSETS.html?raw'
import featureBookmarksHtml from '../../examples/features/BOOKMARKS.html?raw'
import featureCleanUpHtml from '../../examples/features/CLEANUP.html?raw'
import featureFeedReaderHtml from '../../examples/features/FEED-READER.html?raw'
import featureHtmlCodeText from '../../examples/features/HTML.code.txt?raw'
import featureNotesHtml from '../../examples/features/NOTES.html?raw'
import featureWeatherWidgetHtml from '../../examples/features/WEATHER-WIDGET.html?raw'
import helpAboutHtml from '../../examples/help/ABOUT.speedtab.html?raw'
import helpCodeSnippetsText from '../../examples/help/CODE-SNIPPETS.code.txt?raw'
import helpDataSafetyText from '../../examples/help/DATA-SAFETY.md?raw'
import helpFaqHtml from '../../examples/help/FAQ.speedtab.html?raw'
import helpLinkStackText from '../../examples/help/LINK-STACK.links.txt?raw'
import helpQuickStartText from '../../examples/help/QUICK-START.tips.md?raw'

type ExampleNoteType = 'text' | 'html' | 'links' | 'code'

type ExampleNoteSeed = {
  title: string
  type: ExampleNoteType
  content: string
  styleToken: string | null
  language?: string | null
}

type SeedExampleWorkspaceOptions = {
  preloadFavicons?: boolean
}

function parseStructuredExample(raw: string): ExampleNoteSeed {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  let index = 0
  let title = 'Untitled'
  let type: ExampleNoteType = 'text'
  let styleToken: string | null = null
  let language: string | null = null

  while (index < lines.length) {
    const line = lines[index].trim()
    if (!line) {
      index += 1
      break
    }
    if (line.startsWith('Title:')) {
      title = line.slice('Title:'.length).trim() || title
    } else if (line.startsWith('Type:')) {
      const parsedType = line.slice('Type:'.length).trim() as ExampleNoteType
      if (parsedType === 'text' || parsedType === 'html' || parsedType === 'links' || parsedType === 'code') {
        type = parsedType
      }
    } else if (line.startsWith('Color:')) {
      styleToken = line.slice('Color:'.length).trim().toLowerCase() || null
    } else if (line.startsWith('Language:')) {
      language = line.slice('Language:'.length).trim() || null
    }
    index += 1
  }

  const content = lines.slice(index).join('\n').trim()
  return { title, type, content, styleToken, language }
}

function buildWelcomeNoteWithFaviconRow(content: string, faviconAssetIds: number[]): string {
  if (!faviconAssetIds.length) return content.trim()

  const faviconRow = [
    '<figure class="st-note-html-favicon-row">',
    ...faviconAssetIds.map((assetId) => `  {{asset:image:${assetId}}}`),
    '</figure>',
  ].join('\n')

  const trimmedContent = content.trim()
  const blockquoteEnd = trimmedContent.indexOf('</blockquote>')
  if (blockquoteEnd === -1) {
    return `${trimmedContent}\n\n${faviconRow}`.trim()
  }

  const insertionIndex = blockquoteEnd + '</blockquote>'.length
  return `${trimmedContent.slice(0, insertionIndex)}\n\n${faviconRow}${trimmedContent.slice(insertionIndex)}`.trim()
}

function faviconSeedPriority(url: string): number {
  try {
    return new URL(url).hostname.split('.').filter(Boolean).length
  } catch {
    return 0
  }
}

export async function seedExampleWorkspace(
  database: SpeedtabDB = defaultDb,
  options: SeedExampleWorkspaceOptions = {},
): Promise<void> {
  const now = Date.now()
  const encryptedSecret = serialiseCryptPayload(await encryptNote('Speedtab is awesome!', 'Secret'))
  const shouldPreloadFavicons = options.preloadFavicons ?? (database === defaultDb)
  const helpQuickStart = parseStructuredExample(helpQuickStartText)
  const helpLinkStack = parseStructuredExample(helpLinkStackText)
  const helpCodeSnippets = parseStructuredExample(helpCodeSnippetsText)
  const helpDataSafety = parseStructuredExample(helpDataSafetyText)
  const featureHtmlCode = parseStructuredExample(featureHtmlCodeText)
  let welcomeNoteId: number | undefined
  const createdBookmarkTabs: Array<{ id: number; url: string }> = []

  await database.transaction(
    'rw',
    [
      database.pages,
      database.modules,
      database.collections,
      database.tabs,
      database.notes,
      database.feed_sources,
      database.app_settings,
    ],
    async () => {
      const pageId = await database.pages.add({
        slug: 'main',
        title: 'Main',
        nav_group: 'main',
        icon: '⭕',
        is_home: 1,
        sort_order: 0,
        config_json: JSON.stringify({
          modulesPerRow: 12,
          maxWidth: 1500,
          background_asset_id: null,
        }),
        ...makeCreateMetadata(now),
      })

      const webModuleId = await database.modules.add({
        page_id: pageId as number,
        type: 'tabs',
        title: 'Web',
        sort_order: 0,
        config_json: JSON.stringify({
          columns: 0,
          show_add_tile: true,
          column_span: 7,
          refresh_interval_ms: 0,
          feed_item_limit: 0,
          open_in_new_tab: null,
          quicklinks: false,
          force_favicon: false,
          show_hover_actions: true,
        }),
        ...makeCreateMetadata(now),
      })

      const notesModuleId = await database.modules.add({
        page_id: pageId as number,
        type: 'notes',
        title: 'Notes',
        sort_order: 1,
        config_json: JSON.stringify({
          columns: 0,
          show_add_tile: true,
          column_span: 5,
          refresh_interval_ms: 0,
          feed_item_limit: 0,
          open_in_new_tab: null,
          quicklinks: false,
          show_hover_actions: true,
        }),
        ...makeCreateMetadata(now),
      })

      const qboxModuleId = await database.modules.add({
        page_id: pageId as number,
        type: 'tabs',
        title: 'Qbox',
        sort_order: 2,
        config_json: JSON.stringify({
          columns: 0,
          show_add_tile: false,
          column_span: 4,
          refresh_interval_ms: 0,
          feed_item_limit: 0,
          open_in_new_tab: true,
          quicklinks: true,
          force_favicon: true,
          show_hover_actions: false,
        }),
        ...makeCreateMetadata(now),
      })

      const newsModuleId = await database.modules.add({
        page_id: pageId as number,
        type: 'feeds',
        title: 'News',
        sort_order: 3,
        config_json: JSON.stringify({
          columns: 0,
          show_add_tile: true,
          column_span: 8,
          refresh_interval_ms: 0,
          feed_item_limit: 0,
          open_in_new_tab: null,
          quicklinks: false,
          show_hover_actions: true,
        }),
        ...makeCreateMetadata(now),
      })

      const appsCollectionId = await database.collections.add({
        module_id: webModuleId as number,
        title: 'Apps',
        sort_order: 0,
        config_json: null,
        ...makeCreateMetadata(now),
      })

      const toolsCollectionId = await database.collections.add({
        module_id: webModuleId as number,
        title: 'Com',
        sort_order: 1,
        config_json: null,
        ...makeCreateMetadata(now),
      })

      const startCollectionId = await database.collections.add({
        module_id: notesModuleId as number,
        title: 'Start',
        sort_order: 0,
        config_json: null,
        ...makeCreateMetadata(now),
      })

      const featuresCollectionId = await database.collections.add({
        module_id: notesModuleId as number,
        title: 'Features',
        sort_order: 1,
        config_json: null,
        ...makeCreateMetadata(now),
      })

      const helpCollectionId = await database.collections.add({
        module_id: notesModuleId as number,
        title: '❔', // Help
        sort_order: 2,
        config_json: null,
        ...makeCreateMetadata(now),
      })

      const qboxCollectionId = await database.collections.add({
        module_id: qboxModuleId as number,
        title: 'AI',
        sort_order: 0,
        config_json: null,
        ...makeCreateMetadata(now),
      })

      const breakingCollectionId = await database.collections.add({
        module_id: newsModuleId as number,
        title: 'Breaking',
        sort_order: 0,
        config_json: null,
        ...makeCreateMetadata(now),
      })

      const bookmarks = [
        { collection_id: appsCollectionId as number, sort_order: 0, title: 'Google', url: 'https://www.google.com/' },
        { collection_id: appsCollectionId as number, sort_order: 1, title: 'Gemini', url: 'https://gemini.google.com/' },
        { collection_id: appsCollectionId as number, sort_order: 2, title: 'Google Maps', url: 'https://maps.google.com/' },
        { collection_id: appsCollectionId as number, sort_order: 3, title: 'Google Translate', url: 'https://translate.google.de/' },
        { collection_id: appsCollectionId as number, sort_order: 4, title: 'YouTube', url: 'https://www.youtube.com/' },
        { collection_id: toolsCollectionId as number, sort_order: 0, title: 'WhatsApp', url: 'https://web.whatsapp.com/' },
        { collection_id: toolsCollectionId as number, sort_order: 1, title: 'Telegram', url: 'https://web.telegram.org/' },
        { collection_id: toolsCollectionId as number, sort_order: 2, title: 'Discord', url: 'https://discord.com/app' },
        { collection_id: toolsCollectionId as number, sort_order: 3, title: 'Slack', url: 'https://app.slack.com/' },
        { collection_id: qboxCollectionId as number, sort_order: 0, title: 'ChatGPT', url: 'https://chatgpt.com/' },
        { collection_id: qboxCollectionId as number, sort_order: 1, title: 'Claude', url: 'https://claude.ai/' },
        { collection_id: qboxCollectionId as number, sort_order: 2, title: 'Grok', url: 'https://grok.com/' },
        { collection_id: qboxCollectionId as number, sort_order: 3, title: 'Qwen', url: 'https://chat.qwen.ai/' },
        { collection_id: qboxCollectionId as number, sort_order: 4, title: 'Duck.ai', url: 'https://duck.ai/' },
      ] as const

      for (const bookmark of bookmarks) {
        const tabId = await database.tabs.add({
          collection_id: bookmark.collection_id,
          title: bookmark.title,
          url: bookmark.url,
          description: null,
          favicon_asset_id: null,
          preview_asset_id: null,
          sort_order: bookmark.sort_order,
          meta_json: null,
          ...makeCreateMetadata(now),
        })
        createdBookmarkTabs.push({
          id: tabId as number,
          url: bookmark.url,
        })
      }

      await database.notes.add({
        collection_id: startCollectionId as number,
        title: 'My first note',
        type: 'text',
        content: "Use the passphrase 'Secret' to unlock the secret",
        style_token: 'success',
        sort_order: 0,
        meta_json: null,
        ...makeCreateMetadata(now),
      })

      await database.notes.add({
        collection_id: startCollectionId as number,
        title: 'Secret',
        type: 'crypt',
        content: encryptedSecret,
        style_token: 'danger',
        sort_order: 1,
        meta_json: null,
        ...makeCreateMetadata(now),
      })

      welcomeNoteId = (await database.notes.add({
        collection_id: startCollectionId as number,
        title: 'Welcome to Speedtab',
        type: 'html',
        content: exampleHtmlNote.trim(),
        style_token: 'default',
        sort_order: 2,
        meta_json: null,
        ...makeCreateMetadata(now),
      })) as number

      await database.notes.bulkAdd([
        {
          collection_id: featuresCollectionId as number,
          title: 'Bookmarks',
          type: 'html',
          content: featureBookmarksHtml.trim(),
          style_token: 'info',
          sort_order: 0,
          meta_json: null,
          ...makeCreateMetadata(now),
        },
        {
          collection_id: featuresCollectionId as number,
          title: 'Notes',
          type: 'html',
          content: featureNotesHtml.trim(),
          style_token: 'info',
          sort_order: 1,
          meta_json: null,
          ...makeCreateMetadata(now),
        },
        {
          collection_id: featuresCollectionId as number,
          title: 'Feed reader',
          type: 'html',
          content: featureFeedReaderHtml.trim(),
          style_token: 'info',
          sort_order: 2,
          meta_json: null,
          ...makeCreateMetadata(now),
        },
        {
          collection_id: featuresCollectionId as number,
          title: 'Weather widget',
          type: 'html',
          content: featureWeatherWidgetHtml.trim(),
          style_token: 'warning',
          sort_order: 3,
          meta_json: null,
          ...makeCreateMetadata(now),
        },
        {
          collection_id: featuresCollectionId as number,
          title: featureHtmlCode.title,
          type: featureHtmlCode.type,
          content: featureHtmlCode.content,
          style_token: 'default',
          sort_order: 4,
          meta_json: featureHtmlCode.language ? JSON.stringify({ language: featureHtmlCode.language }) : null,
          ...makeCreateMetadata(now),
        },
        {
          collection_id: featuresCollectionId as number,
          title: 'Assets',
          type: 'html',
          content: featureAssetsHtml.trim(),
          style_token: 'default',
          sort_order: 5,
          meta_json: null,
          ...makeCreateMetadata(now),
        },
        {
          collection_id: featuresCollectionId as number,
          title: 'CLEANUP',
          type: 'html',
          content: featureCleanUpHtml.trim(),
          style_token: 'danger',
          sort_order: 6,
          meta_json: null,
          ...makeCreateMetadata(now),
        },
        {
          collection_id: helpCollectionId as number,
          title: 'About Speedtab',
          type: 'html',
          content: helpAboutHtml.trim(),
          style_token: 'dark',
          sort_order: 0,
          meta_json: null,
          ...makeCreateMetadata(now),
        },
        {
          collection_id: helpCollectionId as number,
          title: helpQuickStart.title,
          type: helpQuickStart.type,
          content: helpQuickStart.content,
          style_token: helpQuickStart.styleToken,
          sort_order: 1,
          meta_json: null,
          ...makeCreateMetadata(now),
        },
        {
          collection_id: helpCollectionId as number,
          title: 'FAQ',
          type: 'html',
          content: helpFaqHtml.trim(),
          style_token: null,
          sort_order: 2,
          meta_json: null,
          ...makeCreateMetadata(now),
        },
        {
          collection_id: helpCollectionId as number,
          title: helpLinkStack.title,
          type: helpLinkStack.type,
          content: helpLinkStack.content,
          style_token: helpLinkStack.styleToken,
          sort_order: 3,
          meta_json: null,
          ...makeCreateMetadata(now),
        },
        {
          collection_id: helpCollectionId as number,
          title: helpCodeSnippets.title,
          type: helpCodeSnippets.type,
          content: helpCodeSnippets.content,
          style_token: helpCodeSnippets.styleToken,
          sort_order: 4,
          meta_json: helpCodeSnippets.language ? JSON.stringify({ language: helpCodeSnippets.language }) : null,
          ...makeCreateMetadata(now),
        },
        {
          collection_id: helpCollectionId as number,
          title: helpDataSafety.title,
          type: helpDataSafety.type,
          content: helpDataSafety.content,
          style_token: helpDataSafety.styleToken,
          sort_order: 5,
          meta_json: null,
          ...makeCreateMetadata(now),
        },
      ])

      await database.feed_sources.add({
        collection_id: breakingCollectionId as number,
        title: 'GTmetrix Blog',
        feed_url: 'https://gtmetrix.com/blog/feed/',
        site_url: 'https://gtmetrix.com/blog/',
        sort_order: 0,
        style_token: null,
        last_hash: null,
        last_fetched_at: null,
        last_error_at: null,
        last_error_message: null,
        fetch_options_json: null,
        ...makeCreateMetadata(now),
      })

      await database.app_settings.put({
        key: WIDGET_SETTINGS_KEY,
        value_json: JSON.stringify({
          rail_enabled: true,
          rail_position: 'bottom',
          rail_align: 'left',
          weather: {
            enabled: true,
            provider: 'open_meteo',
            units: 'metric',
            refresh_interval_minutes: 120,
            display_label: null,
            location: null,
          },
        }),
        updated_at: now,
      })
    },
  )

  if (!shouldPreloadFavicons || database !== defaultDb) return

  const seededFaviconAssetIds: number[] = []
  const faviconSeedQueue = [...createdBookmarkTabs].sort((left, right) => {
    return faviconSeedPriority(right.url) - faviconSeedPriority(left.url)
  })

  for (const bookmark of faviconSeedQueue) {
    try {
      const faviconAssetId = await ensureFaviconAssetIdForUrl(bookmark.url)
      if (!faviconAssetId) continue
      seededFaviconAssetIds.push(faviconAssetId)
      await database.tabs.update(bookmark.id, {
        favicon_asset_id: faviconAssetId,
      })
    } catch {
      // Keep Quick Start usable even if some favicon requests fail.
    }
  }

  if (welcomeNoteId && seededFaviconAssetIds.length) {
    await database.notes.update(welcomeNoteId, {
      content: buildWelcomeNoteWithFaviconRow(
        exampleHtmlNote,
        Array.from(new Set(seededFaviconAssetIds)),
      ),
    })
  }
}
