// ─── Shared enums ─────────────────────────────────────────────────────────────

export type ModuleType = 'tabs' | 'notes' | 'feeds'
export type NoteType   = 'text' | 'code' | 'links' | 'crypt' | 'html'
export type AssetKind  = 'favicon' | 'preview' | 'background' | 'note_image'
export type NavGroup   = 'main' | 'overflow'
export type CaptureKind = 'note' | 'bookmark'
export type UiConfigEntityType = 'page' | 'module'

export interface SyncMetadata {
  sync_id:    string
  created_at: number
  updated_at: number
  deleted_at: number | null
}

export type PortableInput<T> = Omit<T, 'id' | keyof SyncMetadata>

// ─── Database entity interfaces ────────────────────────────────────────────────
// Field names mirror the schema from the architecture brief and ROADMAP.md.
// id is optional so we can insert without knowing the auto-incremented value.

export interface Page extends SyncMetadata {
  id?:          number
  slug:         string       // unique, used in location.hash navigation
  title:        string
  nav_group:    NavGroup
  icon:         string | null  // emoji or short string
  is_home:      0 | 1
  sort_order:   number
  /** Optional per-page UI settings (modulesPerRow, maxWidth, …) */
  config_json?: string | null
}

export interface Module extends SyncMetadata {
  id?:         number
  page_id:     number
  type:        ModuleType
  title:       string
  sort_order:  number
  config_json: string | null   // e.g. {"columns":4,"show_descriptions":true}
}

export interface Collection extends SyncMetadata {
  id?:         number
  module_id:   number
  title:       string
  sort_order:  number
  config_json: string | null   // e.g. {"collapsed":false}
}

export interface Tab extends SyncMetadata {
  id?:               number
  collection_id:     number
  title:             string
  url:               string
  description:       string | null
  color:            string | null
  background_color: string | null
  favicon_asset_id:  number | null
  preview_asset_id:  number | null
  sort_order:        number
  meta_json:         string | null  // e.g. {"image_source":"upload"}
}

export interface Note extends SyncMetadata {
  id?:           number
  collection_id: number
  title:         string
  type:          NoteType
  content:       string   // plaintext, code, links list, crypt JSON, or HTML
  style_token:   string | null
  sort_order:    number
  meta_json:     string | null
}

/**
 * Structured payload stored in Note.content for crypt notes.
 * Mirrors the spec from the architecture brief exactly.
 */
export interface CryptPayload {
  version:    1
  algorithm:  'AES-GCM'
  kdf:        'PBKDF2-SHA256'
  iterations: 310000
  salt:       string   // base64
  iv:         string   // base64
  ciphertext: string   // base64
}

export interface FeedSource extends SyncMetadata {
  id?:                 number
  collection_id:       number
  title:               string
  feed_url:            string
  site_url:            string | null
  sort_order:          number
  style_token:         string | null
  last_hash:           string | null
  last_fetched_at:     number | null   // ms since epoch
  last_error_at:       number | null   // ms since epoch
  last_error_message:  string | null
  fetch_options_json:  string | null   // parser/refresh options
}

export interface FeedItem {
  id?:            number
  feed_source_id: number
  external_id:    string | null  // guid / id from the feed
  title:          string
  url:            string | null
  author:         string | null
  published_at:   number | null  // ms since epoch
  summary:        string | null
  content:        string | null
  payload_json:   string | null  // extra fields from parser
  fetched_at:     number         // ms since epoch
  read_at?:       number | null  // ms since epoch, null/undefined = unread
}

export interface SavedFeedItem extends SyncMetadata {
  id?:            number
  collection_id:  number
  title:          string
  url:            string | null
  source_title:   string | null
  author:         string | null
  published_at:   number | null
  summary:        string | null
  content:        string | null
  comment:        string | null
  saved_at:       number
  sort_order:     number
  meta_json:      string | null
}

export interface Asset {
  id?:        number
  kind:       AssetKind
  checksum:   string   // SHA-256 hex – unique index prevents duplicates
  blob:       Blob     // WebP binary stored directly in IndexedDB
  width:      number | null
  height:     number | null
  meta_json:  string | null
}

export interface AppSetting {
  key:        string
  value_json: string | null
  updated_at: number
}

export interface BgArchiveItem {
  id?:        number
  name:       string
  value:      string
  created_at: number
}

export interface CaptureInboxItem {
  id?:           number
  kind:          CaptureKind
  external_hash: string
  title:         string | null
  text:          string | null
  url:           string | null
  source_url:    string | null
  source_title:  string | null
  created_at:    number
  meta_json:     string | null
}

export interface UiConfigPayload {
  behavior: Record<string, boolean | string | number | null>
  layout: Record<string, boolean | string | number | null>
  appearance: Record<string, boolean | string | number | null>
}

export interface NextUiConfig {
  id?:            number
  workspace_id:   string
  device_id:      string
  entity_type:    UiConfigEntityType
  entity_subtype: string | null
  entity_sync_id: string
  version:        number
  preset_id:      string | null
  config:         UiConfigPayload
  updated_at:     number
}
