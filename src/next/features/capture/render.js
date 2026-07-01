import {escapeHtml} from '../../utils/html.js'
import {t} from '../../utils/i18n.js'

function renderModuleOptions(modules = [], selectedModuleId = null) {
  return modules.map((module) => `
    <option value="${escapeHtml(String(module.id))}"${module.id === selectedModuleId ? ' selected' : ''}>
      ${escapeHtml(module.label)}
    </option>
  `).join('')
}

function renderCollectionOptions(collections = [], selectedCollectionId = null) {
  return collections.map((collection) => `
    <option value="${escapeHtml(String(collection.id))}"${collection.id === selectedCollectionId ? ' selected' : ''}>
      ${escapeHtml(collection.title || t('cleanup.untitledCollection'))}
    </option>
  `).join('')
}

function renderNoteOptions(notes = [], selectedNoteId = null) {
  const base = `<option value="">${escapeHtml(t('capture.createNewNote'))}</option>`
  const rows = notes.map((note) => `
    <option
      value="${escapeHtml(String(note.id))}"
      ${note.id === selectedNoteId ? ' selected' : ''}
      ${note.type === 'crypt' ? 'disabled' : ''}
    >
      ${escapeHtml(note.title || t('capture.untitledNote'))}${note.type === 'crypt' ? escapeHtml(t('capture.encryptedSuffix')) : ''}
    </option>
  `).join('')

  return `${base}${rows}`
}

function renderPreview(item, draftNoteText) {
  if (!item) return ''

  if (item.kind === 'note') {
    return `
      <textarea
        id="capture_note_preview"
        name="capture_note_preview"
        data-input="captureEditText"
        data-capture-item-id="${escapeHtml(String(item.id ?? ''))}"
      >${escapeHtml(draftNoteText ?? item.text ?? '')}</textarea>
    `
  }

  return `
    <div data-capture-bookmark-preview>
      <strong>${escapeHtml(item.title || t('capture.capturedBookmark'))}</strong>
      ${item.url ? `<span>${escapeHtml(item.url)}</span>` : ''}
      ${item.source_title && item.source_title !== item.title ? `<span>${escapeHtml(item.source_title)}</span>` : ''}
    </div>
  `
}

export function renderCaptureInboxModal(state) {
  const {
    items = [],
    activeItem = null,
    eligibleModules = [],
    eligibleCollections = [],
    eligibleNotes = [],
    selectedModuleId = null,
    selectedCollectionId = null,
    selectedNoteId = null,
    draftNoteText = '',
  } = state

  if (!items.length) {
    return `<div data-capture-empty>${escapeHtml(t('capture.noItemsWaiting'))}</div>`
  }

  return `
    <div data-capture-inbox>
      <div data-capture-layout>
        <aside data-capture-list>
          ${items.map((item) => `
            <button
              type="button"
              class="st-btn"
              data-click="captureSelectItem"
              data-capture-item-id="${escapeHtml(String(item.id ?? ''))}"
              ${item.id === activeItem?.id ? 'data-capture-active' : ''}
            >
              <span data-capture-kind>${escapeHtml(t(`capture.${item.kind}`))}</span>
              <span data-capture-title>${escapeHtml(item.title || item.url || t('capture.capturedItem'))}</span>
            </button>
          `).join('')}
        </aside>

        <section data-capture-detail>
          <div data-capture-preview-card>
            <div data-capture-preview-label>${escapeHtml(t('capture.preview'))}</div>
            ${renderPreview(activeItem, draftNoteText)}
          </div>

          <div data-capture-fields>
            <label data-customizer-field>
              <span data-customizer-field-label>${escapeHtml(t('capture.module'))}</span>
              <select
                id="capture_module"
                name="capture_module"
                data-change="captureSelectModule"
              >
                ${renderModuleOptions(eligibleModules, selectedModuleId)}
              </select>
            </label>

            <label data-customizer-field>
              <span data-customizer-field-label>${escapeHtml(t('capture.tab'))}</span>
              <select
                id="capture_collection"
                name="capture_collection"
                data-change="captureSelectCollection"
              >
                ${renderCollectionOptions(eligibleCollections, selectedCollectionId)}
              </select>
            </label>

            ${activeItem?.kind === 'note' && eligibleNotes.length ? `
              <label data-customizer-field>
                <span data-customizer-field-label>${escapeHtml(t('capture.existingNote'))}</span>
                <select
                  id="capture_note_target"
                  name="capture_note_target"
                  data-change="captureSelectNote"
                >
                  ${renderNoteOptions(eligibleNotes, selectedNoteId)}
                </select>
              </label>
            ` : ''}
          </div>

          <div data-capture-actions>
            <button
              type="button"
              class="st-btn"
              data-click="captureDiscard"
              data-capture-item-id="${escapeHtml(String(activeItem?.id ?? ''))}"
            >${escapeHtml(t('capture.discard'))}</button>

            <div data-capture-actions-main>
              <button type="button" class="st-btn" data-modal-close>${escapeHtml(t('common.close'))}</button>
              <button
                type="button"
                class="st-btn"
                data-variant="${selectedNoteId ? 'secondary' : 'danger'}"
                data-click="captureSave"
              >
                ${escapeHtml(activeItem?.kind === 'note'
                  ? (selectedNoteId ? t('capture.append') : t('capture.createNewNoteAction'))
                  : t('capture.saveToSpeedtab'))}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  `
}
