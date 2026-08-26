import {isBookmarkModuleType} from '../../config/module-types.js'

const NOTE_TYPES = new Set(['text', 'code', 'links', 'crypt', 'html'])
const NOTE_STYLE_TOKENS = new Set(['primary', 'secondary', 'success', 'warning', 'danger', 'light', 'dark'])
const TODO_PRIORITIES = new Set(['low', 'medium', 'high'])
const TODO_COLOR_SCHEMES = new Set(['primary', 'secondary', 'success', 'warning', 'danger', 'dark', 'light'])

export function getCollectionImportKind(moduleType = '') {
  if (isBookmarkModuleType(moduleType)) return 'bookmark'
  if (moduleType === 'notes') return 'note'
  if (moduleType === 'todo') return 'todo'
  return ''
}

export function getCollectionImportExample(kind = '') {
  if (kind === 'bookmark') return '[\n  {"title": "Discord", "url": "https://discord.com/app"}\n]'
  if (kind === 'note') return '[\n  {"title": "Idea", "content": "Write it down."}\n]'
  if (kind === 'todo') return '[\n  {"title": "Reply to email", "priority": "medium"}\n]'
  return '[]'
}

function asNullableString(value) {
  return typeof value === 'string' ? value : null
}

function asTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string' || !value.trim()) return null
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

function asMetaJson(value) {
  if (value == null) return null
  if (typeof value === 'string') {
    JSON.parse(value)
    return value
  }
  if (typeof value === 'object' && !Array.isArray(value)) return JSON.stringify(value)
  throw new Error('invalid-item')
}

function normalizeSortOrder(value, index) {
  return Number.isFinite(value) ? value : index
}

function normalizeBookmark(item, index) {
  const title = String(item.title ?? '').trim()
  if (!title || typeof item.url !== 'string') throw new Error('invalid-item')
  let url
  try {
    url = new URL(item.url).href
  } catch {
    throw new Error('invalid-item')
  }
  if (!['http:', 'https:'].includes(new URL(url).protocol)) throw new Error('invalid-item')
  return {
    title,
    url,
    description: asNullableString(item.description),
    color: asNullableString(item.color),
    background_color: asNullableString(item.background_color),
    meta_json: asMetaJson(item.meta_json),
    sort_order: normalizeSortOrder(item.sort_order, index),
  }
}

function normalizeNote(item, index) {
  const type = NOTE_TYPES.has(item.type) ? item.type : 'html'
  const content = typeof item.content === 'string' ? item.content : ''
  if (!content && !String(item.title ?? '').trim()) throw new Error('invalid-item')
  return {
    title: String(item.title ?? '').trim(),
    type,
    content,
    style_token: NOTE_STYLE_TOKENS.has(item.style_token) ? item.style_token : null,
    meta_json: asMetaJson(item.meta_json),
    sort_order: normalizeSortOrder(item.sort_order, index),
  }
}

function normalizeTodo(item, index) {
  const title = String(item.title ?? '').trim()
  if (!title) throw new Error('invalid-item')
  const dueAt = asTimestamp(item.due_at)
  const completedAt = asTimestamp(item.completed_at)
  if (item.due_at != null && dueAt == null) throw new Error('invalid-item')
  if (item.completed_at != null && completedAt == null) throw new Error('invalid-item')
  return {
    title,
    note: asNullableString(item.note),
    due_at: dueAt,
    completed_at: completedAt,
    priority: TODO_PRIORITIES.has(item.priority) ? item.priority : null,
    color_scheme: TODO_COLOR_SCHEMES.has(item.color_scheme) ? item.color_scheme : null,
    sort_order: normalizeSortOrder(item.sort_order, index),
  }
}

export function parseCollectionImport(raw, moduleType = '') {
  const kind = getCollectionImportKind(moduleType)
  if (!kind || !raw.trim()) return []
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('invalid-json')
  }
  if (!Array.isArray(parsed) || !parsed.length) throw new Error('empty-import')
  const normalize = kind === 'bookmark' ? normalizeBookmark : kind === 'note' ? normalizeNote : normalizeTodo
  return parsed.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('invalid-item')
    return normalize(item, index)
  }).sort((a, b) => a.sort_order - b.sort_order)
}
