import {encryptNote, serialiseCryptPayload} from '../../../composables/useCrypt'
import {WIDGET_SETTINGS_KEY} from '../../../composables/useWidgetSettings.ts'
import {db as defaultDb, isActiveRecord, makeCreateMetadata} from '../../../db/db.ts'
import {DEFAULT_WIDGET_SETTINGS} from '../../../types/widgets.ts'
import {upsertUiConfig} from '../../data/ui-config.js'
import {ensureFaviconAssetIdForUrl} from '../../utils/favicon.js'
import {DEFAULT_LOCALE, getLocale, normalizeLocale} from '../../utils/i18n.js'

const MANIFEST_LOADERS = import.meta.glob('../../../../examples/*/workspace-*/*.json', {import: 'default'})
const NOTE_DEFINITION_LOADERS = import.meta.glob('../../../../examples/*/workspace-*/example-workspace.js', {import: 'default'})
const NOTE_FILE_LOADERS = import.meta.glob('../../../../examples/*/workspace-*/*/*/*.{html,md,txt,links,code,crypt}', {
  query: '?raw',
  import: 'default',
})

const TEXT_NOTE_EXTENSIONS = new Set(['md', 'txt'])
const NOTE_TYPE_BY_EXTENSION = {
  html: 'html',
  links: 'links',
  code: 'code',
  crypt: 'crypt',
}

function manifestPath(locale, workspaceId) {
  return `../../../../examples/${locale}/${workspaceId}/${workspaceId}.json`
}

function notePrefix(locale, workspaceId, pageTitle, moduleTitle, moduleType, tabTitle) {
  return `../../../../examples/${locale}/${workspaceId}/${pageTitle}/${moduleTitle} - ${moduleType}/${tabTitle}/`
}

function stripExtension(filename) {
  const lastDot = filename.lastIndexOf('.')
  return lastDot === -1 ? filename : filename.slice(0, lastDot)
}

function getFileExtension(filename) {
  const lastDot = filename.lastIndexOf('.')
  return lastDot === -1 ? '' : filename.slice(lastDot + 1).toLowerCase()
}

function deriveNoteTitleFromPath(path) {
  const filename = path.split('/').pop() ?? 'Untitled'
  return stripExtension(filename).trim() || 'Untitled'
}

function parseNoteHeader(raw) {
  const normalized = String(raw ?? '').replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  const meta = {}
  let index = 0

  while (index < lines.length) {
    const trimmed = lines[index].trim()
    if (!trimmed) {
      index += 1
      break
    }
    const match = trimmed.match(/^([A-Za-z]+):\s*(.+)$/)
    if (!match) break
    meta[match[1].toLowerCase()] = match[2].trim()
    index += 1
  }

  return {
    meta,
    content: lines.slice(index).join('\n').trim(),
  }
}

function normalizeSeedNote(note = {}) {
  return {
    title: note.title?.trim?.() || 'Untitled',
    type: note.type || 'text',
    content: typeof note.content === 'string' ? note.content : '',
    style_token: note.style_token ?? note.colorScheme ?? null,
    language: note.language ?? null,
    passphrase: note.passphrase ?? null,
    meta: note.meta && typeof note.meta === 'object' ? note.meta : null,
  }
}

function noteDefinitionPath(locale, workspaceId) {
  return `../../../../examples/${locale}/${workspaceId}/example-workspace.js`
}

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function mergeExampleValue(baseValue, overrideValue) {
  if (overrideValue === undefined) return baseValue
  if (baseValue === undefined) return overrideValue

  if (Array.isArray(baseValue) && Array.isArray(overrideValue)) {
    const maxLength = Math.max(baseValue.length, overrideValue.length)
    return Array.from({length: maxLength}, (_, index) => mergeExampleValue(baseValue[index], overrideValue[index]))
      .filter((value) => value !== undefined)
  }

  if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
    const merged = {...baseValue}
    for (const key of Object.keys(overrideValue)) {
      merged[key] = mergeExampleValue(baseValue[key], overrideValue[key])
    }
    return merged
  }

  return overrideValue
}

async function loadOptionalManifest(locale, workspaceId) {
  const loader = MANIFEST_LOADERS[manifestPath(locale, workspaceId)]
  return loader ? loader() : null
}

async function loadOptionalNoteDefinitions(locale, workspaceId) {
  const loader = NOTE_DEFINITION_LOADERS[noteDefinitionPath(locale, workspaceId)]
  if (!loader) return null
  const definitions = await loader()
  return Array.isArray(definitions) ? definitions : []
}

export function parseExampleNote(path, raw) {
  const extension = getFileExtension(path)
  const type = TEXT_NOTE_EXTENSIONS.has(extension)
    ? 'text'
    : NOTE_TYPE_BY_EXTENSION[extension]

  if (!type) {
    throw new Error(`Unsupported example note file: ${path}`)
  }

  const {meta, content} = parseNoteHeader(raw)
  return {
    title: meta.title?.trim?.() || deriveNoteTitleFromPath(path),
    type,
    content,
    style_token: meta.color?.trim?.().toLowerCase?.() || null,
    language: meta.language?.trim?.() || null,
    passphrase: meta.passphrase?.trim?.() || null,
  }
}

function defaultModuleConfig(type, overrides = {}, columnSpan = 6) {
  const config = {
    columns: 0,
    show_add_tile: false,
    column_span: columnSpan,
    refresh_interval_ms: 0,
    feed_item_limit: 0,
    open_in_new_tab: null,
    quicklinks: false,
    force_favicon: false,
    show_hover_actions: true,
  }

  if (type === 'notes' || type === 'feeds') {
    delete config.quicklinks
    delete config.force_favicon
    delete config.open_in_new_tab
  }

  return {...config, ...overrides}
}

function faviconSeedPriority(url) {
  try {
    return new URL(url).hostname.split('.').filter(Boolean).length
  } catch {
    return 0
  }
}

async function loadExampleManifest(locale, workspaceId) {
  const baseManifest = await loadOptionalManifest(DEFAULT_LOCALE, workspaceId)
  if (!baseManifest) throw new Error(`Missing example workspace manifest: ${workspaceId} (${DEFAULT_LOCALE})`)
  if (locale === DEFAULT_LOCALE) return baseManifest
  const overrideManifest = await loadOptionalManifest(locale, workspaceId)
  return overrideManifest ? mergeExampleValue(baseManifest, overrideManifest) : baseManifest
}

function remapDefinitionTitlesToManifest(definitions = [], baseManifest = {}, mergedManifest = {}) {
  return definitions.map((definition) => {
    const pageIndex = (baseManifest.pages ?? []).findIndex((page) => page?.title === definition.page)
    if (pageIndex === -1) return definition

    const basePage = baseManifest.pages?.[pageIndex]
    const mergedPage = mergedManifest.pages?.[pageIndex]
    if (!basePage || !mergedPage) return definition

    const moduleIndex = (basePage.modules ?? []).findIndex((module) => module?.title === definition.module)
    if (moduleIndex === -1) return definition

    const baseModule = basePage.modules?.[moduleIndex]
    const mergedModule = mergedPage.modules?.[moduleIndex]
    if (!baseModule || !mergedModule) return definition

    const tabIndex = (baseModule.tabs ?? []).findIndex((tab) => tab?.title === definition.tab)
    if (tabIndex === -1) return definition

    const mergedTab = mergedModule.tabs?.[tabIndex]
    if (!mergedTab) return definition

    return {
      ...definition,
      page: mergedPage.title,
      module: mergedModule.title,
      tab: mergedTab.title,
    }
  })
}

async function loadExampleNoteDefinitions(locale, workspaceId, mergedManifest) {
  const baseManifest = await loadOptionalManifest(DEFAULT_LOCALE, workspaceId)
  const baseDefinitionsRaw = await loadOptionalNoteDefinitions(DEFAULT_LOCALE, workspaceId) ?? []
  const baseDefinitions = remapDefinitionTitlesToManifest(baseDefinitionsRaw, baseManifest ?? {}, mergedManifest ?? {})
  if (locale === DEFAULT_LOCALE) return baseDefinitions
  const overrideDefinitions = await loadOptionalNoteDefinitions(locale, workspaceId)
  return overrideDefinitions ? mergeExampleValue(baseDefinitions, overrideDefinitions) : baseDefinitions
}

function buildDefinitionKey(pageTitle, moduleTitle, tabTitle) {
  return [pageTitle, moduleTitle, tabTitle].map((value) => String(value ?? '').trim()).join('::')
}

function buildExampleDefinitionMap(definitions = []) {
  const map = new Map()

  for (const definition of definitions) {
    const key = buildDefinitionKey(definition.page, definition.module, definition.tab)
    const note = normalizeSeedNote(definition)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(note)
  }

  return map
}

async function loadNotesForTab(locale, workspaceId, pageTitle, moduleTitle, moduleType, tabTitle) {
  const prefix = notePrefix(locale, workspaceId, pageTitle, moduleTitle, moduleType, tabTitle)
  const paths = Object.keys(NOTE_FILE_LOADERS)
    .filter((path) => path.startsWith(prefix))
    .sort((left, right) => left.localeCompare(right))

  const notes = []
  for (const path of paths) {
    const raw = await NOTE_FILE_LOADERS[path]()
    notes.push(parseExampleNote(path, raw))
  }
  return notes
}

async function preloadWorkspaceSeed(locale, workspaceId, manifest) {
  const noteDefinitionMap = buildExampleDefinitionMap(await loadExampleNoteDefinitions(locale, workspaceId, manifest))
  const pageSeeds = []

  for (const pageDef of manifest.pages ?? []) {
    const moduleSeeds = []

    for (const moduleDef of pageDef.modules ?? []) {
      const tabSeeds = []

      for (const tabDef of moduleDef.tabs ?? []) {
        const tabSeed = {...tabDef}

        if (moduleDef.type === 'notes') {
          const inlineNotes = Array.isArray(tabDef.notes)
            ? tabDef.notes.map((note) => normalizeSeedNote(note))
            : []
          const definitionNotes = noteDefinitionMap.get(buildDefinitionKey(
            pageDef.title,
            moduleDef.title,
            tabDef.title,
          )) ?? []
          const fileNotes = await loadNotesForTab(
            locale,
            workspaceId,
            pageDef.title,
            moduleDef.title,
            moduleDef.type,
            tabDef.title,
          )
          tabSeed.notes = [...inlineNotes, ...definitionNotes, ...fileNotes]
        }

        tabSeeds.push(tabSeed)
      }

      moduleSeeds.push({
        ...moduleDef,
        tabs: tabSeeds,
      })
    }

    pageSeeds.push({
      ...pageDef,
      modules: moduleSeeds,
    })
  }

  return pageSeeds
}

async function prepareWorkspaceSeed(pageSeeds = []) {
  return Promise.all((pageSeeds ?? []).map(async (pageDef) => ({
    ...pageDef,
    modules: await Promise.all((pageDef.modules ?? []).map(async (moduleDef) => ({
      ...moduleDef,
      tabs: await Promise.all((moduleDef.tabs ?? []).map(async (tabDef) => {
        if (moduleDef.type !== 'notes') return tabDef
        return {
          ...tabDef,
          notes: await Promise.all((tabDef.notes ?? []).map(async (note) => {
            if (note.type !== 'crypt') return note
            return {
              ...note,
              content: serialiseCryptPayload(await encryptNote(note.content, note.passphrase || 'Secret')),
            }
          })),
        }
      })),
    }))),
  })))
}

export async function canSeedExampleWorkspace(database = defaultDb) {
  const [pageCount, moduleCount, tabCount] = await Promise.all([
    database.pages.filter(isActiveRecord).count(),
    database.modules.filter(isActiveRecord).count(),
    database.collections.filter(isActiveRecord).count(),
  ])

  return pageCount === 0 && moduleCount === 0 && tabCount === 0
}

export async function seedExampleWorkspace(database = defaultDb, options = {}) {
  const locale = normalizeLocale(options.locale ?? getLocale())
  const workspaceId = options.workspaceId ?? 'workspace-1'
  const preloadFavicons = options.preloadFavicons ?? (database === defaultDb)
  const manifest = await loadExampleManifest(locale, workspaceId)
  const pageSeeds = await prepareWorkspaceSeed(await preloadWorkspaceSeed(locale, workspaceId, manifest))
  const now = Date.now()
  const createdBookmarks = []
  const postSeedUiConfigJobs = []

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
      let pageSortOrder = 0

      for (const pageDef of pageSeeds) {
        const pageId = await database.pages.add({
          slug: pageDef.slug,
          title: pageDef.title,
          nav_group: pageDef.nav_group ?? 'main',
          icon: pageDef.icon ?? null,
          is_home: pageDef.is_home ? 1 : 0,
          sort_order: pageSortOrder++,
          config_json: JSON.stringify(pageDef.config ?? {modulesPerRow: 12, maxWidth: null}),
          ...makeCreateMetadata(now),
        })

        let moduleSortOrder = 0

        for (const moduleDef of pageDef.modules ?? []) {
          const moduleMeta = makeCreateMetadata(now)
          const moduleColumnSpan = Math.max(1, Math.min(12, Number(moduleDef.column_span) || 6))
          const moduleId = await database.modules.add({
            page_id: pageId,
            type: moduleDef.type,
            title: moduleDef.title,
            sort_order: moduleSortOrder++,
            config_json: JSON.stringify(defaultModuleConfig(moduleDef.type, moduleDef.config ?? {}, moduleColumnSpan)),
            ...moduleMeta,
          })

          postSeedUiConfigJobs.push({
            entityType: 'module',
            entitySubtype: moduleDef.type,
            entitySyncId: moduleMeta.sync_id,
            patch: {
              layout: {
                'module-column-span': moduleColumnSpan,
              },
            },
          })

          if (moduleDef.type === 'tabs' || moduleDef.type === 'notes') {
            postSeedUiConfigJobs.push({
              entityType: 'module',
              entitySubtype: moduleDef.type,
              entitySyncId: moduleMeta.sync_id,
              patch: {
                behavior: {
                  'module-tabs-show-add-tile': false,
                },
              },
            })
          }

          if (moduleDef.type === 'tabs' && moduleDef.title === 'qbox') {
            postSeedUiConfigJobs.push({
              entityType: 'module',
              entitySubtype: 'tabs',
              entitySyncId: moduleMeta.sync_id,
              patch: {
                behavior: {
                  'module-tabs-quicklinks': true,
                  'module-tabs-force-favicon': true,
                  'module-tabs-show-add-tile': false,
                  'module-hide-header': true,
                },
              },
            })
          }

          let tabSortOrder = 0

          for (const tabDef of moduleDef.tabs ?? []) {
            const collectionId = await database.collections.add({
              module_id: moduleId,
              title: tabDef.title,
              sort_order: tabSortOrder++,
              config_json: null,
              ...makeCreateMetadata(now),
            })

            if (moduleDef.type === 'tabs') {
              let bookmarkSortOrder = 0
              for (const bookmark of tabDef.bookmarks ?? []) {
                const bookmarkId = await database.tabs.add({
                  collection_id: collectionId,
                  title: bookmark.title,
                  url: bookmark.url,
                  description: bookmark.description ?? null,
                  favicon_asset_id: null,
                  preview_asset_id: null,
                  meta_json: null,
                  sort_order: bookmarkSortOrder++,
                  ...makeCreateMetadata(now),
                })
                createdBookmarks.push({id: bookmarkId, url: bookmark.url})
              }
              continue
            }

            if (moduleDef.type === 'notes') {
              let noteSortOrder = 0
              for (const note of tabDef.notes ?? []) {
                const noteMeta = {
                  ...(note.meta && typeof note.meta === 'object' ? note.meta : {}),
                  ...(note.language ? {language: note.language} : {}),
                }
                await database.notes.add({
                  collection_id: collectionId,
                  title: note.title,
                  type: note.type,
                  content: note.content,
                  style_token: note.style_token,
                  meta_json: Object.keys(noteMeta).length ? JSON.stringify(noteMeta) : null,
                  sort_order: noteSortOrder++,
                  ...makeCreateMetadata(now),
                })
              }
              continue
            }

            if (moduleDef.type === 'feeds') {
              let sourceSortOrder = 0
              for (const source of tabDef.sources ?? []) {
                await database.feed_sources.add({
                  collection_id: collectionId,
                  title: source.title,
                  feed_url: source.feed_url,
                  site_url: source.site_url ?? null,
                  sort_order: sourceSortOrder++,
                  style_token: source.style_token ?? null,
                  last_hash: null,
                  last_fetched_at: null,
                  last_error_at: null,
                  last_error_message: null,
                  fetch_options_json: null,
                  ...makeCreateMetadata(now),
                })
              }
            }
          }
        }
      }

      await database.app_settings.put({
        key: WIDGET_SETTINGS_KEY,
        value_json: JSON.stringify(structuredClone(DEFAULT_WIDGET_SETTINGS)),
        updated_at: now,
      })
    },
  )

  for (const job of postSeedUiConfigJobs) {
    await upsertUiConfig(job)
  }

  if (!preloadFavicons) return

  const queue = [...createdBookmarks].sort((left, right) => (
    faviconSeedPriority(right.url) - faviconSeedPriority(left.url)
  ))

  for (const bookmark of queue) {
    try {
      const faviconAssetId = await ensureFaviconAssetIdForUrl(bookmark.url)
      if (!faviconAssetId) continue
      await database.tabs.update(bookmark.id, {favicon_asset_id: faviconAssetId})
    } catch {
      // Best-effort preload only.
    }
  }
}
