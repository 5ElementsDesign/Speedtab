import {decryptNote, encryptNote, parseCryptPayload, serialiseCryptPayload} from '../../../composables/useCrypt.ts'
import {sanitizeHtml} from '../../../composables/useSanitize.ts'
import {escapeHtml} from '../../utils/html.js'
import {t} from '../../utils/i18n.js'
import {initFormDirtyState, renderFormActions} from '../forms/actions.js'
import {normalizeNoteStyleToken, parseNoteMeta} from './notes-shared.js'
import {customizerDivider, customizerField, customizerSection, passwordInput, select, textInput, textarea} from '../../ui/primitives.js'

const STYLE_OPTIONS = ['primary', 'secondary', 'success', 'warning', 'danger', 'light', 'dark']
const TYPE_OPTIONS = ['text', 'code', 'links', 'html', 'crypt']

let noteFormState = null

function buildInitialState({record = null, moduleSyncId = '', parentId = '', parentSyncId = '', parentTitle = ''}) {
  const meta = parseNoteMeta(record?.meta_json ?? null)
  return {
    record,
    moduleSyncId,
    parentId,
    parentSyncId,
    parentTitle,
    title: record?.title ?? '',
    type: record?.type ?? 'text',
    styleToken: normalizeNoteStyleToken(record?.style_token),
    content: record?.type === 'crypt' ? '' : (record?.content ?? ''),
    language: meta.language ?? 'auto',
    passphrase: '',
    confirmPassphrase: '',
    decryptPassphrase: '',
    cryptError: '',
    decrypted: false,
  }
}

export function resetNoteFormState() {
  noteFormState = null
}

export function getNoteFormState() {
  return noteFormState
}

export function initNoteFormState(context) {
  resetNoteFormState()
  noteFormState = buildInitialState(context)
  return noteFormState
}

export function syncNoteFormStateFromForm(form) {
  if (!noteFormState || !(form instanceof HTMLFormElement)) return
  noteFormState.title = form.querySelector('[name="title"]')?.value ?? ''
  noteFormState.content = form.querySelector('[name="content"]')?.value ?? ''
  noteFormState.language = form.querySelector('[name="language"]')?.value ?? 'auto'
  noteFormState.passphrase = form.querySelector('[name="passphrase"]')?.value ?? ''
  noteFormState.confirmPassphrase = form.querySelector('[name="confirm_passphrase"]')?.value ?? ''
  noteFormState.decryptPassphrase = form.querySelector('[name="decrypt_passphrase"]')?.value ?? ''
}

function renderTypeButtons(state) {
  if (state.record?.id) {
    return `
      <div data-note-form-locked-type>
        <span>${escapeHtml(t('noteForm.typeLocked'))}</span>
      </div>
    `
  }

  return `
    <div data-note-form-button-row>
      ${TYPE_OPTIONS.map((type) => `
        <button
          type="button"
          class="st-btn"
          data-btn="${state.type === type ? 'primary' : 'outline'}"
          data-click="noteFormSetType"
          data-note-type="${type}"
        >${escapeHtml(t(`noteForm.types.${type}`))}</button>
      `).join('')}
    </div>
  `
}

function renderStyleButtons(state) {
  return `
    <div data-note-form-button-row data-note-form-style-row>
      ${STYLE_OPTIONS.map((token) => `
        <button
          type="button"
          class="st-btn"
          data-btn="${token}"
          ${state.styleToken === token ? 'data-note-token-active' : ''}
          data-click="noteFormSetStyle"
          data-note-style-token="${token}"
          title="${escapeHtml(t(`noteForm.styleTokens.${token}`))}"
          aria-label="${escapeHtml(t(`noteForm.styleTokens.${token}`))}"
        >${escapeHtml(t(`noteForm.styleTokens.${token}`))}</button>
      `).join('')}
    </div>
  `
}

function renderLanguageField(state) {
  if (state.type !== 'code') return ''
  return customizerField({
    type: 'select',
    label: t('noteForm.language'),
    control: select({
      name: 'language',
      value: state.language,
      options: [
        {value: 'auto', label: t('noteForm.code.autoDetect')},
        {value: 'plaintext', label: t('noteForm.code.plaintext')},
        {value: 'html', label: 'HTML'},
        {value: 'css', label: 'CSS'},
        {value: 'javascript', label: 'JavaScript'},
        {value: 'json', label: 'JSON'},
        {value: 'markdown', label: 'Markdown'},
        {value: 'xml', label: 'XML'},
      ],
    }),
  })
}

function renderContentLabel(state) {
  if (state.type === 'links') return `${t('noteForm.contentLabels.urls')} ${t('noteForm.contentLabels.onePerLine')}`
  if (state.type === 'html') return `${t('noteForm.contentLabels.html')} ${t('noteForm.contentLabels.sanitisedOnSave')}`
  if (state.type === 'code') return t('noteForm.contentLabels.code')
  if (state.type === 'crypt') return `${t('noteForm.contentLabels.plaintext')} ${t('noteForm.contentLabels.encryptedBeforeStorage')}`
  return t('noteForm.contentLabels.content')
}

function renderCryptFields(state) {
  if (state.type !== 'crypt') return ''

  if (state.record?.id && !state.decrypted) {
    return `
      <div data-customizer-field data-customizer-field-layout="stack">
        <span data-customizer-field-label>${escapeHtml(t('noteForm.unlockToEdit'))}</span>
        <div data-note-form-unlock-row>
          ${passwordInput({
            name: 'decrypt_passphrase',
            value: state.decryptPassphrase,
            attrs: {
              autocomplete: 'off',
              spellcheck: 'false',
            },
          })}
          <button type="button" class="st-btn" data-btn="secondary" data-click="noteFormUnlock">${escapeHtml(t('noteForm.unlock'))}</button>
        </div>
      </div>
    `
  }

  return `
    <div data-note-form-crypt-grid>
      ${customizerField({
        type: 'password',
        label: t('noteForm.passphrase'),
        control: passwordInput({
          name: 'passphrase',
          value: state.passphrase,
          attrs: {
            autocomplete: 'off',
            spellcheck: 'false',
          },
        }),
      })}
      ${!state.record?.id ? `
        ${customizerField({
          type: 'password',
          label: t('noteForm.confirmPassphrase'),
          control: passwordInput({
            name: 'confirm_passphrase',
            value: state.confirmPassphrase,
            attrs: {
              autocomplete: 'off',
              spellcheck: 'false',
            },
          }),
        })}
      ` : ''}
    </div>
  `
}

function renderContentField(state) {
  const disabled = state.type === 'crypt' && state.record?.id && !state.decrypted ? ' disabled' : ''
  return customizerField({
    layout: 'stack',
    label: renderContentLabel(state),
    control: textarea({
      name: 'content',
      value: state.content,
      rows: 10,
      attrs: disabled ? {disabled: true} : {},
    }),
  })
}

function renderError(state) {
  if (!state.cryptError) return ''
  return `<p data-note-form-error>${escapeHtml(state.cryptError)}</p>`
}

export function renderNoteCrudForm(state = noteFormState) {
  if (!state) return ''
  const isLockedCryptEdit = state.type === 'crypt' && !!state.record?.id && !state.decrypted
  const saveLabel = state.record?.id ? t('noteForm.saveChanges') : t('noteForm.createNote')

  return `
    <form
      data-module-crud-form
      data-note-form
      data-submit="moduleCrudSave"
      data-entity-type="note"
      data-record-id="${escapeHtml(String(state.record?.id ?? ''))}"
      data-record-sync-id="${escapeHtml(state.record?.sync_id ?? '')}"
      data-module-sync-id="${escapeHtml(state.moduleSyncId)}"
      data-parent-id="${escapeHtml(String(state.parentId ?? ''))}"
      data-parent-sync-id="${escapeHtml(state.parentSyncId)}"
    >
      <input type="hidden" name="type" value="${escapeHtml(state.type)}">
      <input type="hidden" name="style_token" value="${escapeHtml(state.styleToken)}">

      ${renderCryptFields(state)}
      ${renderError(state)}
      ${isLockedCryptEdit ? '' : `
        ${customizerSection({
          title: t('next.moduleCrud.sections.identity'),
          section: 'identity',
          children: customizerField({
            type: 'text',
            label: t('noteForm.title'),
            control: textInput({
              name: 'title',
              value: state.title,
              attrs: {
                required: true,
                autocomplete: 'off',
              },
            }),
          }),
        })}

        ${customizerDivider()}

        ${customizerSection({
          title: t('noteForm.type'),
          section: 'type',
          children: renderTypeButtons(state),
        })}

        ${customizerDivider()}

        ${customizerSection({
          title: t('noteForm.colorScheme'),
          section: 'appearance',
          children: renderStyleButtons(state),
        })}

        ${renderLanguageField(state)}
        ${renderContentField(state)}

        ${customizerDivider()}
        ${renderFormActions({saveLabel})}
      `}
    </form>
  `
}

export function afterNoteFormRender(root) {
  const form = root?.querySelector?.('[data-note-form]')
  if (!(form instanceof HTMLFormElement)) return
  const preferredFocus = form.querySelector('[name="title"]')
    || form.querySelector('[name="decrypt_passphrase"]')
    || form.querySelector('[name="content"]')
  preferredFocus?.focus?.()
}

export function rerenderNoteForm(root) {
  if (!root || !noteFormState) return
  root.innerHTML = renderNoteCrudForm(noteFormState)
  afterNoteFormRender(root)
  initFormDirtyState(root)
}

export function setNoteFormType(type) {
  if (!noteFormState || noteFormState.record?.id) return
  noteFormState.type = TYPE_OPTIONS.includes(type) ? type : noteFormState.type
  noteFormState.language = 'auto'
  noteFormState.cryptError = ''
  noteFormState.decrypted = false
  noteFormState.passphrase = ''
  noteFormState.confirmPassphrase = ''
  noteFormState.decryptPassphrase = ''
  if (noteFormState.type === 'crypt') {
    noteFormState.content = ''
  }
}

export function setNoteFormStyle(styleToken) {
  if (!noteFormState) return
  noteFormState.styleToken = STYLE_OPTIONS.includes(styleToken)
    ? styleToken
    : noteFormState.styleToken
}

export async function unlockNoteForm(form) {
  if (!noteFormState) return false
  syncNoteFormStateFromForm(form)
  noteFormState.cryptError = ''

  try {
    const payload = parseCryptPayload(noteFormState.record?.content ?? '')
    noteFormState.content = await decryptNote(payload, noteFormState.decryptPassphrase)
    noteFormState.passphrase = noteFormState.decryptPassphrase
    noteFormState.decryptPassphrase = ''
    noteFormState.decrypted = true
    return true
  } catch {
    noteFormState.cryptError = t('noteForm.errors.wrongPassphrase')
    return false
  }
}

export async function buildNoteSavePayload(form) {
  if (!noteFormState) return null
  syncNoteFormStateFromForm(form)
  return buildNotePayload({
    title: noteFormState.title,
    type: noteFormState.type,
    content: noteFormState.content,
    styleToken: noteFormState.styleToken,
    language: noteFormState.language,
    passphrase: noteFormState.passphrase,
    confirmPassphrase: noteFormState.confirmPassphrase,
    isExistingCrypt: !!noteFormState.record?.id && noteFormState.type === 'crypt',
    isDecrypted: noteFormState.decrypted,
  }, (error) => {
    noteFormState.cryptError = error
  })
}

export async function buildNotePayload({
  title = '',
  type = 'text',
  content = '',
  styleToken = 'primary',
  language = 'auto',
  passphrase = '',
  confirmPassphrase = '',
  isExistingCrypt = false,
  isDecrypted = false,
} = {}, onError = () => {}) {
  onError('')

  const trimmedTitle = String(title).trim()
  if (!trimmedTitle) return null

  let nextContent = String(content ?? '')
  let metaJson = null

  if (type === 'html') {
    nextContent = sanitizeHtml(nextContent)
  }

  if (type === 'code') {
    metaJson = JSON.stringify({language: language || 'auto'})
  }

  if (type === 'crypt') {
    if (isExistingCrypt) {
      if (!isDecrypted || !passphrase) {
        onError(t('noteForm.errors.unlockBeforeSaving'))
        return null
      }
    } else if (!passphrase || passphrase !== confirmPassphrase) {
      onError(t('noteForm.errors.passphrasesMismatch'))
      return null
    }

    const payload = await encryptNote(nextContent, passphrase)
    nextContent = serialiseCryptPayload(payload)
  }

  return {
    title: trimmedTitle,
    type,
    content: nextContent,
    style_token: styleToken,
    meta_json: metaJson,
  }
}
