/**
 * Speedtab – Extension Service Worker (background script)
 *
 * Architecture note:
 *   Chrome extensions running as newtab pages cannot make cross-origin fetch
 *   requests from the UI context (the new tab page). Background service workers
 *   bypass this restriction because they operate outside the page CSP.
 *
 *   All RSS/Atom feed fetching MUST be delegated here via chrome.runtime.sendMessage.
 *   The UI sends a { type: 'FETCH_FEED', url: string } message and awaits the
 *   response with the raw XML string (or an error object).
 *
 *   The service worker now handles feed fetching, URL metadata lookups,
 *   context-menu capture flows, alarm-driven remote auto-sync checks/pushes,
 *   and runtime coordination for extension-side background tasks.
 */

import { getLocalSettings } from '@/composables/useLocalSettings'
import {
  REMOTE_AUTO_SYNC_CHECK_ALARM,
  REMOTE_AUTO_SYNC_MARK_DIRTY_MESSAGE,
  REMOTE_AUTO_SYNC_PUSH_ALARM,
  REMOTE_AUTO_SYNC_PUSH_DEBOUNCE_MS,
  REMOTE_AUTO_SYNC_REFRESH_MESSAGE,
  REMOTE_AUTO_SYNC_STALE_CHECK_MS,
  resolveRemoteAutoSyncIntervalMs,
  runRemoteAutoSyncCheckPass,
  runRemoteAutoSyncPass,
} from '@/composables/useRemoteAutoSync'
import { isRemoteProviderConfigured } from '@/composables/useRemoteProvider'
import { db } from '@/db/db'
import { loadLocalToolsState, saveLocalToolsState } from '../next/data/local-tools.js'
import { extractDescription } from '../next/utils/page-meta.js'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FetchFeedMessage {
  type: 'FETCH_FEED'
  url:  string
}

interface FetchUrlMetaMessage {
  type: 'FETCH_URL_META'
  url:  string
}

interface FetchUrlContentMessage {
  type: 'FETCH_URL_CONTENT'
  url:  string
}

interface RemoteAutoSyncRefreshMessage {
  type: typeof REMOTE_AUTO_SYNC_REFRESH_MESSAGE
}

interface RemoteAutoSyncMarkDirtyMessage {
  type: typeof REMOTE_AUTO_SYNC_MARK_DIRTY_MESSAGE
}

interface RemoteAutoSyncActivityMessage {
  type: 'REMOTE_AUTO_SYNC_ACTIVITY'
  kind: 'check' | 'push'
  phase: 'start' | 'end'
}

interface FetchFeedResponse {
  ok:    boolean
  xml?:  string
  error?: string
}

interface FetchUrlMetaResponse {
  ok: boolean
  title?: string | null
  description?: string | null
  finalUrl?: string
  error?: string
}

interface FetchUrlContentResponse {
  ok: boolean
  html?: string
  contentType?: string
  finalUrl?: string
  error?: string
}

/**
 * Decode a Response body using the charset declared in the HTTP Content-Type
 * header, falling back to any XML/HTML encoding declaration in the document,
 * and finally to UTF-8.
 *
 * `Response.text()` only honours the HTTP-level charset (plus BOM). It ignores
 * `<?xml encoding="..."?>` and `<meta charset="...">`, which causes feeds and
 * pages that omit the HTTP charset (e.g. lemondeinformatique.fr — XML declares
 * ISO-8859-15 but the server sends `Content-Type: application/rss+xml` with
 * no charset) to be mis-decoded as UTF-8, dropping any byte in the 0x80–0xFF
 * range (so `ê`/`à`/etc. silently vanish from French titles).
 */
async function decodeResponseText(response: Response, contentType: string): Promise<string> {
  const buffer = await response.arrayBuffer()

  // 1. HTTP header charset.
  let charset = contentType.match(/charset=([^\s;]+)/i)?.[1]?.toLowerCase()

  // 2. XML declaration or HTML <meta> tag. ASCII-decode a small head so we
  //    never accidentally split a multi-byte sequence.
  if (!charset) {
    const headBytes = buffer.slice(0, Math.min(buffer.byteLength, 512))
    const head = new TextDecoder('ascii').decode(headBytes)
    charset =
      head.match(/<\?xml[^>]*encoding=["']([^"']+)["']/i)?.[1]?.toLowerCase() ||
      head.match(/<meta[^>]+charset=["']?([^"';\s>]+)/i)?.[1]?.toLowerCase() ||
      head.match(/<meta[^>]+content=["'][^"']*charset=([^"';\s>]+)/i)?.[1]?.toLowerCase()
  }

  ;(response as any).__sniffedCharset = charset || 'utf-8'

  // 3. Fall back to UTF-8. Unknown / invalid labels fall through to the catch
  //    and also default to UTF-8.
  try {
    return new TextDecoder(charset || 'utf-8', {fatal: false}).decode(buffer)
  } catch {
    return new TextDecoder('utf-8', {fatal: false}).decode(buffer)
  }
}

type IncomingMessage =
  | FetchFeedMessage
  | FetchUrlMetaMessage
  | FetchUrlContentMessage
  | RemoteAutoSyncRefreshMessage
  | RemoteAutoSyncMarkDirtyMessage

const CONTEXT_MENU_CAPTURE_NOTE = 'speedtab-capture-note'
const CONTEXT_MENU_CAPTURE_BOOKMARK = 'speedtab-capture-bookmark'
const CONTEXT_MENU_CAPTURE_PAGE_NOTE = 'speedtab-capture-page-note'
const CONTEXT_MENU_APPEND_SELECTION_TO_QUICKNOTE = 'speedtab-append-selection-to-quicknote'
const CONTEXT_MENU_PARENT = 'speedtab-parent'
let contextMenuSetupPromise: Promise<void> | null = null
let remoteAutoSyncRefreshPromise: Promise<void> | null = null
let remoteAutoSyncPushPromise: Promise<void> | null = null

function msg(name: string, substitutions?: string | string[]): string {
  return chrome.i18n.getMessage(name, substitutions) || name
}

function createContextMenu(createProperties: chrome.contextMenus.CreateProperties) {
  return new Promise<void>((resolve, reject) => {
    chrome.contextMenus.create(createProperties, () => {
      const errorMessage = chrome.runtime.lastError?.message
      if (errorMessage) {
        if (errorMessage.includes('duplicate id')) {
          resolve()
          return
        }
        reject(new Error(errorMessage))
        return
      }
      resolve()
    })
  })
}

async function rebuildContextMenus() {
  await chrome.contextMenus.removeAll()
  await createContextMenu({
    id: CONTEXT_MENU_PARENT,
    title: msg('contextMenuRoot'),
    contexts: ['selection', 'page'],
  })
  await createContextMenu({
    id: CONTEXT_MENU_CAPTURE_BOOKMARK,
    parentId: CONTEXT_MENU_PARENT,
    title: msg('saveCurrentPageAsBookmark'),
    contexts: ['page', 'selection'],
  })
  await createContextMenu({
    id: CONTEXT_MENU_CAPTURE_PAGE_NOTE,
    parentId: CONTEXT_MENU_PARENT,
    title: msg('storeCurrentPageAsNote'),
    contexts: ['page', 'selection'],
  })
  await createContextMenu({
    id: CONTEXT_MENU_CAPTURE_NOTE,
    parentId: CONTEXT_MENU_PARENT,
    title: msg('saveSelectionAsNote'),
    contexts: ['selection'],
  })
  await createContextMenu({
    id: CONTEXT_MENU_APPEND_SELECTION_TO_QUICKNOTE,
    parentId: CONTEXT_MENU_PARENT,
    title: msg('appendSelectionToQuicknote'),
    contexts: ['selection'],
  })
}

async function ensureContextMenus() {
  if (contextMenuSetupPromise) return contextMenuSetupPromise

  contextMenuSetupPromise = rebuildContextMenus()
    .catch((error) => {
      console.error('[Speedtab SW] Failed to rebuild context menus', error)
      throw error
    })
    .finally(() => {
      contextMenuSetupPromise = null
    })

  return contextMenuSetupPromise
}

function createAlarm(name: string, delayMs: number, periodMs?: number) {
  const delayInMinutes = Math.max(delayMs / 60_000, 0.1)
  if (periodMs != null) {
    chrome.alarms.create(name, {
      delayInMinutes,
      periodInMinutes: Math.max(periodMs / 60_000, 1),
    })
    return
  }

  chrome.alarms.create(name, {delayInMinutes})
}

function isRemoteAutoSyncConfigured(settings: Awaited<ReturnType<typeof getLocalSettings>>) {
  return settings.remote_auto_sync_enabled === true
    && isRemoteProviderConfigured(settings)
}

async function ensurePeriodicAlarm(name: string, intervalMs: number) {
  const existing = await chrome.alarms.get(name)
  const nextPeriodMinutes = Math.max(intervalMs / 60_000, 1)
  const samePeriod = existing?.periodInMinutes != null
    && Math.abs(existing.periodInMinutes - nextPeriodMinutes) < 0.0001

  if (samePeriod) return
  createAlarm(name, intervalMs, intervalMs)
}

async function notifyRemoteSyncActivity(kind: 'check' | 'push', phase: 'start' | 'end') {
  try {
    await chrome.runtime.sendMessage({
      type: 'REMOTE_AUTO_SYNC_ACTIVITY',
      kind,
      phase,
    } satisfies RemoteAutoSyncActivityMessage)
  } catch {
    // Ignore delivery errors when no extension page is listening.
  }
}

async function clearRemoteAutoSyncAlarms() {
  await chrome.alarms.clear(REMOTE_AUTO_SYNC_CHECK_ALARM)
  await chrome.alarms.clear(REMOTE_AUTO_SYNC_PUSH_ALARM)
}

async function refreshRemoteAutoSyncSchedule(options: {forceCheck?: boolean} = {}) {
  const settings = await getLocalSettings()
  const intervalMs = resolveRemoteAutoSyncIntervalMs(settings)
  const enabled = isRemoteAutoSyncConfigured(settings)

  if (!enabled || intervalMs <= 0) {
    await clearRemoteAutoSyncAlarms()
    return
  }

  await ensurePeriodicAlarm(REMOTE_AUTO_SYNC_CHECK_ALARM, intervalMs)

  const now = Date.now()
  const lastCheckAt = settings.remote_auto_sync_last_check_at ?? 0
  if (options.forceCheck === true && now - lastCheckAt >= REMOTE_AUTO_SYNC_STALE_CHECK_MS) {
    await notifyRemoteSyncActivity('check', 'start')
    await handleRemoteAutoSyncCheckAlarm()
  }
}

async function queueRemoteAutoSyncPush() {
  const settings = await getLocalSettings()
  const enabled = isRemoteAutoSyncConfigured(settings)
  if (!enabled) return
  createAlarm(REMOTE_AUTO_SYNC_PUSH_ALARM, REMOTE_AUTO_SYNC_PUSH_DEBOUNCE_MS)
}

async function handleRemoteAutoSyncCheckAlarm() {
  if (remoteAutoSyncRefreshPromise) return remoteAutoSyncRefreshPromise
  await notifyRemoteSyncActivity('check', 'start')
  remoteAutoSyncRefreshPromise = runRemoteAutoSyncCheckPass()
    .then(async (result) => {
      await notifyRemoteSyncActivity('check', 'end')
      return result
    })
    .catch((error) => {
      console.warn('[Speedtab SW] Remote auto-sync check failed', error)
    })
    .then(() => undefined)
    .finally(() => {
      remoteAutoSyncRefreshPromise = null
    })
  return remoteAutoSyncRefreshPromise
}

async function handleRemoteAutoSyncPushAlarm() {
  if (remoteAutoSyncPushPromise) return remoteAutoSyncPushPromise
  await notifyRemoteSyncActivity('push', 'start')
  remoteAutoSyncPushPromise = runRemoteAutoSyncPass()
    .then(async (result) => {
      await notifyRemoteSyncActivity('push', 'end')
      return result
    })
    .catch((error) => {
      console.warn('[Speedtab SW] Remote auto-sync push failed', error)
    })
    .then(() => undefined)
    .finally(() => {
      remoteAutoSyncPushPromise = null
    })
  return remoteAutoSyncPushPromise
}

async function fetchPageMeta(url: string) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    clearTimeout(timeout)
    if (!response.ok) return { title: null as string | null, description: null as string | null, finalUrl: url }

    const finalUrl = response.url || url
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html')) {
      return { title: null as string | null, description: null as string | null, finalUrl }
    }

    const html = await decodeResponseText(response, contentType)
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const description = extractDescription(html)

    return {
      title: titleMatch?.[1]?.replace(/\s+/g, ' ').trim() || null,
      description,
      finalUrl,
    }
  } catch {
    return { title: null as string | null, description: null as string | null, finalUrl: url }
  }
}

function buildCapturedPageNote(input: {
  title: string | null
  url: string
  description: string | null
  selection: string | null
}) {
  const lines: string[] = []
  lines.push(msg('capturedPage', input.title || input.url))
  lines.push(msg('capturedUrl', input.url))
  if (input.description) {
    lines.push('')
    lines.push(msg('capturedDescription', input.description))
  }
  if (input.selection) {
    lines.push('')
    lines.push(msg('selectionLabel'))
    lines.push(input.selection)
  }
  return lines.join('\n')
}

async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function storeCaptureItem(input: {
  kind: 'note' | 'bookmark'
  title: string | null
  text: string | null
  url: string | null
  source_url: string | null
  source_title: string | null
}) {
  const external_hash = await sha256Hex(JSON.stringify(input))
  const existing = await db.capture_inbox.where('external_hash').equals(external_hash).first()
  if (existing) {
    await notifyCaptureInboxUpdated()
    return
  }

  await db.capture_inbox.add({
    ...input,
    external_hash,
    created_at: Date.now(),
    meta_json: null,
  })
  await notifyCaptureInboxUpdated()
}

async function notifyCaptureInboxUpdated() {
  try {
    const count = await db.capture_inbox.count()
    await chrome.runtime.sendMessage({
      type: 'CAPTURE_INBOX_UPDATED',
      count,
    })
  } catch {
    // Ignore delivery errors when no extension page is listening.
  }
}

async function notifyQuicknoteUpdated() {
  try {
    await chrome.runtime.sendMessage({
      type: 'QUICKNOTE_UPDATED',
    })
  } catch {
    // Ignore delivery errors when no extension page is listening.
  }
}

async function appendQuicknoteContent(text: string) {
  const nextText = text.trim()
  if (!nextText) return

  const currentState = await loadLocalToolsState()
  const currentContent = currentState.quicknote?.content?.trim?.() ?? ''
  const content = currentContent
    ? `${currentState.quicknote.content}\n\n----\n\n${nextText}`
    : nextText

  await saveLocalToolsState({
    ...currentState,
    quicknote: {
      ...currentState.quicknote,
      content,
    },
  })
  await notifyQuicknoteUpdated()
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Speedtab SW] Installed – reason:', details.reason)
  void ensureContextMenus()
  void refreshRemoteAutoSyncSchedule({forceCheck: true})
})

chrome.runtime.onStartup.addListener(() => {
  void ensureContextMenus()
  void refreshRemoteAutoSyncSchedule({forceCheck: true})
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REMOTE_AUTO_SYNC_CHECK_ALARM) {
    void handleRemoteAutoSyncCheckAlarm()
    return
  }
  if (alarm.name === REMOTE_AUTO_SYNC_PUSH_ALARM) {
    void handleRemoteAutoSyncPushAlarm()
  }
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_APPEND_SELECTION_TO_QUICKNOTE) {
    const text = info.selectionText?.trim()
    if (!text) return
    void appendQuicknoteContent(text).catch((error) => {
      console.error('[Speedtab SW] Failed to append selection to Quicknote', error)
    })
    return
  }

  if (info.menuItemId === CONTEXT_MENU_CAPTURE_NOTE) {
    const text = info.selectionText?.trim()
    if (!text) return
    void storeCaptureItem({
      kind: 'note',
      title: null,
      text,
      url: null,
      source_url: info.pageUrl ?? tab?.url ?? null,
      source_title: tab?.title ?? null,
    })
    return
  }

  if (info.menuItemId === CONTEXT_MENU_CAPTURE_BOOKMARK) {
    const pageUrl = info.pageUrl ?? tab?.url ?? null
    if (!pageUrl) return
    void storeCaptureItem({
      kind: 'bookmark',
      title: tab?.title ?? pageUrl,
      text: null,
      url: pageUrl,
      source_url: pageUrl,
      source_title: tab?.title ?? null,
    })
    return
  }

  if (info.menuItemId === CONTEXT_MENU_CAPTURE_PAGE_NOTE) {
    const pageUrl = info.pageUrl ?? tab?.url ?? null
    if (!pageUrl) return
    void (async () => {
      const meta = await fetchPageMeta(pageUrl)
      await storeCaptureItem({
        kind: 'note',
        title: meta.title ?? tab?.title ?? pageUrl,
        text: buildCapturedPageNote({
          title: meta.title ?? tab?.title ?? null,
          url: meta.finalUrl,
          description: meta.description,
          selection: info.selectionText?.trim() || null,
        }),
        url: meta.finalUrl,
        source_url: meta.finalUrl,
        source_title: meta.title ?? tab?.title ?? null,
      })
    })()
  }
})

chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({
    url: chrome.runtime.getURL('src/newtab.html'),
  })
})

// ─── Message dispatcher ───────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: IncomingMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void,
  ) => {
    if (message.type === REMOTE_AUTO_SYNC_REFRESH_MESSAGE) {
      refreshRemoteAutoSyncSchedule({forceCheck: true})
        .then(() => sendResponse({ok: true}))
        .catch((err: unknown) => {
          sendResponse({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          })
        })
      return true
    }

    if (message.type === REMOTE_AUTO_SYNC_MARK_DIRTY_MESSAGE) {
      queueRemoteAutoSyncPush()
        .then(() => sendResponse({ok: true}))
        .catch((err: unknown) => {
          sendResponse({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          })
        })
      return true
    }

    if (message.type === 'FETCH_FEED') {
      // Phase 5: fetch the URL, parse XML, return raw string.
      // Stub response for Phase 1 so the message channel is testable.
      handleFetchFeed(message.url)
        .then(sendResponse)
        .catch((err: unknown) => {
          sendResponse({
            ok:    false,
            error: err instanceof Error ? err.message : String(err),
          })
        })

      // Return true to keep the message channel open for the async response.
      return true
    }

    if (message.type === 'FETCH_URL_META') {
      handleFetchUrlMeta(message.url)
        .then(sendResponse)
        .catch((err: unknown) => {
          sendResponse({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          })
        })
      return true
    }

    if (message.type === 'FETCH_URL_CONTENT') {
      handleFetchUrlContent(message.url)
        .then(sendResponse)
        .catch((err: unknown) => {
          sendResponse({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          })
        })
      return true
    }
  },
)

// ─── Handlers ────────────────────────────────────────────────────────────────

/**
 * Fetches the URL bypasses CORS via the Service Worker background context.
 * Includes a timeout to prevent hanging requests.
 */
async function handleFetchFeed(url: string): Promise<FetchFeedResponse> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)

    if (!response.ok) {
      return {
        ok: false,
        error: msg('httpError', [String(response.status), response.statusText]),
      }
    }

    const xml = await decodeResponseText(response, response.headers.get('content-type') ?? '')
    // DEBUG: temporary diagnostic — please remove after verifying the fix
    console.log('[Speedtab SW DEBUG] handleFetchFeed url=', url, ' sniffed charset=', (response as any).__sniffedCharset, ' first 200 chars:', xml.slice(0, 200))
    return { ok: true, xml }
  } catch (err: unknown) {
    if (err instanceof Error) {
      return { ok: false, error: err.name === 'AbortError' ? msg('requestTimedOut') : err.message }
    }
    return { ok: false, error: msg('requestFailed') }
  }
}

async function handleFetchUrlMeta(url: string): Promise<FetchUrlMetaResponse> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
    })
    clearTimeout(timeout)

    if (!response.ok) {
      return {
        ok: false,
        error: msg('httpError', [String(response.status), response.statusText]),
      }
    }

    const contentType = response.headers.get('content-type') ?? ''
    const finalUrl = response.url || url
    if (!contentType.includes('text/html')) {
      return { ok: true, title: null, description: null, finalUrl }
    }

    const html = await decodeResponseText(response, contentType)
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const title = titleMatch?.[1]
      ?.replace(/\s+/g, ' ')
      .trim() || null
    const description = extractDescription(html)

    return { ok: true, title, description, finalUrl }
  } catch (err: unknown) {
    if (err instanceof Error) {
      return { ok: false, error: err.name === 'AbortError' ? msg('requestTimedOut') : err.message }
    }
    return { ok: false, error: msg('requestFailed') }
  }
}

async function handleFetchUrlContent(url: string): Promise<FetchUrlContentResponse> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
    })
    clearTimeout(timeout)

    if (!response.ok) {
      return {
        ok: false,
        error: msg('httpError', [String(response.status), response.statusText]),
      }
    }

    const contentType = response.headers.get('content-type') ?? ''
    const html = await decodeResponseText(response, contentType)

    return {
      ok: true,
      html,
      contentType,
      finalUrl: response.url || url,
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      return { ok: false, error: err.name === 'AbortError' ? msg('requestTimedOut') : err.message }
    }
    return { ok: false, error: msg('requestFailed') }
  }
}
