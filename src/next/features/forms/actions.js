import {escapeHtml} from '../../utils/html.js'
import {t} from '../../utils/i18n.js'

export function renderFormActions({saveLabel = t('moduleForm.saveChanges')} = {}) {
  return `
    <div data-form-actions>
      <button type="submit" data-btn="primary" data-form-save-btn disabled>${escapeHtml(saveLabel)}</button>
    </div>
  `
}

export function renderSidepanelDeleteFooter({action, label, attrs = {}} = {}) {
  if (!action || !label) return ''

  const attrString = Object.entries(attrs)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key}="${escapeHtml(String(value))}"`)
    .join(' ')

  return `
    <div data-sidepanel-action-footer>
      <button type="button" data-btn="danger" data-click="${escapeHtml(action)}"${attrString ? ` ${attrString}` : ''}>${escapeHtml(label)}</button>
    </div>
  `
}

function serializeFormValue(field) {
  if (field instanceof HTMLInputElement) {
    if (field.type === 'checkbox') return field.checked
    if (field.type === 'radio') return field.checked ? field.value : null
    return field.value
  }
  if (field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
    return field.value
  }
  return ''
}

function getTrackedFields(form) {
  return [...form.querySelectorAll('input[name], select[name], textarea[name]')]
    .filter((field) => !field.disabled && !field.hasAttribute('data-form-state-ignore'))
}

function pushFormValue(bucket, value) {
  if (value === null || value === undefined) return bucket
  if (bucket === undefined) return value
  return Array.isArray(bucket) ? [...bucket, value] : [bucket, value]
}

function buildFormObject(form) {
  return getTrackedFields(form).reduce((acc, field) => {
    const name = field.getAttribute('name')
    if (!name) return acc
    const value = serializeFormValue(field)
    if (field instanceof HTMLInputElement && field.type === 'radio' && value === null) return acc
    acc[name] = pushFormValue(acc[name], value)
    return acc
  }, {})
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function fnv1aHash(input) {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `h${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export function hashFormState(form) {
  if (!(form instanceof HTMLFormElement)) return ''
  return fnv1aHash(stableStringify(buildFormObject(form)))
}

export function stringifyFormState(form) {
  if (!(form instanceof HTMLFormElement)) return ''
  return stableStringify(buildFormObject(form))
}

function getFormStateKey(form) {
  if (!(form instanceof HTMLFormElement)) return ''
  if (form.dataset.formStateKey) return form.dataset.formStateKey

  if (form.matches('[data-page-form]')) {
    return `page:${form.dataset.pageSyncId || form.dataset.pageId || 'new'}`
  }

  if (form.matches('[data-module-crud-form]')) {
    const entityType = form.dataset.entityType || 'unknown'
    const recordSyncId = form.dataset.recordSyncId || form.dataset.recordId || 'new'
    const moduleSyncId = form.dataset.moduleSyncId || 'module'
    const parentSyncId = form.dataset.parentSyncId || form.dataset.parentId || 'parent'
    return `crud:${entityType}:${moduleSyncId}:${parentSyncId}:${recordSyncId}`
  }

  return form.getAttribute('data-submit') || 'form'
}

function getFormStateHost(form) {
  return form.closest('[data-sidepanel]') || form
}

function readFormStateStore(host) {
  const raw = host?.getAttribute?.('data-form-state-store') || ''
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeFormStateStore(host, store) {
  host?.setAttribute?.('data-form-state-store', JSON.stringify(store))
}

function updateBookmarkFormActionState(form) {
  const urlInput = form.querySelector('input[name="url"]')
  const testButton = form.querySelector('[data-bookmark-form-test-btn]')
  if (!(urlInput instanceof HTMLInputElement) || !(testButton instanceof HTMLButtonElement)) return
  const isTesting = testButton.textContent?.trim() === '...'
  testButton.disabled = isTesting || urlInput.value.trim().length === 0
}

function updateFeedFormActionState(form, saveButton) {
  if (!(form instanceof HTMLFormElement) || !(saveButton instanceof HTMLButtonElement)) return
  if (!form.matches('[data-feed-form]')) return

  const feedUrlInput = form.querySelector('input[name="feed_url"]')
  const testButton = form.querySelector('[data-feed-form-test-btn]')
  const lookupButton = form.querySelector('[data-feed-form-lookup-btn]')
  const siteUrlInput = form.querySelector('input[name="site_url"]')
  const lastTestedUrl = form.dataset.feedLastTestedUrl || ''
  const testSuccess = form.dataset.feedTestSuccess === 'true'
  const currentUrl = feedUrlInput instanceof HTMLInputElement ? feedUrlInput.value.trim() : ''
  const testedMatchesCurrent = currentUrl && currentUrl === lastTestedUrl

  if (testButton instanceof HTMLButtonElement) {
    const isTesting = testButton.textContent?.trim() === '...'
    testButton.disabled = isTesting || currentUrl.length === 0
  }

  if (lookupButton instanceof HTMLButtonElement) {
    const isLookingUp = lookupButton.textContent?.trim() === '...'
    const siteValue = siteUrlInput instanceof HTMLInputElement ? siteUrlInput.value.trim() : ''
    lookupButton.disabled = isLookingUp || siteValue.length === 0
  }

  if (!testSuccess || !testedMatchesCurrent) {
    saveButton.disabled = true
  }
}

export function updateFormDirtyState(form) {
  if (!(form instanceof HTMLFormElement)) return
  const saveButton = form.querySelector('[data-form-save-btn]')
    || (form.id ? document.querySelector(`[data-form-save-btn][form="${CSS.escape(form.id)}"]`) : null)
  if (!(saveButton instanceof HTMLButtonElement)) return
  const stateKey = getFormStateKey(form)
  const host = getFormStateHost(form)
  const store = readFormStateStore(host)
  const entry = store[stateKey] ?? {}
  const initialHash = entry.initialHash ?? ''
  const currentHash = hashFormState(form)
  const currentState = stringifyFormState(form)
  const isDirty = currentHash !== initialHash
  const isValid = form.checkValidity()
  store[stateKey] = {
    ...entry,
    currentHash,
    currentState,
  }
  writeFormStateStore(host, store)
  form.dataset.formHashCurrent = currentHash
  form.toggleAttribute('data-form-invalid', !isValid)
  saveButton.disabled = !isDirty || !isValid
  updateBookmarkFormActionState(form)
  updateFeedFormActionState(form, saveButton)
}

export function initFormDirtyState(root, options = {}) {
  const forms = root instanceof HTMLFormElement
    ? [root]
    : [...(root?.querySelectorAll?.('form[data-submit]') ?? [])]

  forms.forEach((form) => {
    if (!(form instanceof HTMLFormElement)) return
    const stateKey = getFormStateKey(form)
    const host = getFormStateHost(form)
    const store = readFormStateStore(host)
    const currentState = stringifyFormState(form)
    const currentHash = hashFormState(form)
    const existingEntry = store[stateKey]
    const initialState = options.initialState
      ?? existingEntry?.initialState
      ?? currentState
    const initialHash = options.initialHash
      ?? existingEntry?.initialHash
      ?? currentHash

    store[stateKey] = {
      initialState,
      initialHash,
      currentState,
      currentHash,
    }
    writeFormStateStore(host, store)
    form.dataset.formStateKey = stateKey
    form.dataset.formHashInitial = initialHash
    form.dataset.formHashCurrent = currentHash
    updateFormDirtyState(form)
  })
}
