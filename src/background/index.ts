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
 * Current phase: Phase 1 scaffold only.
 *   The message handler is wired up and typed; the actual fetch + XML parsing
 *   will be implemented in Phase 5.
 */

import { db } from '@/db/db'
import { loadLocalToolsState, saveLocalToolsState } from '../next/data/local-tools.js'

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

type IncomingMessage = FetchFeedMessage | FetchUrlMetaMessage | FetchUrlContentMessage

const CONTEXT_MENU_CAPTURE_NOTE = 'speedtab-capture-note'
const CONTEXT_MENU_CAPTURE_BOOKMARK = 'speedtab-capture-bookmark'
const CONTEXT_MENU_CAPTURE_PAGE_NOTE = 'speedtab-capture-page-note'
const CONTEXT_MENU_APPEND_SELECTION_TO_QUICKNOTE = 'speedtab-append-selection-to-quicknote'
const CONTEXT_MENU_PARENT = 'speedtab-parent'

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function findMetaContent(html: string, attribute: 'name' | 'property' | 'itemprop', value: string): string | null {
  const escapedValue = escapeRegex(value)
  const patterns = [
    new RegExp(`<meta\\b[^>]*\\b${attribute}\\s*=\\s*(["'])${escapedValue}\\1[^>]*\\bcontent\\s*=\\s*(["'])([\\s\\S]*?)\\2[^>]*>`, 'i'),
    new RegExp(`<meta\\b[^>]*\\bcontent\\s*=\\s*(["'])([\\s\\S]*?)\\1[^>]*\\b${attribute}\\s*=\\s*(["'])${escapedValue}\\3[^>]*>`, 'i'),
    new RegExp(`<meta\\b[^>]*\\b${attribute}\\s*=\\s*(?:["']${escapedValue}["']|${escapedValue})[^>]*\\bcontent\\s*=\\s*(["'])([\\s\\S]*?)\\1[^>]*>`, 'i'),
    new RegExp(`<meta\\b[^>]*\\bcontent\\s*=\\s*(["'])([\\s\\S]*?)\\1[^>]*\\b${attribute}\\s*=\\s*(?:["']${escapedValue}["']|${escapedValue})[^>]*>`, 'i'),
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    const content = match?.[3] ?? match?.[2] ?? null
    if (content?.trim()) return content.replace(/\s+/g, ' ').trim()
  }

  return null
}

function extractDescription(html: string): string | null {
  return findMetaContent(html, 'name', 'description')
    || findMetaContent(html, 'property', 'og:description')
    || findMetaContent(html, 'name', 'twitter:description')
    || findMetaContent(html, 'itemprop', 'description')
}

function msg(name: string, substitutions?: string | string[]): string {
  return chrome.i18n.getMessage(name, substitutions) || name
}

async function ensureContextMenus() {
  await chrome.contextMenus.removeAll()
  chrome.contextMenus.create({
    id: CONTEXT_MENU_PARENT,
    title: msg('contextMenuRoot'),
    contexts: ['selection', 'page'],
  })
  chrome.contextMenus.create({
    id: CONTEXT_MENU_CAPTURE_BOOKMARK,
    parentId: CONTEXT_MENU_PARENT,
    title: msg('saveCurrentPageAsBookmark'),
    contexts: ['page', 'selection'],
  })
  chrome.contextMenus.create({
    id: CONTEXT_MENU_CAPTURE_PAGE_NOTE,
    parentId: CONTEXT_MENU_PARENT,
    title: msg('storeCurrentPageAsNote'),
    contexts: ['page', 'selection'],
  })
  chrome.contextMenus.create({
    id: CONTEXT_MENU_CAPTURE_NOTE,
    parentId: CONTEXT_MENU_PARENT,
    title: msg('saveSelectionAsNote'),
    contexts: ['selection'],
  })
  chrome.contextMenus.create({
    id: CONTEXT_MENU_APPEND_SELECTION_TO_QUICKNOTE,
    parentId: CONTEXT_MENU_PARENT,
    title: msg('appendSelectionToQuicknote'),
    contexts: ['selection'],
  })
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

    const html = await response.text()
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
})

chrome.runtime.onStartup.addListener(() => {
  void ensureContextMenus()
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
    sendResponse: (response: FetchFeedResponse) => void,
  ) => {
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

    const xml = await response.text()
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

    const html = await response.text()
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
    const html = await response.text()

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
