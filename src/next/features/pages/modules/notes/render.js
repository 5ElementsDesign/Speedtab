import {escapeHtml} from '../../../../utils/html.js'
import {t} from '../../../../utils/i18n.js'
import {getNotePreviewText, getNoteTokenClass} from '../../../modules/notes-shared.js'
import {renderModuleTabs} from '../tabs/render.js'

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
        class="st-trigger-note-proxy st-btn"
        data-click="addModuleNote"
        data-swipe-allow
        data-sync-id="${escapeHtml(moduleSyncId)}"
        data-note-inline-add
        title="${escapeHtml(t('modules.actions.addNote'))}"
        aria-label="${escapeHtml(t('modules.actions.addNote'))}"
      ><i data-icon="plus" aria-hidden="true"></i></button>
    </div>
  `
}

export function renderNotesGrid(notes = [], moduleSyncId = '', config = {}) {
  const showAddTile = config?.behavior?.['module-tabs-show-add-tile'] !== false
  const noteTiles = notes.map((note) => renderNoteTile(note, moduleSyncId)).join('')
  return `
    <div
      class="st-module-content-wrapper"
      data-module-tabs-notes
      ${notes.length ? '' : 'data-notes-empty'}
    >
      ${!notes.length ? `<p class="st-notes-empty m-0">${escapeHtml(t('notesView.noNotes'))}</p>` : ''}
      ${noteTiles}
      ${showAddTile ? renderNoteAddTile(moduleSyncId) : ''}
    </div>
  `
}

export function renderNotesModule(tabs = [], actionsHtml = '', moduleId = null, moduleSyncId = '', config = {}) {
  return renderModuleTabs(
    tabs,
    (tab) => renderNotesGrid(tab.notes ?? [], moduleSyncId, config),
    {actionsHtml, moduleId, emptyLabel: t('modules.empty.notes')},
  )
}
