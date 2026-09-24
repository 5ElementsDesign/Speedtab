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
        <i data-icon="resize-grip" aria-hidden="true"></i>
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
      <img data-app-brand-logo src="/icons/icon48.png" width="22" height="22" alt="Speedtab Logo"/>
      <span data-app-brand-name>${escapeHtml(t('app.title'))}</span>
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
    : note.virtualMarkup
      ? `<pre class="st-note-content-pre st-note-code-pre">${escapeHtml(note.content ?? '')}</pre>`
      : renderNoteContentHtml(note)
  const headerQuickActions = note.virtualNote
    ? renderVirtualNoteQuickActions(note)
    : note.editMode
      ? renderFloatingNoteEditorQuickActions(note)
      : renderFloatingNoteViewQuickActions(note)
  const headerOptionsHtml = note.virtualNote ? '' : renderFloatingNoteHeaderOptions(
    note,
    note.editMode ? renderFloatingNoteEditorOptions(note) : renderFloatingNoteViewOptions(note, title),
  )

  return `
    <article
      data-floating-window
      data-note-window-id="${escapeHtml(String(note.id))}"
      data-window-id="note:${escapeHtml(String(note.id))}"
      data-window-type="note"
      data-note-window-mode="${note.editMode ? 'edit' : 'view'}"
      data-note-style-token="${escapeHtml(styleToken)}"
      ${note.pageSlug && !note.noteShowOnAllPages ? `data-note-page="${escapeHtml(note.pageSlug)}"` : ''}
      ${note.notePageHidden ? 'hidden' : ''}
      ${note.noteBare ? 'data-note-bare' : ''}
      ${note.noteNailed ? 'data-note-nailed' : ''}
      class="st-note-window${note.noteHideHeader ? ' st-module-header-hidden' : ''}${note.noteResetPadding ? ' st-reset-padding' : ''}"
      style="top:${escapeHtml(String(note.y ?? 72))}px;left:${escapeHtml(String(note.x ?? 40))}px;width:${escapeHtml(String(note.width ?? 420))}px;height:${escapeHtml(String(note.height ?? 320))}px;z-index:${escapeHtml(String(note.z ?? 221))};"
    >
      <header data-window-header>
        <div data-window-title-wrap>
          <h2 data-window-title data-note-window-title>${title}</h2>
        </div>
        ${note.noteHideHeader ? '' : `<div data-window-actions>${headerQuickActions}${headerOptionsHtml}</div>`}
      </header>
      <div
        data-note-window-body
        data-note-type="${escapeHtml(note.type ?? 'text')}"
        data-note-mode="${note.editMode ? 'edit' : 'view'}"
        ${htmlSubtype ? `data-note-html-subtype="${escapeHtml(htmlSubtype)}"` : ''}
      >${contentHtml}</div>
      ${note.noteHideHeader ? `
        <span data-note-window-grab data-todo-swipe-grab aria-hidden="true"></span>
        <div data-note-hidden-options>${headerOptionsHtml}</div>
      ` : ''}
      <button type="button" data-window-resize-handle aria-label="${escapeHtml(t('noteViewer.resizeAria'))}">
        <i data-icon="resize-grip" aria-hidden="true"></i>
      </button>
    </article>
  `
}

function renderFloatingNoteViewQuickActions(note) {
  return `
    <button
      type="button"
      class="st-btn"
      data-click="closeFloatingNote"
      data-note-id="${escapeHtml(String(note.id ?? ''))}"
      aria-label="${escapeHtml(t('noteViewer.closeAria'))}"
      title="${escapeHtml(t('noteViewer.close'))}"
    ><i data-icon="x" aria-hidden="true"></i></button>
    <button
      type="button"
      class="st-btn"
      data-click="editFloatingNote"
      data-note-id="${escapeHtml(String(note.id ?? ''))}"
      title="${escapeHtml(t('noteViewer.edit'))}"
    ><i data-icon="pencil" aria-hidden="true"></i></button>
  `
}

function renderVirtualNoteQuickActions(note) {
  const noteId = escapeHtml(String(note.id ?? ''))
  return `
    <button type="button" class="st-btn" data-click="closeFloatingNote" data-note-id="${noteId}" title="${escapeHtml(t('noteViewer.close'))}" aria-label="${escapeHtml(t('noteViewer.closeAria'))}"><i data-icon="x" aria-hidden="true"></i></button>
    <button type="button" class="st-btn" data-click="toggleVirtualNoteMarkup" data-note-id="${noteId}" title="Toggle markup">&lt;/&gt;</button>
    <button type="button" class="st-btn" data-click="saveVirtualNoteToInbox" data-note-id="${noteId}" title="${escapeHtml(t('capture.saveToSpeedtab'))}">${escapeHtml(t('nav.inbox'))}</button>
    <button
      type="button"
      class="st-btn"
      data-btn="ghost"
      data-click="openInPip"
      data-pip-trigger
      data-pip-target="${escapeHtml(`[data-window-id=\"note:${String(note.id ?? '')}\"]`)}"
      data-pip-width="${escapeHtml(String(note.width ?? 820))}"
      data-pip-height="${escapeHtml(String(note.height ?? 660))}"
      title="${escapeHtml(t('common.pictureInPicture'))}"
      aria-label="${escapeHtml(t('common.pictureInPicture'))}"
    ><i data-icon="external" aria-hidden="true"></i></button>
  `
}

function renderFloatingNoteViewOptions(note, title) {
  return `
    <button
      type="button"
      class="st-btn"
      data-btn="danger"
      data-click="deleteOpenNote"
      data-note-id="${escapeHtml(String(note.id ?? ''))}"
      data-note-title="${title}"
      title="${escapeHtml(t('noteViewer.delete'))}"
    ><i data-icon="trash" aria-hidden="true"></i></button>
    ${renderFlyingConfigButton(note)}
    <button
      type="button"
      class="st-btn"
      data-btn="ghost"
      data-click="openInPip"
      data-pip-trigger
      data-pip-target="${escapeHtml(`[data-window-id=\"note:${String(note.id ?? '')}\"]`)}"
      data-pip-width="${escapeHtml(String(note.width ?? 820))}"
      data-pip-height="${escapeHtml(String(note.height ?? 660))}"
      title="${escapeHtml(t('common.pictureInPicture'))}"
      aria-label="${escapeHtml(t('common.pictureInPicture'))}"
    ><i data-icon="external" aria-hidden="true"></i></button>
  `
}

function renderFloatingNoteEditorQuickActions(note) {
  const formId = `note-editor-${note.id}`
  const isCryptLocked = note.type === 'crypt' && typeof note.unlockedContent !== 'string'
  const previewButton = note.type === 'html'
    ? `
      <button
        type="button"
        class="st-btn"
        data-btn="ghost"
        data-click="toggleFloatingNotePreview"
        data-note-id="${escapeHtml(String(note.id ?? ''))}"
        title="${escapeHtml(note.previewMode ? t('noteViewer.focus') : t('noteViewer.preview'))}"
      >${escapeHtml(note.previewMode ? t('noteViewer.focus') : t('noteViewer.preview'))}</button>
    ` : ''

  return `
    ${isCryptLocked ? '' : previewButton}
    <button
      type="button"
      class="st-btn"
      data-btn="warning"
      data-click="cancelFloatingNoteEdit"
      data-note-id="${escapeHtml(String(note.id ?? ''))}"
      title="${escapeHtml(t('common.cancel'))}"
    ><i data-icon="blocked" aria-hidden="true"></i></button>
    ${isCryptLocked ? '' : `
      <button
        type="submit"
        class="st-btn"
        form="${escapeHtml(formId)}"
        data-btn="danger"
        data-form-save-btn
        title="${escapeHtml(t('common.save'))}"
      >${escapeHtml(t('common.save'))}</button>
    `}
  `
}

function renderFloatingNoteEditorOptions(note) {
  return `
    ${renderFlyingConfigButton(note)}
  `
}

function renderFlyingConfigButton(note) {
  if (note.type !== 'html') return ''
  return `
    <button
      type="button"
      class="st-btn"
      data-btn="ghost"
      data-click="openFlyingConfig"
      data-flying-config-trigger
      data-note-id="${escapeHtml(String(note.id ?? ''))}"
      title="Flying Config"
      aria-label="Flying Config"
    ><i data-icon="tools" aria-hidden="true"></i></button>
  `
}

function renderHtmlEditorToolbar(note) {
  if (note.type !== 'html') return ''
  return `
    <div class="st-note-editor-html-toolbar">
      <button
        type="button"
        class="st-btn"
        data-btn="primary"
        data-click="toggleFloatingNoteWorldClockGenerator"
        data-note-id="${escapeHtml(String(note.id ?? ''))}"
        title="${escapeHtml(t('noteForm.worldClockTitle'))}"
        aria-label="${escapeHtml(t('noteForm.worldClockTitle'))}"
      >${escapeHtml(t('noteForm.worldClock'))}</button>
      <select
        name="template_theme"
        data-auto-width
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

function renderWorldClockGenerator(note) {
  if (note.type !== 'html' || note.worldClockGenerator !== true) return ''
  const selectedZones = new Set(String(note.worldClockZones ?? '').split(/[\n,]/).map((zone) => zone.trim()).filter(Boolean))
  const timeZones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
  const timeZoneGroups = Object.groupBy(timeZones, (timeZone) => timeZone.split('/')[0])
  const display = note.worldClockDisplay === 'analog' ? 'analog' : 'digital'
  const analogSize = Math.min(500, Math.max(60, parseInt(note.worldClockAnalogSize, 10) || 100))
  const topDateFormat = String(note.worldClockTopDateFormat ?? '')
  const itemDateFormat = String(note.worldClockItemDateFormat ?? '')
  return `
    <div data-world-clock-generator>
      <div data-world-clock-generator-settings>
        <div data-world-clock-date-formats>
          <label data-customizer-field>
            <span data-customizer-field-label>${escapeHtml(t('noteForm.worldClockTopDateFormat'))}</span>
            <input name="worldclock_top_date_format" type="text" value="${escapeHtml(topDateFormat)}" placeholder="{D} {M} {Y} {dayName} {monthName} {year}" data-form-state-ignore>
          </label>
          <label data-customizer-field>
            <span data-customizer-field-label>${escapeHtml(t('noteForm.worldClockItemDateFormat'))}</span>
            <input name="worldclock_item_date_format" type="text" value="${escapeHtml(itemDateFormat)}" placeholder="{D} {M} {Y} {dayName} {monthName} {year}" data-form-state-ignore>
          </label>
        </div>
        <label data-customizer-field>
          <span data-customizer-field-label data-st-white-space="nowrap">${escapeHtml(t('settings.clockDisplay'))}</span>
          <select name="worldclock_display" data-change="toggleFloatingNoteWorldClockAnalogSize" data-form-state-ignore>
            <option value="digital"${display === 'digital' ? ' selected' : ''}>${escapeHtml(t('settings.digital'))}</option>
            <option value="analog"${display === 'analog' ? ' selected' : ''}>${escapeHtml(t('settings.analog'))}</option>
          </select>
        </label>
        <label data-customizer-field data-world-clock-analog-size${display === 'analog' ? '' : ' hidden'}>
          <span data-customizer-field-label>${escapeHtml(t('noteForm.worldClockSize'))}</span>
          <input name="worldclock_analog_size" type="number" min="60" max="500" value="${analogSize}" data-form-state-ignore>
        </label>
      </div>
      <div data-world-clock-zone-filter>
        <input name="worldclock_filter" type="search" data-input="filterFloatingNoteWorldClockZones" data-form-state-ignore placeholder="${escapeHtml(t('common.search'))}" aria-label="${escapeHtml(t('common.search'))}">
      </div>
      <div data-world-clock-zones>
        ${Object.entries(timeZoneGroups).map(([region, zones]) => `
          <details data-world-clock-zone-group="${escapeHtml(region)}">
            <summary>${escapeHtml(region)} (${zones.filter((timeZone) => selectedZones.has(timeZone)).length}/${zones.length})</summary>
            <div>
              ${zones.map((timeZone) => `
                <label data-world-clock-zone-option="${escapeHtml(timeZone)}"${selectedZones.has(timeZone) ? ' data-tz-selected' : ''}>
                  <input name="worldclock_zone" type="checkbox" value="${escapeHtml(timeZone)}" data-change="syncFloatingNoteWorldClockDefaultTimezone" data-form-state-ignore${selectedZones.has(timeZone) ? ' checked' : ''}>
                  <span>${escapeHtml(timeZone.slice(region.length + 1))}</span>
                </label>
              `).join('')}
            </div>
          </details>
        `).join('')}
      </div>
      ${renderWorldClockDefaultTimezoneOptions([...selectedZones], note.worldClockDefaultTimezone)}
      <div data-world-clock-generator-actions>
        <button type="button" class="st-btn" data-btn="primary" data-click="generateFloatingNoteWorldClock" data-note-id="${escapeHtml(String(note.id ?? ''))}">${escapeHtml(t('noteForm.worldClockGenerate'))}</button>
      </div>
    </div>
  `
}

export function renderWorldClockDefaultTimezoneOptions(timeZones = [], defaultTimeZone = '') {
  const selectedZones = [...new Set(timeZones)]
  const selectedDefault = selectedZones.includes(defaultTimeZone) ? defaultTimeZone : selectedZones[0]
  return `
    <details data-world-clock-default-timezone-options data-world-clock-default-timezones${selectedDefault ? '' : ' open'}>
      <summary>
        <span data-label>${escapeHtml(t('noteForm.worldClockDefaultTimezone'))}</span>
        <span data-counter>(${selectedZones.length})</span>
        ${selectedDefault ? `<span data-default>${escapeHtml(selectedDefault)}</span>` : ''}
      </summary>
      <div data-world-clock-default-timezone-list>
        ${selectedZones.map((timeZone) => `
          <label data-world-clock-default-zone${timeZone === selectedDefault ? ' data-default' : ''}>
            <input name="worldclock_default_timezone" type="radio" value="${escapeHtml(timeZone)}" data-change="syncFloatingNoteWorldClockDefaultTimezone" data-form-state-ignore${timeZone === selectedDefault ? ' checked' : ''}>
            <span>${escapeHtml(timeZone.slice(timeZone.indexOf('/') + 1))}</span>
          </label>
        `).join('')}
      </div>
    </details>
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

function renderFloatingNoteHeaderOptions(note, actionButtons) {
  const formId = note.editMode ? `note-editor-${note.id}` : ''
  const optionAttrs = (field) => note.editMode
    ? `form="${escapeHtml(formId)}" data-change="syncFloatingNoteEditorField" data-editor-field="${field}"`
    : `data-change="saveFloatingNoteWindowOption" data-window-option="${field}"`

  return `
    <div class="st-note-editor-options" data-dropdown data-note-options-dropdown>
      <button
        type="button"
        class="st-btn"
        data-dropdown-trigger
        aria-haspopup="menu"
        aria-expanded="false"
        title="${escapeHtml(t('common.options'))}"
        aria-label="${escapeHtml(t('common.options'))}"
      ><i data-icon="stack" aria-hidden="true"></i></button>
      <div class="st-note-editor-options-panel" data-dropdown-panel data-dropdown-keep-open inert>
        <div class="st-note-header-options">
          <div data-window-actions>${actionButtons}</div>
        </div>
        <div data-customizer-divider aria-hidden="true"></div>
        <div class="st-note-internal-options">

          <div class="st-note-internal-quickset">
            <label data-customizer-field data-customizer-field-type="boolean" data-customizer-label-clickable>
              <span data-customizer-field-label>${escapeHtml(t('noteForm.hideHeader'))}</span>
              <input type="checkbox" name="note_hide_header" data-note-id="${escapeHtml(String(note.id ?? ''))}" ${optionAttrs('note_hide_header')}${note.noteHideHeader ? ' checked' : ''}>
            </label>
            <label data-customizer-field data-customizer-field-type="boolean" data-customizer-label-clickable>
              <span data-customizer-field-label>${escapeHtml(t('noteForm.removeDefaultPadding'))}</span>
              <input type="checkbox" name="note_reset_padding" data-note-id="${escapeHtml(String(note.id ?? ''))}" ${optionAttrs('note_reset_padding')}${note.noteResetPadding ? ' checked' : ''}>
            </label>
            <label data-customizer-field data-customizer-field-type="boolean" data-customizer-label-clickable>
              <span data-customizer-field-label>${escapeHtml(t('noteForm.removeBackgroundBorder'))}</span>
              <input type="checkbox" name="note_bare" data-note-id="${escapeHtml(String(note.id ?? ''))}" ${optionAttrs('note_bare')}${note.noteBare ? ' checked' : ''}>
            </label>
            <label data-customizer-field data-customizer-field-type="boolean" data-customizer-label-clickable>
              <span data-customizer-field-label>${escapeHtml(t('noteForm.nailToPosition'))}</span>
              <input type="checkbox" name="note_nailed" data-note-id="${escapeHtml(String(note.id ?? ''))}" ${optionAttrs('note_nailed')}${note.noteNailed ? ' checked' : ''}>
            </label>
            <label data-customizer-field data-customizer-field-type="boolean" data-customizer-label-clickable>
              <span data-customizer-field-label>${escapeHtml(t('noteForm.showOnAllPages'))}</span>
              <input type="checkbox" name="note_show_on_all_pages" data-note-id="${escapeHtml(String(note.id ?? ''))}" ${optionAttrs('note_show_on_all_pages')}${note.noteShowOnAllPages ? ' checked' : ''}>
            </label>
          </div>

          ${note.hasSavedLayout ? `<div data-customizer-divider aria-hidden="true"></div>
          <button
            type="button"
            data-btn="ghost"
            data-click="resetFloatingNoteWindowLayout"
            data-note-id="${escapeHtml(String(note.id ?? ''))}"
          >${escapeHtml(t('customizer.reset'))}</button>` : ''}
        </div>
      </div>
    </div>
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
        <label data-customizer-field
          data-customizer-field-type="text"
          data-st-width="100%"
          data-st-max-width="280px"
          data-st-display="block"
          data-note-editor-field>
          <span data-customizer-field-label>${escapeHtml(t('noteViewer.preview'))}</span>
          <input
            type="text"
            name="preview"
            maxlength="240"
            value="${escapeHtml(note.editPreview ?? '')}"
            data-input-immediate="syncFloatingNoteEditorField"
            data-note-id="${escapeHtml(String(note.id ?? ''))}"
            data-editor-field="preview"
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
          ${renderWorldClockGenerator(note)}
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
