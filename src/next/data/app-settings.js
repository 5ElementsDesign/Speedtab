import { db } from '../../db/db.ts'

export const APP_SETTING_DEFAULTS = {
  ui_language:                null,
  ui_theme:                   'dark',
  bookmarks_open_in_new_tab: true,
  background_properties:     null,
  background_asset_id:       null,
  feed_search_url_template:  'https://www.google.com/search?q=%s',
  feed_content_scale:        1,
  note_content_scale:        1,
  remember_last_page:        false,
  html_cache:                true,
}

let _cachedSettings = {...APP_SETTING_DEFAULTS}
const PAGE_BACKGROUND_SETTING_PREFIX = 'page_background:'

function getPageBackgroundSettingKey(pageSyncId) {
  return `${PAGE_BACKGROUND_SETTING_PREFIX}${pageSyncId}`
}

function normalizePageBackgroundOverride(value) {
  if (!value || typeof value !== 'object') return null
  const backgroundProperties = typeof value.background_properties === 'string'
    ? value.background_properties.trim() || null
    : null
  const backgroundAssetId = Number.isInteger(value.background_asset_id) && value.background_asset_id > 0
    ? value.background_asset_id
    : null
  if (!backgroundProperties && !backgroundAssetId) return null
  return {
    background_properties: backgroundProperties,
    background_asset_id: backgroundAssetId,
  }
}

export function getCachedAppSettings() {
  return _cachedSettings
}

export async function loadAppSettings() {
  const rows = await db.app_settings.toArray()
  const map  = {}
  for (const row of rows) {
    try {
      map[row.key] = JSON.parse(row.value_json ?? 'null')
    } catch {
      delete map[row.key]
    }
  }
  _cachedSettings = {...APP_SETTING_DEFAULTS, ...map}
  return _cachedSettings
}

export async function saveAppSetting(key, value) {
  await db.app_settings.put({key, value_json: JSON.stringify(value), updated_at: Date.now()})
  _cachedSettings = {..._cachedSettings, [key]: value}
}

export async function loadPageBackgroundOverride(pageSyncId) {
  if (!pageSyncId) return null
  const row = await db.app_settings.get(getPageBackgroundSettingKey(pageSyncId))
  if (!row?.value_json) return null
  try {
    return normalizePageBackgroundOverride(JSON.parse(row.value_json))
  } catch {
    return null
  }
}

export async function savePageBackgroundOverride(pageSyncId, value) {
  if (!pageSyncId) return null
  const key = getPageBackgroundSettingKey(pageSyncId)
  const normalized = normalizePageBackgroundOverride(value)
  if (!normalized) {
    await db.app_settings.delete(key)
    const nextSettings = {..._cachedSettings}
    delete nextSettings[key]
    _cachedSettings = nextSettings
    return null
  }
  await saveAppSetting(key, normalized)
  return normalized
}

export async function deletePageBackgroundOverride(pageSyncId) {
  return savePageBackgroundOverride(pageSyncId, null)
}

export async function loadBgArchive() {
  return db.bg_archive.orderBy('created_at').reverse().toArray()
}

export async function archiveBgItem(value) {
  if (!value) return
  const existing = (await db.bg_archive.toArray()).find((item) => item.value === value)
  if (existing?.id) return {item: existing, created: false}
  const newId = await db.bg_archive.add({name: '', value, created_at: Date.now()})
  await db.bg_archive.update(newId, {name: `BG #${newId}`})
  const item = await db.bg_archive.get(newId)
  return {item, created: true}
}

export async function deleteBgArchiveItem(id) {
  await db.bg_archive.delete(Number(id))
}
