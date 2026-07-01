import {SPEEDTAB_SVG} from '../../../../components/icons.js'
import {escapeHtml} from '../../../../utils/html.js'
import {t} from '../../../../utils/i18n.js'
import {getNotePreviewText, getNoteTokenClass} from '../../../modules/notes-shared.js'

function renderNoteTile(note, moduleSyncId = '') {
  const title = escapeHtml(note.title || t('openNotes.noteTitle'))
  const preview = escapeHtml(getNotePreviewText(note))
  const tokenClass = getNoteTokenClass(note.style_token)
  const previewClass = note.type === 'crypt'
    ? 'st-note-preview-copy st-note-preview-copy-encrypted'
    : 'st-note-preview-copy'

  return `
    <button
      type="button"
      class="st-btn st-trigger-note st-note-preview-surface"
      data-click="openModuleNote"
      data-note-id="${escapeHtml(String(note.id ?? ''))}"
      data-note-sync-id="${escapeHtml(note.sync_id ?? '')}"
      data-module-sync-id="${escapeHtml(moduleSyncId)}"
      title="${title}"
      aria-label="${title}"
    >
      <div class="st-note-preview-head ${tokenClass}">
        <span class="st-note-preview-title">${title}</span>
      </div>
      <div class="st-note-preview-content">
        <p class="${previewClass}">${preview}</p>
      </div>
    </button>
  `
}

function renderNoteAddTile(moduleSyncId = '') {
  return `
    <div data-note-tile data-note-add-tile>
      <button
        type="button"
        class="st-trigger-note st-btn"
        data-click="addModuleNote"
        data-swipe-allow
        data-sync-id="${escapeHtml(moduleSyncId)}"
        data-note-inline-add
        title="${escapeHtml(t('next.modules.actions.addNote'))}"
        aria-label="${escapeHtml(t('next.modules.actions.addNote'))}"
      >${SPEEDTAB_SVG.plus}</button>
    </div>
  `
}

export function renderNotesGrid(notes = [], moduleSyncId = '') {
  const noteTiles = notes.map((note) => renderNoteTile(note, moduleSyncId)).join('')
  const addTileAttr = 'data-note-add-tile'
  return `
    <div
      class="st-module-content-wrapper"
      data-module-tabs-notes
      ${notes.length ? '' : 'data-notes-empty'}
    >
      ${!notes.length ? `<p class="st-notes-empty m-0">${escapeHtml(t('notesView.noNotes'))}</p>` : ''}
      ${noteTiles}
      ${renderNoteAddTile(moduleSyncId)}
    </div>
  `
}

export function renderNotesModule(tabs = [], actionsHtml = '', moduleId = null, moduleSyncId = '') {
  const actions = actionsHtml
    ? `<div data-module-actions data-swipe-ignore>${actionsHtml}</div>`
    : ''
  const cardActions = actionsHtml
    ? `<div data-module-card-actions-host data-swipe-ignore>${actionsHtml}</div>`
    : ''

  if (!tabs.length) {
    return `
      <div data-module-empty-state-wrap>
        ${actions}
        ${cardActions}
        <div data-swipe-ignore><p class="st-module-empty-state m-0">${escapeHtml(t('next.modules.empty.notes'))}</p></div>
      </div>
    `
  }

  const refPathName = moduleId != null ? `m${moduleId}` : null
  let currentModulePage = refPathName ? new URLSearchParams(location.hash.slice(1)).get(refPathName) : null
  currentModulePage = currentModulePage ? currentModulePage.replace('tab-', '') : null

  const navBtns = tabs.map((tab, idx) => `
    <button
      data-tab-action="open"
      ${currentModulePage == tab.id ? 'data-inview-default' : ''}
      ${!currentModulePage && idx === 0 ? 'data-inview-default data-default' : ''}
      data-open="tab-${tab.id}"
      data-tab-id="${escapeHtml(String(tab.id ?? ''))}"
      data-tab-sync-id="${escapeHtml(tab.sync_id ?? '')}"
    >${escapeHtml(tab.title)}</button>
  `).join('')

  const panels = tabs.map((tab) => `
    <div data-tab="tab-${tab.id}" data-tab-id="${escapeHtml(String(tab.id ?? ''))}" data-tab-sync-id="${escapeHtml(tab.sync_id ?? '')}">
      ${renderNotesGrid(tab.notes ?? [], moduleSyncId)}
    </div>
  `).join('')

  const refPath = moduleId != null ? ` data-ref-path="${refPathName}"` : ''

  return `
    <div data-module-tabs-shell>
      <div data-yai-tabs data-swipe data-behavior="fade"${refPath}>
        <nav data-controller>${navBtns}</nav>
        ${actions}
        <div data-content>${panels}</div>
      </div>
      ${cardActions}
    </div>
  `
}
