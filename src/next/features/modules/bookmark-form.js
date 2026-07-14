import fallbackFaviconUrl from '@/assets/st-favicon.ico'
import {TILE_H, TILE_W, canvasToWebpBlob, loadAssetById, loadAssetObjectUrl, loadAssetsByKinds, storeOrGetAsset} from '../../data/assets.js'
import {patchHost, readActiveFieldState, replaceNode, restoreActiveFieldState} from '../../utils/dom-patch.js'
import {customizerDivider, customizerField, customizerSection, textInput, textarea, urlInput} from '../../ui/primitives.js'
import {ensureFaviconAssetIdForUrl, initFavicons, normalizeStoredFaviconBlob} from '../../utils/favicon.js'
import {escapeHtml} from '../../utils/html.js'
import {t} from '../../utils/i18n.js'
import {extractDescription} from '../../utils/page-meta.js'
import {initFormDirtyState, renderFormActions} from '../forms/actions.js'

let bookmarkFormState = null
let cropperInstance = null
let cropperLoaderPromise = null

function revokeObjectUrl(url) {
  if (url) URL.revokeObjectURL(url)
}

function destroyCropper() {
  if (cropperInstance) {
    cropperInstance.destroy()
    cropperInstance = null
  }
}

function resetPreviewCropState(state) {
  destroyCropper()
  revokeObjectUrl(state.croppedPreviewUrl)
  state.croppedPreviewUrl = null
  state.croppedPreviewBlob = null
  state.imageDataUrl = null
  state.cropperScaleX = 1
  state.cropperScaleY = 1
}

function clearAssetLibrary(state) {
  state.faviconAssets.forEach((asset) => revokeObjectUrl(asset.objectUrl))
  state.reusableAssets.forEach((asset) => revokeObjectUrl(asset.objectUrl))
  state.faviconAssets = []
  state.reusableAssets = []
}

export function resetBookmarkFormState() {
  if (!bookmarkFormState) return
  destroyCropper()
  clearAssetLibrary(bookmarkFormState)
  revokeObjectUrl(bookmarkFormState.selectedFaviconAssetUrl)
  revokeObjectUrl(bookmarkFormState.selectedPreviewAssetUrl)
  revokeObjectUrl(bookmarkFormState.croppedPreviewUrl)
  bookmarkFormState = null
}

async function loadCropper() {
  if (!cropperLoaderPromise) {
    cropperLoaderPromise = Promise.all([
      import('cropperjs'),
      import('cropperjs/dist/cropper.css'),
    ]).then(([mod]) => mod.default)
  }
  return cropperLoaderPromise
}

function buildInitialState({record = null, moduleSyncId = '', parentId = '', parentSyncId = '', parentTitle = ''}) {
  return {
    record,
    moduleSyncId,
    parentId,
    parentSyncId,
    parentTitle,
    title: record?.title ?? '',
    url: record?.url ?? '',
    description: record?.description ?? '',
    selectedFaviconAssetId: record?.favicon_asset_id ?? null,
    selectedPreviewAssetId: record?.preview_asset_id ?? null,
    selectedFaviconAssetUrl: null,
    selectedPreviewAssetUrl: null,
    faviconAssets: [],
    reusableAssets: [],
    isFaviconPickerOpen: false,
    isPreviewPickerOpen: false,
    isTesting: false,
    testError: null,
    testSuccess: false,
    lastTestedUrl: record?.url ?? '',
    hasUnlockedFaviconPicker: !!record,
    imageDataUrl: null,
    croppedPreviewBlob: null,
    croppedPreviewUrl: null,
    cropperScaleX: 1,
    cropperScaleY: 1,
  }
}

async function hydrateSelectedUrls(state) {
  revokeObjectUrl(state.selectedFaviconAssetUrl)
  revokeObjectUrl(state.selectedPreviewAssetUrl)
  state.selectedFaviconAssetUrl = await loadAssetObjectUrl(state.selectedFaviconAssetId)
  if (!state.imageDataUrl && !state.croppedPreviewUrl) {
    state.selectedPreviewAssetUrl = await loadAssetObjectUrl(state.selectedPreviewAssetId)
  } else {
    state.selectedPreviewAssetUrl = null
  }
}

async function hydrateAssetLibrary(state) {
  clearAssetLibrary(state)
  const assets = await loadAssetsByKinds(['favicon', 'preview', 'background', 'note_image'])
  state.faviconAssets = assets
    .filter((asset) => asset.kind === 'favicon' && asset.id != null)
    .map((asset) => ({...asset, objectUrl: URL.createObjectURL(asset.blob)}))
  state.reusableAssets = assets
    .filter((asset) => ['preview', 'background', 'note_image'].includes(asset.kind) && asset.id != null)
    .map((asset) => ({...asset, objectUrl: URL.createObjectURL(asset.blob)}))
}

export async function initBookmarkFormState(context) {
  resetBookmarkFormState()
  bookmarkFormState = buildInitialState(context)
  await hydrateSelectedUrls(bookmarkFormState)
  await hydrateAssetLibrary(bookmarkFormState)
  return bookmarkFormState
}

export function getBookmarkFormState() {
  return bookmarkFormState
}

export function syncBookmarkFormStateFromForm(form) {
  if (!bookmarkFormState || !form) return
  bookmarkFormState.title = form.querySelector('[name="title"]')?.value ?? ''
  bookmarkFormState.url = form.querySelector('[name="url"]')?.value ?? ''
  bookmarkFormState.description = form.querySelector('[name="description"]')?.value ?? ''
}

function renderFaviconPreview(state) {
  if (state.selectedFaviconAssetUrl) {
    return `<img src="${escapeHtml(state.selectedFaviconAssetUrl)}" alt="${escapeHtml(t('tabForm.faviconPreviewAlt'))}" class="st-bookmark-form-favicon-preview" draggable="false">`
  }
  if (!state.url) {
    return `<img src="${escapeHtml(fallbackFaviconUrl)}" alt="${escapeHtml(t('tabForm.faviconPreviewAlt'))}" class="st-bookmark-form-favicon-preview" draggable="false">`
  }
  return `<img data-favicon-url="${escapeHtml(state.url)}" alt="${escapeHtml(t('tabForm.faviconPreviewAlt'))}" class="st-bookmark-form-favicon-preview" draggable="false">`
}

function renderFaviconPicker(state) {
  if (!state.isFaviconPickerOpen) return ''
  const assetTiles = state.faviconAssets.length
    ? `<div data-bookmark-form-favicon-grid>${state.faviconAssets.map((asset) => `
        <button
          type="button"
          data-click="bookmarkFormSelectFaviconAsset"
          data-asset-id="${escapeHtml(String(asset.id))}"
          data-bookmark-favicon-tile
        >
          <img src="${escapeHtml(asset.objectUrl)}" alt="${escapeHtml(t('tabForm.faviconAssetAlt'))}">
        </button>
      `).join('')}</div>`
    : `<p data-bookmark-form-hint>${escapeHtml(t('tabForm.noFaviconAssets'))}</p>`

  return `
    <div data-bookmark-form-picker>
      <section data-bookmark-form-picker-section>
        <h4 data-bookmark-form-picker-title>${escapeHtml(t('tabForm.favicons'))}</h4>
        ${assetTiles}
      </section>
      <section data-bookmark-form-picker-section data-bookmark-form-picker-actions>
        <button type="button" data-btn="ghost" data-click="bookmarkFormTriggerFaviconUpload" data-bookmark-form-picker-btn>${escapeHtml(t('tabForm.upload'))}</button>
        <button type="button" data-btn="ghost" data-click="bookmarkFormClearFavicon" data-bookmark-form-picker-btn>${escapeHtml(t('tabForm.clear'))}</button>
        <button type="button" data-btn="ghost" data-click="bookmarkFormToggleFaviconPicker" data-bookmark-form-picker-btn>${escapeHtml(t('common.close'))}</button>
        <input type="file" accept="image/*" hidden data-bookmark-favicon-file data-change="bookmarkFormFaviconFileChange">
      </section>
    </div>
  `
}

function renderFaviconField(state) {
  const status = getUrlStatusLine(state)
  const hasUrl = state.url.trim().length > 0

  return `
    <div data-bookmark-form-favicon-wrap>
      <div data-bookmark-form-url-row>
        <button
          type="button"
          data-click="bookmarkFormToggleFaviconPicker"
          data-bookmark-form-favicon-btn
          ${state.hasUnlockedFaviconPicker ? '' : 'disabled '}
          title="${escapeHtml(state.hasUnlockedFaviconPicker ? t('tabForm.faviconPickerTitle') : t('tabForm.faviconPickerLockedTitle'))}"
        >${renderFaviconPreview(state)}</button>
        ${urlInput({
          name: 'url',
          value: state.url,
          attrs: {
            placeholder: t('tabForm.urlPlaceholder'),
            required: true,
            autocomplete: 'off',
            spellcheck: 'false',
          },
        })}
        <button type="button" class="${state.isTesting ? 'yai-loading' : ''}" data-click="bookmarkFormTestUrl" data-bookmark-form-test-btn title="${escapeHtml(t('tabForm.faviconPickerLockedTitle'))}" ${state.isTesting || !hasUrl ? 'disabled ' : ''}>${escapeHtml(state.isTesting ? t('tabForm.testing') : t('tabForm.test'))}</button>
      </div>
      ${renderFaviconPicker(state)}
      <p data-bookmark-form-status data-variant="${escapeHtml(status.variant)}">${escapeHtml(status.text)}</p>
    </div>
  `
}

function renderPreviewSelection(state) {
  const currentPreviewUrl = state.croppedPreviewUrl || state.selectedPreviewAssetUrl
  if (currentPreviewUrl) {
    return `
      <div data-bookmark-form-current-preview>
        <img src="${escapeHtml(currentPreviewUrl)}" style="width:${TILE_W}px;height:${TILE_H}px;" alt="${escapeHtml(t('tabForm.previewAlt'))}">
        <button type="button" data-click="bookmarkFormClearPreview" data-bookmark-form-link-btn>${escapeHtml(t('tabForm.remove'))}</button>
      </div>
    `
  }

  if (state.imageDataUrl) {
    return `
      <div data-bookmark-form-cropper-wrap>
        <div data-bookmark-form-cropper-stage>
          <img src="${escapeHtml(state.imageDataUrl)}" alt="${escapeHtml(t('tabForm.cropSourceAlt'))}" data-bookmark-cropper-image>
        </div>
        <div data-bookmark-form-cropper-controls>
          <button type="button" data-btn="ghost" data-click="bookmarkFormCropZoomIn" data-bookmark-form-crop-btn>${escapeHtml(t('tabForm.zoomIn'))}</button>
          <button type="button" data-btn="ghost" data-click="bookmarkFormCropZoomOut" data-bookmark-form-crop-btn>${escapeHtml(t('tabForm.zoomOut'))}</button>
          <button type="button" data-btn="ghost" data-click="bookmarkFormCropMoveLeft" data-bookmark-form-crop-btn>${escapeHtml(t('tabForm.moveLeft'))}</button>
          <button type="button" data-btn="ghost" data-click="bookmarkFormCropMoveRight" data-bookmark-form-crop-btn>${escapeHtml(t('tabForm.moveRight'))}</button>
          <button type="button" data-btn="ghost" data-click="bookmarkFormCropMoveUp" data-bookmark-form-crop-btn>${escapeHtml(t('tabForm.moveUp'))}</button>
          <button type="button" data-btn="ghost" data-click="bookmarkFormCropMoveDown" data-bookmark-form-crop-btn>${escapeHtml(t('tabForm.moveDown'))}</button>
          <button type="button" data-btn="ghost" data-click="bookmarkFormCropFlipX" data-bookmark-form-crop-btn>${escapeHtml(t('tabForm.flipX'))}</button>
          <button type="button" data-btn="ghost" data-click="bookmarkFormCropFlipY" data-bookmark-form-crop-btn>${escapeHtml(t('tabForm.flipY'))}</button>
        </div>
        <div data-bookmark-form-crop-actions>
          <button type="button" data-click="bookmarkFormApplyCrop" data-btn="primary" title="${escapeHtml(t('tabForm.cropBeforeSaving'))}">${escapeHtml(t('tabForm.applyCrop', {width: TILE_W, height: TILE_H}))}</button>
          <button type="button" data-click="bookmarkFormClearPreview" data-btn="ghost" data-bookmark-form-link-btn>${escapeHtml(t('common.cancel'))}</button>
        </div>
      </div>
    `
  }

  const groups = [
    {kind: 'preview', label: t('tabForm.assetGroups.preview')},
    {kind: 'background', label: t('tabForm.assetGroups.background')},
    {kind: 'note_image', label: t('tabForm.assetGroups.noteImage')},
  ]

  const picker = state.isPreviewPickerOpen
    ? `<div data-bookmark-form-picker>${groups.map((group) => {
        const items = state.reusableAssets.filter((asset) => asset.kind === group.kind)
        if (!items.length) return ''
        return `
          <section data-bookmark-form-picker-section>
            <h4 data-bookmark-form-picker-title>${escapeHtml(group.label)}</h4>
            <div data-bookmark-form-preview-grid>
              ${items.map((asset) => `
                <button type="button" data-click="bookmarkFormSelectPreviewAsset" data-asset-id="${escapeHtml(String(asset.id))}" data-bookmark-preview-tile>
                  <img src="${escapeHtml(asset.objectUrl)}" alt="${escapeHtml(group.label)}">
                </button>
              `).join('')}
            </div>
          </section>
        `
      }).join('')}
      <section data-bookmark-form-picker-section data-bookmark-form-picker-actions>
        <button type="button" data-click="bookmarkFormTogglePreviewPicker" data-bookmark-form-picker-btn>${escapeHtml(t('common.close'))}</button>
      </section></div>`
    : ''

  return `
    <div data-bookmark-form-preview-empty>
      <input type="file" accept="image/*" hidden data-bookmark-preview-file data-change="bookmarkFormPreviewFileChange">
      <div data-bookmark-form-preview-buttons>
        <button type="button" data-click="bookmarkFormTriggerPreviewUpload" data-bookmark-form-upload-btn title="${escapeHtml(t('tabForm.uploadScreenshot'))}">${escapeHtml(t('tabForm.uploadImageSource'))}</button>
        <button type="button" data-click="bookmarkFormTogglePreviewPicker" data-bookmark-form-picker-btn title="${escapeHtml(t('tabForm.pickAssetTitle'))}">${escapeHtml(t('tabForm.pickAsset'))}</button>
      </div>
      ${picker}
    </div>
  `
}

function getUrlStatusLine(state) {
  if (state.testError) return {text: state.testError, variant: 'error'}
  if (state.testSuccess) return {text: t('tabForm.statuses.reachable'), variant: 'success'}
  return {text: t('tabForm.statuses.clickToTest'), variant: 'idle'}
}

function buildBookmarkPreviewStateToken(state) {
  return [
    state.selectedPreviewAssetId ?? 'none',
    state.selectedPreviewAssetUrl ? 'asset' : 'no-asset',
    state.imageDataUrl ? 'upload' : 'no-upload',
    state.croppedPreviewBlob ? 'cropped' : 'not-cropped',
  ].join(':')
}

function buildBookmarkFaviconStateToken(state) {
  return [
    state.selectedFaviconAssetId ?? 'none',
    state.selectedFaviconAssetUrl ? 'asset' : 'no-asset',
    state.hasUnlockedFaviconPicker ? 'unlocked' : 'locked',
  ].join(':')
}

export function renderBookmarkCrudForm(state) {
  return `
    <form
      data-module-crud-form
      ${state.imageDataUrl ? 'data-bookmark-crop-active ' : ''}
      data-submit="moduleCrudSave"
      data-entity-type="bookmark"
      data-record-id="${escapeHtml(String(state.record?.id ?? ''))}"
      data-record-sync-id="${escapeHtml(state.record?.sync_id ?? '')}"
      data-module-sync-id="${escapeHtml(state.moduleSyncId)}"
      data-parent-id="${escapeHtml(String(state.parentId ?? ''))}"
      data-parent-sync-id="${escapeHtml(state.parentSyncId ?? '')}"
    >
      <input type="hidden" name="preview-state-token" value="${escapeHtml(buildBookmarkPreviewStateToken(state))}">
      <input type="hidden" name="favicon-state-token" value="${escapeHtml(buildBookmarkFaviconStateToken(state))}">

      ${customizerSection({
        title: t('moduleCrud.sections.identity'),
        section: 'identity',
        children: `
          <div data-customizer-field data-customizer-field-layout="stack">
            <span data-customizer-field-label>${escapeHtml(t('tabForm.url'))}</span>
            ${renderFaviconField(state)}
          </div>

          ${customizerField({
            type: 'text',
            label: t('tabForm.title'),
            control: textInput({
              name: 'title',
              value: state.title,
              attrs: {
                placeholder: t('tabForm.titlePlaceholder'),
                autocomplete: 'off',
              },
            }),
          })}

          ${customizerField({
            layout: 'stack',
            label: t('moduleCrud.fields.description'),
            control: textarea({
              name: 'description',
              value: state.description,
              rows: 4,
            }),
          })}
        `,
      })}

      ${customizerDivider()}

      ${customizerSection({
        title: t('tabForm.previewImage'),
        section: 'preview',
        children: `<div data-bookmark-form-preview-wrap>${renderPreviewSelection(state)}</div>`,
      }).replace('<p data-customizer-section-title>', `<p data-customizer-section-title title="${escapeHtml(t('tabForm.previewImageMeta', {width: TILE_W, height: TILE_H}))}">`)}

      ${customizerDivider()}

      ${renderFormActions()}
    </form>
  `
}

async function createImageDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => resolve(event.target?.result ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function afterBookmarkFormRender(body) {
  await afterBookmarkFormRenderWithOptions(body)
}

async function afterBookmarkFormRenderWithOptions(body, {autoFocus = true} = {}) {
  if (!bookmarkFormState || !body) return
  initFavicons(body)
  if (autoFocus && !bookmarkFormState.record) {
    const urlInput = body.querySelector('input[name="url"]')
    if (urlInput instanceof HTMLInputElement) {
      requestAnimationFrame(() => urlInput.focus())
    }
  }
  destroyCropper()
  if (!bookmarkFormState.imageDataUrl) return
  const img = body.querySelector('[data-bookmark-cropper-image]')
  if (!img) return
  const Cropper = await loadCropper()
  cropperInstance = new Cropper(img, {
    aspectRatio: TILE_W / TILE_H,
    viewMode: 1,
    autoCropArea: 1,
    movable: true,
    zoomable: true,
    rotatable: false,
    scalable: true,
  })
}

export async function rerenderBookmarkForm(body) {
  if (!bookmarkFormState || !body) return
  await hydrateSelectedUrls(bookmarkFormState)
  await hydrateAssetLibrary(bookmarkFormState)
  const currentForm = body.matches?.('[data-module-crud-form]') ? body : body.querySelector?.('[data-module-crud-form]')
  const activeState = readActiveFieldState()

  if (currentForm instanceof HTMLFormElement) {
    replaceNode(currentForm, renderBookmarkCrudForm(bookmarkFormState))
  } else {
    body.innerHTML = renderBookmarkCrudForm(bookmarkFormState)
  }

  await afterBookmarkFormRenderWithOptions(body, {autoFocus: false})
  initFormDirtyState(body, {useExistingBaseline: true})
  const form = body.matches?.('[data-module-crud-form]') ? body : body.querySelector?.('[data-module-crud-form]')
  if (form instanceof HTMLElement) {
    restoreActiveFieldState(form, activeState)
  }
}

export async function patchBookmarkForm(body) {
  if (!bookmarkFormState || !body) return
  await hydrateSelectedUrls(bookmarkFormState)
  await hydrateAssetLibrary(bookmarkFormState)

  const form = body.matches?.('[data-module-crud-form]') ? body : body.querySelector?.('[data-module-crud-form]')
  if (!(form instanceof HTMLFormElement)) {
    await rerenderBookmarkForm(body)
    return
  }

  const activeState = readActiveFieldState()

  const urlInputEl = form.querySelector('[name="url"]')
  if (urlInputEl instanceof HTMLInputElement && urlInputEl !== document.activeElement) {
    urlInputEl.value = bookmarkFormState.url
  }

  const titleInputEl = form.querySelector('[name="title"]')
  if (titleInputEl instanceof HTMLInputElement && titleInputEl !== document.activeElement) {
    titleInputEl.value = bookmarkFormState.title
  }

  const descriptionInputEl = form.querySelector('[name="description"]')
  if (descriptionInputEl instanceof HTMLTextAreaElement && descriptionInputEl !== document.activeElement) {
    descriptionInputEl.value = bookmarkFormState.description
  }

  const previewToken = form.querySelector('[name="preview-state-token"]')
  if (previewToken instanceof HTMLInputElement) {
    previewToken.value = buildBookmarkPreviewStateToken(bookmarkFormState)
  }

  const faviconToken = form.querySelector('[name="favicon-state-token"]')
  if (faviconToken instanceof HTMLInputElement) {
    faviconToken.value = buildBookmarkFaviconStateToken(bookmarkFormState)
  }

  const faviconWrap = form.querySelector('[data-bookmark-form-favicon-wrap]')
  if (faviconWrap instanceof HTMLElement) {
    patchHost(faviconWrap, renderFaviconField(bookmarkFormState))
  }

  const previewWrap = form.querySelector('[data-bookmark-form-preview-wrap]')
  if (previewWrap instanceof HTMLElement) {
    patchHost(previewWrap, `<div data-bookmark-form-preview-wrap>${renderPreviewSelection(bookmarkFormState)}</div>`)
  }

  form.toggleAttribute('data-bookmark-crop-active', Boolean(bookmarkFormState.imageDataUrl))

  await afterBookmarkFormRenderWithOptions(body, {autoFocus: false})
  initFormDirtyState(body, {useExistingBaseline: true})
  restoreActiveFieldState(form, activeState)
}

async function fetchUrlMetaDirect(url) {
  const response = await fetch(url, {redirect: 'follow'})
  if (!response.ok) return {ok: false, error: `HTTP ${response.status}: ${response.statusText}`}
  const contentType = response.headers.get('content-type') ?? ''
  const finalUrl = response.url || url
  if (!contentType.includes('text/html')) {
    return {ok: true, title: null, description: null, finalUrl}
  }
  const html = await response.text()
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const description = extractDescription(html)
  return {
    ok: true,
    finalUrl,
    title: titleMatch?.[1]?.replace(/\s+/g, ' ').trim() || null,
    description,
  }
}

export async function testBookmarkUrl() {
  const state = bookmarkFormState
  if (!state?.url) return

  state.testError = null
  state.testSuccess = false

  let normalizedUrl
  try {
    normalizedUrl = new URL(state.url).toString()
  } catch {
    state.testError = t('tabForm.statuses.invalidUrl')
    return
  }

  state.isTesting = true
  try {
    const backgroundResponse = await chrome.runtime.sendMessage({type: 'FETCH_URL_META', url: normalizedUrl})
    let response = backgroundResponse && typeof backgroundResponse.ok === 'boolean'
      ? backgroundResponse
      : await fetchUrlMetaDirect(normalizedUrl)

    if (response.ok && (!response.title || !response.description)) {
      const fallbackResponse = await fetchUrlMetaDirect(normalizedUrl)
      if (fallbackResponse.ok) {
        response = {
          ...response,
          title: response.title || fallbackResponse.title || null,
          description: response.description || fallbackResponse.description || null,
          finalUrl: response.finalUrl || fallbackResponse.finalUrl || normalizedUrl,
        }
      }
    }

    if (!response.ok) throw new Error(response.error || t('tabForm.statuses.failedToReach'))

    state.url = normalizedUrl
    if (!state.title.trim() && response.title) {
      state.title = response.title
    }
    if (!state.description.trim() && response.description) {
      state.description = response.description
    }
    state.selectedFaviconAssetId = await ensureFaviconAssetIdForUrl(normalizedUrl)
    state.hasUnlockedFaviconPicker = true
    state.testSuccess = true
    state.lastTestedUrl = normalizedUrl
    await hydrateSelectedUrls(state)
  } catch (error) {
    state.testError = error instanceof Error ? error.message : t('tabForm.statuses.failedToTest')
  } finally {
    state.isTesting = false
  }
}

async function normalizeFaviconBlob(blob) {
  const normalized = await normalizeStoredFaviconBlob(blob)
  return normalized
}

export async function uploadBookmarkFavicon(file) {
  const state = bookmarkFormState
  if (!state || !file) return
  const normalized = await normalizeFaviconBlob(file)
  state.selectedFaviconAssetId = await storeOrGetAsset(normalized.blob, 'favicon', normalized.width, normalized.height)
  state.isFaviconPickerOpen = false
  await hydrateSelectedUrls(state)
  await hydrateAssetLibrary(state)
}

export async function selectBookmarkFaviconAsset(assetId) {
  const state = bookmarkFormState
  if (!state || !assetId) return
  state.selectedFaviconAssetId = Number(assetId)
  state.isFaviconPickerOpen = false
  await hydrateSelectedUrls(state)
}

export async function clearBookmarkFavicon() {
  const state = bookmarkFormState
  if (!state) return
  state.selectedFaviconAssetId = null
  revokeObjectUrl(state.selectedFaviconAssetUrl)
  state.selectedFaviconAssetUrl = null
  state.isFaviconPickerOpen = false
}

export function toggleBookmarkFaviconPicker() {
  if (!bookmarkFormState?.hasUnlockedFaviconPicker) return
  bookmarkFormState.isFaviconPickerOpen = !bookmarkFormState.isFaviconPickerOpen
}

export function toggleBookmarkPreviewPicker() {
  if (!bookmarkFormState) return
  bookmarkFormState.isPreviewPickerOpen = !bookmarkFormState.isPreviewPickerOpen
}

export async function uploadBookmarkPreview(file) {
  const state = bookmarkFormState
  if (!state || !file) return
  resetPreviewCropState(state)
  revokeObjectUrl(state.selectedPreviewAssetUrl)
  state.selectedPreviewAssetUrl = null
  state.selectedPreviewAssetId = null
  state.imageDataUrl = await createImageDataUrl(file)
  state.isPreviewPickerOpen = false
}

export async function selectBookmarkPreviewAsset(assetId) {
  const state = bookmarkFormState
  if (!state || !assetId) return
  const asset = await loadAssetById(Number(assetId))
  if (!asset) return
  resetPreviewCropState(state)
  revokeObjectUrl(state.selectedPreviewAssetUrl)
  state.selectedPreviewAssetUrl = null
  state.selectedPreviewAssetId = null

  if (asset.kind === 'background') {
    state.imageDataUrl = await createImageDataUrl(asset.blob)
  } else {
    state.selectedPreviewAssetId = asset.id ?? null
    state.selectedPreviewAssetUrl = asset.id ? await loadAssetObjectUrl(asset.id) : null
  }

  state.isPreviewPickerOpen = false
}

export function clearBookmarkPreview() {
  const state = bookmarkFormState
  if (!state) return
  resetPreviewCropState(state)
  revokeObjectUrl(state.selectedPreviewAssetUrl)
  state.selectedPreviewAssetUrl = null
  state.selectedPreviewAssetId = null
  state.isPreviewPickerOpen = false
}

export async function applyBookmarkPreviewCrop() {
  const state = bookmarkFormState
  if (!state || !cropperInstance) return
  const canvas = cropperInstance.getCroppedCanvas({width: TILE_W, height: TILE_H})
  const blob = await canvasToWebpBlob(canvas)
  resetPreviewCropState(state)
  state.croppedPreviewBlob = blob
  state.croppedPreviewUrl = URL.createObjectURL(blob)
}

export function bookmarkCropZoom(delta) {
  cropperInstance?.zoom(delta)
}

export function bookmarkCropMove(offsetX, offsetY) {
  cropperInstance?.move(offsetX, offsetY)
}

export function bookmarkCropFlipX() {
  const state = bookmarkFormState
  if (!state || !cropperInstance) return
  state.cropperScaleX *= -1
  cropperInstance.scaleX(state.cropperScaleX)
}

export function bookmarkCropFlipY() {
  const state = bookmarkFormState
  if (!state || !cropperInstance) return
  state.cropperScaleY *= -1
  cropperInstance.scaleY(state.cropperScaleY)
}

export async function buildBookmarkSavePayload(form) {
  const state = bookmarkFormState
  if (!state) return null
  syncBookmarkFormStateFromForm(form)

  let previewAssetId = state.selectedPreviewAssetId
  if (state.croppedPreviewBlob) {
    previewAssetId = await storeOrGetAsset(state.croppedPreviewBlob, 'preview', TILE_W, TILE_H)
  }

  let faviconAssetId = state.selectedFaviconAssetId
  if (!faviconAssetId && state.url) {
    faviconAssetId = await ensureFaviconAssetIdForUrl(state.url)
  }

  let displayTitle = state.title.trim()
  if (!displayTitle) {
    try {
      displayTitle = new URL(state.url).hostname
    } catch {
      displayTitle = state.url
    }
  }

  return {
    title: displayTitle,
    url: state.url.trim(),
    description: state.description.trim() || null,
    favicon_asset_id: faviconAssetId,
    preview_asset_id: previewAssetId,
  }
}
