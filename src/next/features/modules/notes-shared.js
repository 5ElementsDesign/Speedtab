import {parseCryptPayload} from '../../../composables/useCrypt.ts'
import {sanitizeHtml} from '../../../composables/useSanitize.ts'
import {escapeHtml} from '../../utils/html.js'
import {t} from '../../utils/i18n.js'

const NOTE_STYLE_ALIASES = {
  default: 'primary',
  info: 'secondary',
}

const NOTE_STYLE_CLASS_MAP = {
  primary: 'st-color-primary',
  secondary: 'st-color-secondary',
  success: 'st-color-success',
  warning: 'st-color-warning',
  danger: 'st-color-danger',
  dark: 'st-color-dark',
  light: 'st-color-light',
}

const NOTE_BORDER_CLASS_MAP = {
  primary: 'st-color-primary-border',
  secondary: 'st-color-secondary-border',
  success: 'st-color-success-border',
  warning: 'st-color-warning-border',
  danger: 'st-color-danger-border',
  dark: 'st-color-dark-border',
  light: 'st-color-light-border',
}

export function normalizeNoteStyleToken(token) {
  const value = typeof token === 'string' ? token.trim().toLowerCase() : ''
  return (NOTE_STYLE_ALIASES[value] ?? value) || 'primary'
}

export function getNoteTokenClass(token) {
  return NOTE_STYLE_CLASS_MAP[normalizeNoteStyleToken(token)] ?? NOTE_STYLE_CLASS_MAP.primary
}

export function getNoteBorderClass(token) {
  return NOTE_BORDER_CLASS_MAP[normalizeNoteStyleToken(token)] ?? NOTE_BORDER_CLASS_MAP.primary
}

export function getNoteAccentCssValue(token) {
  const normalized = normalizeNoteStyleToken(token)
  const varName = {
    primary: '--st-color-primary',
    secondary: '--st-color-secondary',
    success: '--st-color-success',
    warning: '--st-color-warning',
    danger: '--st-color-danger',
    dark: '--st-color-dark',
    light: '--st-color-light',
  }[normalized] ?? '--st-color-primary'
  return `var(${varName})`
}

export function parseNoteMeta(metaJson) {
  if (!metaJson) return {}
  try {
    const parsed = JSON.parse(metaJson)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function isTabbedHtmlNoteContent(content = '') {
  return typeof content === 'string' && content.includes('data-yai-tabs')
}

export function getHtmlNoteSubtype(content = '') {
  return isTabbedHtmlNoteContent(content) ? 'tabs' : ''
}

function stripTags(value = '') {
  return String(value).replace(/<[^>]+>/g, ' ')
}

function getCryptPayloadPreview(content = '') {
  try {
    return parseCryptPayload(content).ciphertext ?? content
  } catch {
    return content
  }
}

export function getNotePreviewText(note = {}) {
  if (note.type === 'crypt') return t('noteTile.encrypted')
  const source = note.type === 'html'
    ? stripTags(note.content)
    : String(note.content ?? '')
  const line = source.split(/\r?\n/).find((entry) => entry.trim())
  return line?.trim() ?? ''
}

export function parseLinkNoteContent(content = '') {
  const entries = String(content)
    .split(/\r?\n/)
    .map((line, index) => ({line: line.trim(), index}))
    .filter(({line}) => line.length > 0)
  const items = []
  let textBuffer = []
  let textStartIndex = null

  const flushTextBuffer = () => {
    if (!textBuffer.length) return
    items.push({
      kind: 'text',
      key: `text:${textStartIndex ?? 0}`,
      lines: [...textBuffer],
    })
    textBuffer = []
    textStartIndex = null
  }

  entries.forEach(({line, index}) => {
    if (line === '[hr]' || line.toLowerCase() === '<hr>') {
      flushTextBuffer()
      items.push({kind: 'divider', key: `divider:${index}`})
      return
    }

    try {
      const url = new URL(line)
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        flushTextBuffer()
        items.push({
          kind: 'link',
          key: `link:${index}`,
          text: line,
          url: url.toString(),
        })
        return
      }
    } catch {
      // Plain text headings are valid in link notes.
    }

    if (textStartIndex === null) textStartIndex = index
    textBuffer.push(line)
  })

  flushTextBuffer()

  return items
}

export function renderNoteContentHtml(note = {}) {
  const content = String(note.content ?? '')

  if (note.type === 'html') {
    const subtype = getHtmlNoteSubtype(content)
    return `
      <div
        class="st-note-html-content st-module-notes-type-html"
        data-note-html-render
        data-note-html-render-key="note-view:${escapeHtml(String(note.id ?? ''))}"
        data-note-html-source="${escapeHtml(content)}"
        ${subtype ? `data-note-html-subtype="${escapeHtml(subtype)}"` : ''}
      >${sanitizeHtml(content)}</div>
    `
  }

  if (note.type === 'code') {
    const meta = parseNoteMeta(note.meta_json ?? null)
    const language = typeof meta.language === 'string' ? meta.language : 'auto'
    return `<pre class="st-note-content-pre st-note-code-pre"><code data-note-code-block data-note-code-language="${escapeHtml(language)}">${escapeHtml(content)}</code></pre>`
  }

  if (note.type === 'links') {
    const items = parseLinkNoteContent(content)
    if (!items.length) return `<p class="st-note-empty-copy">${escapeHtml(t('notesView.noNotes'))}</p>`
    return `
      <ul class="st-note-link-list">
        ${items.map((item) => {
          if (item.kind === 'divider') return `<li><hr class="st-note-link-divider"></li>`
          if (item.kind === 'link') {
            const label = escapeHtml(item.text)
            const href = escapeHtml(item.url)
            return `
              <li>
                <a class="st-note-link-row" href="${href}" target="_blank" rel="noopener noreferrer">
                  <span class="st-note-link-icon">
                    <img
                      data-favicon-url="${href}"
                      alt=""
                      class="st-note-link-icon-image"
                      draggable="false"
                    >
                  </span>
                  <span class="st-note-link-label">${label}</span>
                </a>
              </li>
            `
          }
          return `
            <li>
              <blockquote class="st-note-link-copy">
                ${item.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
              </blockquote>
            </li>
          `
        }).join('')}
      </ul>
    `
  }

  if (note.type === 'crypt') {
    const payloadPreview = getCryptPayloadPreview(content)
    if (typeof note.unlockedContent === 'string') {
      return `
        <div class="st-note-crypt-state">
          <pre class="st-note-content-pre">${escapeHtml(note.unlockedContent)}</pre>
          <hr>
          <button type="button" class="st-note-crypt-lock-button" data-click="lockFloatingCryptNote" data-note-id="${escapeHtml(String(note.id ?? ''))}">
            ${escapeHtml(t('noteViewer.lock'))}
          </button>
        </div>
      `
    }

    return `
      <div class="st-note-crypt-placeholder">
        <div class="st-note-crypt-unlock-row">
          <input
            type="${note.revealPassphrase ? 'text' : 'password'}"
            name="note_viewer_passphrase_${escapeHtml(String(note.id ?? ''))}"
            placeholder="${escapeHtml(t('noteViewer.passphrase'))}"
            value="${escapeHtml(note.unlockPassphrase ?? '')}"
            autocomplete="off"
            spellcheck="false"
            data-note-crypt-passphrase
          >
          <button
            type="button"
            class="st-note-crypt-visibility-toggle"
            data-click="toggleFloatingCryptPassphrase"
            data-note-id="${escapeHtml(String(note.id ?? ''))}"
            title="${escapeHtml(note.revealPassphrase ? t('noteViewer.hidePassphrase') : t('noteViewer.showPassphrase'))}"
            aria-label="${escapeHtml(note.revealPassphrase ? t('noteViewer.hidePassphrase') : t('noteViewer.showPassphrase'))}"
          >${note.revealPassphrase ? '📛' : '👀'}</button>
          <button
            type="button"
            class="st-btn"
            data-btn="danger"
            data-click="unlockFloatingCryptNote"
            data-note-id="${escapeHtml(String(note.id ?? ''))}"
          >${escapeHtml(note.unlocking ? t('noteViewer.unlocking') : t('noteViewer.unlock'))}</button>
        </div>
        ${note.unlockError ? `<p class="st-note-crypt-error">${escapeHtml(note.unlockError)}</p>` : ''}
        <div class="st-note-state-encrypted">
          <p>${escapeHtml(t('noteViewer.encryptedPayload'))}</p>
          <div class="st-note-crypt-payload">${escapeHtml(payloadPreview)}</div>
        </div>
      </div>
    `
  }

  return `<pre class="st-note-content-pre">${escapeHtml(content)}</pre>`
}
