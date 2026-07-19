import {SPEEDTAB_SVG} from '../../components/icons.js'
import {escapeHtml} from '../../utils/html.js'
import {t} from '../../utils/i18n.js'
import {getHtmlNoteSubtype, normalizeNoteStyleToken, renderNoteContentHtml} from '../modules/notes-shared.js'

export function renderQuicknoteWindow(state = {}) {
  return `
    <section
      data-floating-window
      data-window-id="quicknote"
      data-window-type="quicknote"
      style="top:${escapeHtml(String(state.y ?? 48))}px;left:${escapeHtml(String(state.x ?? 268))}px;width:${escapeHtml(String(state.width ?? 376))}px;height:${escapeHtml(String(state.height ?? 263))}px;z-index:${escapeHtml(String(state.z ?? 221))};"
    >
      <header data-window-header>
        <div data-window-title-wrap>
          <h2 data-window-title>${escapeHtml(t('scratchpad.title'))}</h2>
          <p data-window-subtitle>${escapeHtml(t('scratchpad.helperLabel'))}</p>
        </div>
        <div data-window-actions>
          <button type="button" data-click="refreshQuicknote" title="${escapeHtml(t('scratchpad.refreshAction'))}" aria-label="${escapeHtml(t('scratchpad.refreshAction'))}">
            &#x21bb;
          </button>
          <button type="button" data-click="closeQuicknote">${escapeHtml(t('common.close'))}</button>
        </div>
      </header>
      <textarea
        id="scratchpad_content"
        name="scratchpad_content"
        data-input-immediate="updateQuicknoteContent"
        data-window-field="content"
        placeholder="${escapeHtml(t('scratchpad.placeholder'))}"
        spellcheck="false"
      >${escapeHtml(state.content ?? '')}</textarea>
      <button type="button" data-window-resize-handle aria-label="${escapeHtml(t('common.settings'))}">
        ${SPEEDTAB_SVG.resizeGrip}
      </button>
    </section>
  `
}

export function renderLocalToolsRoot(state = {}) {
  const quicknoteHtml = state?.quicknote?.open ? renderQuicknoteWindow(state.quicknote) : ''
  const noteWindowsHtml = (state?.notes ?? []).map((note) => renderFloatingNoteWindow(note)).join('')
  return `${quicknoteHtml}${noteWindowsHtml}`
}

export function renderLocalToolsDropdownTrigger() {
  return `
    <span data-app-brand>
      <span data-st-icon aria-hidden="true">⚡</span>
      <span>${escapeHtml(t('app.title'))}</span>
    </span>
  `
}

function renderFloatingNoteWindow(note) {
  const styleToken = normalizeNoteStyleToken(note.style_token)
  const title = escapeHtml((note.editMode ? note.editTitle : note.title) || note.title || t('openNotes.noteTitle'))
  const htmlSubtype = !note.editMode && note.type === 'html'
    ? getHtmlNoteSubtype(note.content ?? '')
    : ''
  const contentHtml = note.editMode
    ? renderFloatingNoteEditor(note)
    : renderNoteContentHtml(note)
  const headerActionsHtml = note.editMode
    ? renderFloatingNoteEditorActions(note)
    : renderFloatingNoteViewActions(note, title)

  return `
    <article
      data-floating-window
      data-note-window-id="${escapeHtml(String(note.id))}"
      data-window-id="note:${escapeHtml(String(note.id))}"
      data-window-type="note"
      data-note-style-token="${escapeHtml(styleToken)}"
      class="st-note-window"
      style="top:${escapeHtml(String(note.y ?? 72))}px;left:${escapeHtml(String(note.x ?? 40))}px;width:${escapeHtml(String(note.width ?? 420))}px;height:${escapeHtml(String(note.height ?? 320))}px;z-index:${escapeHtml(String(note.z ?? 221))};"
    >
      <header data-window-header>
        <div data-window-title-wrap>
          <h2 data-window-title data-note-window-title>${title}</h2>
        </div>
        <div data-window-actions>${headerActionsHtml}</div>
      </header>
      <div
        data-note-window-body
        data-note-type="${escapeHtml(note.type ?? 'text')}"
        data-note-mode="${note.editMode ? 'edit' : 'view'}"
        ${htmlSubtype ? `data-note-html-subtype="${escapeHtml(htmlSubtype)}"` : ''}
      >${contentHtml}</div>
      <button type="button" data-window-resize-handle aria-label="${escapeHtml(t('noteViewer.resizeAria'))}">
        ${SPEEDTAB_SVG.resizeGrip}
      </button>
    </article>
  `
}

function renderFloatingNoteViewActions(note, title) {
  return `
    <button
      type="button"
      data-click="editFloatingNote"
      data-note-id="${escapeHtml(String(note.id ?? ''))}"
    >${escapeHtml(t('noteViewer.edit'))}</button>
    <button
      type="button"
      data-click="deleteOpenNote"
      data-note-id="${escapeHtml(String(note.id ?? ''))}"
      data-note-title="${title}"
    >${escapeHtml(t('noteViewer.delete'))}</button>
    <button
      type="button"
      data-click="closeFloatingNote"
      data-note-id="${escapeHtml(String(note.id ?? ''))}"
      aria-label="${escapeHtml(t('noteViewer.closeAria'))}"
    >${escapeHtml(t('noteViewer.close'))}</button>
  `
}

function renderFloatingNoteEditorActions(note) {
  const formId = `note-editor-${note.id}`
  const isCryptLocked = note.type === 'crypt' && typeof note.unlockedContent !== 'string'
  const previewButton = note.type === 'html'
    ? `
      <button
        type="button"
        data-click="toggleFloatingNotePreview"
        data-note-id="${escapeHtml(String(note.id ?? ''))}"
      >${escapeHtml(note.previewMode ? t('noteViewer.edit') : t('noteViewer.preview'))}</button>
    `
    : ''

  return `
    ${isCryptLocked ? '' : previewButton}
    <button
      type="button"
      data-click="cancelFloatingNoteEdit"
      data-note-id="${escapeHtml(String(note.id ?? ''))}"
    >${escapeHtml(t('common.cancel'))}</button>
    ${isCryptLocked ? '' : `
      <button
        type="submit"
        form="${escapeHtml(formId)}"
        data-btn="danger"
        data-form-save-btn
      >${escapeHtml(t('noteForm.saveChanges'))}</button>
    `}
    <button
      type="button"
      data-click="closeFloatingNote"
      data-note-id="${escapeHtml(String(note.id ?? ''))}"
      aria-label="${escapeHtml(t('noteViewer.closeAria'))}"
    >${escapeHtml(t('noteViewer.close'))}</button>
  `
}

function renderHtmlEditorToolbar(note) {
  if (note.type !== 'html') return ''
  return `
    <div class="st-note-editor-html-toolbar">
      <select
        name="template_theme"
        data-note-template-theme
        data-note-id="${escapeHtml(String(note.id ?? ''))}"
        title="${escapeHtml(t('common.settings'))}"
        aria-label="${escapeHtml(t('common.settings'))}"
      >
        <option value="light">${escapeHtml(t('noteForm.styleTokens.light'))}</option>
        <option value="dark">${escapeHtml(t('noteForm.styleTokens.dark'))}</option>
      </select>
      <button
        type="button"
        class="st-btn"
        data-btn="primary"
        data-click="insertFloatingNoteTabber"
        data-note-id="${escapeHtml(String(note.id ?? ''))}"
        title="${escapeHtml(t('noteForm.insertTabberTitle'))}"
        aria-label="${escapeHtml(t('noteForm.insertTabberTitle'))}"
      >${escapeHtml(t('noteForm.insertTabber'))}</button>
      <button
        type="button"
        class="st-btn"
        data-btn="primary"
        data-click="insertFloatingNoteTableau"
        data-note-id="${escapeHtml(String(note.id ?? ''))}"
        title="${escapeHtml(t('noteForm.insertTableauTitle'))}"
        aria-label="${escapeHtml(t('noteForm.insertTableauTitle'))}"
      >${escapeHtml(t('noteForm.insertTableau'))}</button>
    </div>
  `
}

function renderEditorColorOptions(selected) {
  const options = ['primary', 'secondary', 'success', 'warning', 'danger', 'light', 'dark']
  return options.map((value) => `
    <option value="${value}" data-note-token="${value}" data-ui-token="${value}"${selected === value ? ' selected' : ''}>${escapeHtml(t(`noteForm.styleTokens.${value}`))}</option>
  `).join('')
}

function renderEditorColorSelectAttrs(selected) {
  const token = normalizeNoteStyleToken(selected)
  return `data-note-color-select data-token-paint-select data-note-token="${escapeHtml(token)}" data-ui-token="${escapeHtml(token)}"`
}

function renderEditorLanguageField(note) {
  if (note.type !== 'code') return ''
  return `
    <label data-customizer-field data-customizer-field-type="select" data-note-editor-field>
      <span data-customizer-field-label>${escapeHtml(t('noteForm.language'))}</span>
      <select
        name="language"
        data-change="syncFloatingNoteEditorField"
        data-note-id="${escapeHtml(String(note.id ?? ''))}"
        data-editor-field="language"
      >
        <option value="auto"${note.editLanguage === 'auto' ? ' selected' : ''}>${escapeHtml(t('noteForm.code.autoDetect'))}</option>
        <option value="plaintext"${note.editLanguage === 'plaintext' ? ' selected' : ''}>${escapeHtml(t('noteForm.code.plaintext'))}</option>
        <option value="html"${note.editLanguage === 'html' ? ' selected' : ''}>HTML</option>
        <option value="css"${note.editLanguage === 'css' ? ' selected' : ''}>CSS</option>
        <option value="javascript"${note.editLanguage === 'javascript' ? ' selected' : ''}>JavaScript</option>
        <option value="json"${note.editLanguage === 'json' ? ' selected' : ''}>JSON</option>
        <option value="markdown"${note.editLanguage === 'markdown' ? ' selected' : ''}>Markdown</option>
        <option value="xml"${note.editLanguage === 'xml' ? ' selected' : ''}>XML</option>
      </select>
    </label>
  `
}

function renderFloatingNoteEditorOptions(note) {
  return `
    <details class="st-note-editor-options">
      <summary
        class="st-btn"
        title="${escapeHtml(t('common.options'))}"
        aria-label="${escapeHtml(t('common.options'))}"
      >${SPEEDTAB_SVG.cog}</summary>
      <div class="st-note-editor-options-panel">
        <button
          type="button"
          data-click="resetFloatingNoteWindowLayout"
          data-note-id="${escapeHtml(String(note.id ?? ''))}"
        >${escapeHtml(t('common.reset'))}</button>
      </div>
    </details>
  `
}

function renderFloatingNoteEditor(note) {
  const formId = `note-editor-${note.id}`
  const isHtml = note.type === 'html'
  const isCryptLocked = note.type === 'crypt' && typeof note.unlockedContent !== 'string'
  const charCount = String(note.editContent ?? '').length
  const contentLabel = note.type === 'links'
    ? `${t('noteForm.contentLabels.urls')} ${t('noteForm.contentLabels.onePerLine')}`
    : note.type === 'html'
      ? `${t('noteForm.contentLabels.html')} ${t('noteForm.contentLabels.sanitisedOnSave')}`
      : note.type === 'code'
        ? t('noteForm.contentLabels.code')
        : note.type === 'crypt'
          ? `${t('noteForm.contentLabels.plaintext')} ${t('noteForm.contentLabels.encryptedBeforeStorage')}`
          : t('noteForm.contentLabels.content')

  if (isCryptLocked) {
    return `
      <form
        id="${escapeHtml(formId)}"
        data-floating-note-form
        data-submit="saveFloatingNoteEdit"
        data-note-id="${escapeHtml(String(note.id ?? ''))}"
        class="st-note-editor-form st-note-editor-form-locked"
      >
        <div class="st-note-editor-crypt-unlock">
          <p data-customizer-field-label>${escapeHtml(t('noteForm.unlockToEdit'))}</p>
          <div class="st-note-crypt-unlock-row">
            <input
              type="${note.revealPassphrase ? 'text' : 'password'}"
              name="decrypt_passphrase"
              value="${escapeHtml(note.unlockPassphrase ?? '')}"
              autocomplete="off"
              spellcheck="false"
              data-form-state-ignore
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
            <button type="button" class="st-btn" data-btn="danger" data-click="unlockFloatingCryptNote" data-note-id="${escapeHtml(String(note.id ?? ''))}">${escapeHtml(t('noteForm.unlock'))}</button>
          </div>
          ${note.unlockError ? `<p data-note-form-error>${escapeHtml(note.unlockError)}</p>` : ''}
        </div>
      </form>
    `
  }

  return `
    <form
      id="${escapeHtml(formId)}"
      data-floating-note-form
      data-submit="saveFloatingNoteEdit"
      data-note-id="${escapeHtml(String(note.id ?? ''))}"
      class="st-note-editor-form${isHtml ? ' is-html' : ''}${note.previewMode ? ' is-preview' : ''}"
    >
      <div class="st-note-editor-fields">
        <label data-customizer-field
          data-customizer-field-type="text"
          data-st-width="100%"
          data-st-max-width="280px"
          data-st-display="block"
          data-note-editor-field>
          <span data-customizer-field-label>${escapeHtml(t('noteForm.title'))}</span>
          <input
            type="text"
            name="title"
            required
            value="${escapeHtml(note.editTitle ?? note.title ?? '')}"
            data-input-immediate="syncFloatingNoteEditorField"
            data-note-id="${escapeHtml(String(note.id ?? ''))}"
            data-editor-field="title"
          >
        </label>
        <label data-customizer-field data-customizer-field-type="select" data-note-editor-field>
          <span data-customizer-field-label>${escapeHtml(t('noteForm.colorScheme'))}</span>
          <select
            name="style_token"
            ${renderEditorColorSelectAttrs(note.editStyleToken ?? note.style_token ?? 'primary')}
            data-change="syncFloatingNoteEditorField"
            data-note-id="${escapeHtml(String(note.id ?? ''))}"
            data-editor-field="style_token"
          >
            ${renderEditorColorOptions(note.editStyleToken ?? note.style_token ?? 'primary')}
          </select>
        </label>
        ${renderEditorLanguageField(note)}
        ${note.hasSavedLayout ? `
        <div class="st-note-editor-side-actions">
          ${renderFloatingNoteEditorOptions(note)}
        </div>
        ` : ''}
      </div>
      <div class="st-note-editor-panels${isHtml ? ' is-html' : ''}">
        ${isHtml ? `
          <section class="st-note-editor-preview-panel">
            <div class="st-note-editor-panel-head">
              <div class="st-note-editor-panel-title">${escapeHtml(t('noteViewer.preview'))}</div>
            </div>
            <div
              class="st-note-html-content st-module-notes-type-html"
              data-note-editor-preview
              data-note-html-render
              data-note-html-render-key="note-preview:${escapeHtml(String(note.id ?? ''))}"
              data-note-html-source="${escapeHtml(note.editContent ?? '')}"
              ${isHtml && getHtmlNoteSubtype(note.editContent ?? '') ? 'data-note-html-subtype="tabs"' : ''}
            ></div>
          </section>
        ` : ''}
        <section class="st-note-editor-input-panel">
          <div class="st-note-editor-panel-head">
            <div class="st-note-editor-panel-tools st-note-editor-panel-tools-spread">
              <div class="st-note-editor-panel-meta">
                <span class="st-note-editor-type-badge">${escapeHtml(t(`noteForm.types.${note.type}`))}</span>
                <span class="st-note-editor-char-count">${escapeHtml(String(charCount))}</span>
              </div>
              ${renderHtmlEditorToolbar(note)}
            </div>
          </div>
          <textarea
            name="content"
            rows="${isHtml ? '16' : '12'}"
            data-input-immediate="syncFloatingNoteEditorField"
            data-note-id="${escapeHtml(String(note.id ?? ''))}"
            data-editor-field="content"
            spellcheck="${note.type === 'code' ? 'false' : 'true'}"
          >${escapeHtml(note.editContent ?? '')}</textarea>
        </section>
      </div>
      ${note.editError ? `<p data-note-form-error>${escapeHtml(note.editError)}</p>` : ''}
    </form>
  `
}
