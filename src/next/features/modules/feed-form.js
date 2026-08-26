import {useFeed} from '../../../composables/useFeed.ts'
import {escapeHtml} from '../../utils/html.js'
import {t} from '../../utils/i18n.js'
import {renderFormActions} from '../forms/actions.js'
import {updateFormDirtyState} from '../forms/actions.js'
import {customizerDivider, customizerField, customizerSection, textInput, urlInput} from '../../ui/primitives.js'

const feedApi = useFeed()

let feedFormState = null

function normalizeDiscoveredFeeds(urls = []) {
  const seen = new Set()
  return urls.filter((entry) => {
    if (!entry?.url || seen.has(entry.url)) return false
    seen.add(entry.url)
    return true
  })
}

function deriveLookupBaseUrl(url) {
  try {
    const parsed = new URL(String(url).trim())
    return `${parsed.origin}/`
  } catch {
    return String(url).trim()
  }
}

function isLikelyFeedUrl(url) {
  return /(feedburner|rss|atom|feed|xml)/i.test(url)
}

function pushDiscoveredFeed(candidates, href, baseUrl, title) {
  try {
    const absoluteUrl = new URL(href, baseUrl).toString()
    if (!isLikelyFeedUrl(absoluteUrl)) return
    candidates.push({
      url: absoluteUrl,
      title: String(title || '').trim() || absoluteUrl,
    })
  } catch {
    // Ignore malformed discovered URLs.
  }
}

function discoverFeedCandidates(html, baseUrl) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const declaredCandidates = []
  const linkedCandidates = []
  const guessedCandidates = []

  doc.querySelectorAll('link[rel~="alternate"]').forEach((node) => {
    const href = node.getAttribute('href')
    const type = (node.getAttribute('type') ?? '').toLowerCase()
    if (!href || !/(rss|atom|xml)/.test(type)) return
    pushDiscoveredFeed(
      declaredCandidates,
      href,
      baseUrl,
      node.getAttribute('title')?.trim() || href,
    )
  })

  doc.querySelectorAll('a[href]').forEach((node) => {
    const href = node.getAttribute('href')
    if (!href) return
    const label = node.textContent?.replace(/\s+/g, ' ').trim()
      || node.getAttribute('title')
      || href
    pushDiscoveredFeed(linkedCandidates, href, baseUrl, label)
  })

  try {
    const base = new URL(baseUrl)
    const commonPaths = ['/feed', '/feed.xml', '/rss', '/rss.xml', '/atom.xml']
    for (const path of commonPaths) {
      guessedCandidates.push({
        url: new URL(path, `${base.origin}/`).toString(),
        title: path.replace(/^\//, ''),
      })
    }
  } catch {
    // Ignore malformed input URL.
  }

  const realCandidates = normalizeDiscoveredFeeds([
    ...declaredCandidates,
    ...linkedCandidates,
  ])

  if (realCandidates.length > 0) {
    return realCandidates
  }

  return normalizeDiscoveredFeeds(guessedCandidates)
}

function buildInitialState({record = null, moduleSyncId = '', parentId = '', parentSyncId = '', parentTitle = ''}) {
  const existingFeedUrl = record?.feed_url || ''
  return {
    record,
    moduleSyncId,
    parentId,
    parentSyncId,
    parentTitle,
    title: record?.title || '',
    feedUrl: record?.feed_url || '',
    siteUrl: record?.site_url || '',
    discoveredFeeds: [],
    lookupStatus: null,
    isTesting: false,
    isLookingUp: false,
    testError: null,
    testSuccess: !!existingFeedUrl,
    lastTestedUrl: existingFeedUrl,
  }
}

function normalizeTestedUrl(url) {
  try {
    return new URL(String(url).trim()).toString()
  } catch {
    return String(url).trim()
  }
}

function canSave(state) {
  return !!state?.title
    && !!state?.feedUrl
    && state.testSuccess === true
    && normalizeTestedUrl(state.feedUrl) === state.lastTestedUrl
}

export function resetFeedFormState() {
  feedFormState = null
}

export function initFeedFormState(context) {
  resetFeedFormState()
  feedFormState = buildInitialState(context)
  return feedFormState
}

export function getFeedFormState() {
  return feedFormState
}

export function syncFeedFormStateFromForm(form) {
  if (!feedFormState || !(form instanceof HTMLFormElement)) return

  const prevFeedUrl = feedFormState.feedUrl
  const prevSiteUrl = feedFormState.siteUrl

  feedFormState.title = form.querySelector('[name="title"]')?.value ?? ''
  feedFormState.feedUrl = form.querySelector('[name="feed_url"]')?.value ?? ''
  feedFormState.siteUrl = form.querySelector('[name="site_url"]')?.value ?? ''

  if (feedFormState.feedUrl !== prevFeedUrl) {
    feedFormState.testError = null
    if (normalizeTestedUrl(feedFormState.feedUrl) !== feedFormState.lastTestedUrl) {
      feedFormState.testSuccess = false
    }
  }

  if (feedFormState.siteUrl !== prevSiteUrl) {
    feedFormState.lookupStatus = null
    feedFormState.discoveredFeeds = []
  }
}

export async function testFeedSourceUrl() {
  if (!feedFormState?.feedUrl) return

  feedFormState.isTesting = true
  feedFormState.testError = null
  feedFormState.testSuccess = false

  try {
    const normalizedTestUrl = normalizeTestedUrl(feedFormState.feedUrl)
    const xml = await feedApi.fetchFeed(feedFormState.feedUrl)
    const items = feedApi.parseFeed(xml, 0)
    if (!items.length) {
      throw new Error(t('feedForm.feedParsedNoItems'))
    }

    feedFormState.lastTestedUrl = normalizedTestUrl
    feedFormState.testSuccess = true

    if (!feedFormState.title) {
      const parser = new DOMParser()
      const doc = parser.parseFromString(xml, 'text/xml')
      feedFormState.title = doc.querySelector('channel > title, feed > title')?.textContent || ''
    }
  } catch (error) {
    feedFormState.testError = error instanceof Error ? error.message : t('feedForm.failedToConnect')
    if (!String(feedFormState.siteUrl || '').trim() && String(feedFormState.feedUrl || '').trim()) {
      feedFormState.siteUrl = deriveLookupBaseUrl(feedFormState.feedUrl)
    }
  } finally {
    feedFormState.isTesting = false
  }
}

export async function lookupFeedSourceUrls() {
  const lookupUrl = String(feedFormState?.siteUrl || '').trim()
  if (!lookupUrl) return

  feedFormState.isLookingUp = true
  feedFormState.lookupStatus = null
  feedFormState.discoveredFeeds = []

  try {
    const response = await chrome.runtime.sendMessage({type: 'FETCH_URL_CONTENT', url: lookupUrl})
    if (!response?.ok) {
      throw new Error(response?.error || 'Failed to inspect URL')
    }

    const finalUrl = response.finalUrl || lookupUrl
    const contentType = String(response.contentType ?? '').toLowerCase()
    if (!contentType.includes('text/html')) {
      feedFormState.lookupStatus = t('feedForm.lookupHtmlOnly')
      return
    }

    const html = typeof response.html === 'string' ? response.html : ''
    const candidates = discoverFeedCandidates(html, finalUrl)

    if (!candidates.length) {
      feedFormState.lookupStatus = t('feedForm.noFeedsDiscovered')
      return
    }

    feedFormState.lookupStatus = candidates.length === 1
      ? t('feedForm.foundPossibleFeed', {count: candidates.length})
      : t('feedForm.foundPossibleFeeds', {count: candidates.length})
    feedFormState.discoveredFeeds = candidates
  } catch (error) {
    feedFormState.lookupStatus = error instanceof Error ? error.message : t('feedForm.feedLookupFailed')
  } finally {
    feedFormState.isLookingUp = false
  }
}

export async function useDiscoveredFeedUrl(url) {
  if (!feedFormState) return
  feedFormState.feedUrl = url
  feedFormState.testError = null
  feedFormState.testSuccess = false
  await testFeedSourceUrl()
}

function renderTestedUrlLink(state) {
  const testedUrl = state.lastTestedUrl || ''
  if (!testedUrl) return ''
  return `<a
    href="${escapeHtml(testedUrl)}"
    title="${escapeHtml(testedUrl)}"
    target="_blank"
    rel="noopener noreferrer"
    data-feed-form-inline-link
  >${escapeHtml(t('common.openUrl'))}</a>`
}

function renderFeedUrlStatus(state) {
  if (state.testError) {
    return `<p data-feed-form-status data-status="error">${escapeHtml(state.testError)}</p>`
  }
  if (state.testSuccess) {
    return `<p data-feed-form-status data-status="success">${escapeHtml(t('feedForm.connectionSuccessful'))}</p>`
  }
  return `<p data-feed-form-status>${escapeHtml(t('feedForm.testBeforeSaving'))}</p>`
}

function renderDiscoveredFeedsBlock(state) {
  if (!state.discoveredFeeds.length) return ''
  return `
    <div data-feed-form-discovered>
      ${state.lookupStatus ? `<p data-feed-form-status>${escapeHtml(state.lookupStatus)}</p>` : ''}
      <div data-feed-form-discovered-list>
        ${state.discoveredFeeds.map((candidate) => `
          <button
            type="button"
            data-click="feedFormUseDiscovered"
            data-discovered-feed-url="${escapeHtml(candidate.url)}"
            data-feed-form-discovered-item
          >
            <span data-feed-form-discovered-title>${escapeHtml(candidate.title)}</span>
            <span data-feed-form-discovered-url>${escapeHtml(candidate.url)}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `
}

function renderLookupStatus(state) {
  if (!state.lookupStatus || state.discoveredFeeds.length) return ''
  return `<p data-feed-form-status>${escapeHtml(state.lookupStatus)}</p>`
}

export function renderFeedSourceCrudForm(state) {
  return `
    <form
      data-module-crud-form
      data-customizer-form
      data-feed-form
      data-submit="moduleCrudSave"
      data-entity-type="feed-source"
      data-record-id="${escapeHtml(String(state.record?.id ?? ''))}"
      data-record-sync-id="${escapeHtml(state.record?.sync_id ?? '')}"
      data-module-sync-id="${escapeHtml(state.moduleSyncId)}"
      data-parent-id="${escapeHtml(String(state.parentId ?? ''))}"
      data-parent-sync-id="${escapeHtml(state.parentSyncId)}"
      data-feed-test-success="${state.testSuccess ? 'true' : 'false'}"
      data-feed-last-tested-url="${escapeHtml(state.lastTestedUrl || '')}"
    >
      ${customizerSection({
        title: t('moduleCrud.sections.identity'),
        section: 'identity',
        children: `
          <div data-customizer-field data-customizer-field-layout="stack" data-feed-form-field>
            <div data-feed-form-inline-head>
              <span data-customizer-field-label>${escapeHtml(t('feedForm.feedUrl'))}</span>
              <span data-feed-form-tested-link>${renderTestedUrlLink(state)}</span>
            </div>
            <div data-feed-form-inline-row>
              ${urlInput({
                name: 'feed_url',
                value: state.feedUrl,
                attrs: {
                  required: true,
                  autocomplete: 'off',
                  spellcheck: 'false',
                  placeholder: t('feedForm.feedUrlPlaceholder'),
                },
              })}
              <button
                type="button"
                class="st-btn"
                data-btn="secondary"
                data-click="feedFormTestUrl"
                data-feed-form-test-btn
                ${state.isTesting || !state.feedUrl ? 'disabled' : ''}
              >${state.isTesting ? '...' : escapeHtml(t('common.test'))}</button>
            </div>
            <div data-feed-form-test-status>${renderFeedUrlStatus(state)}</div>
            <div data-feed-form-discovered-wrap>${renderDiscoveredFeedsBlock(state)}</div>
          </div>

          ${customizerField({
            label: t('feedForm.displayTitle'),
            control: textInput({
              name: 'title',
              value: state.title,
              attrs: {
                required: true,
                autocomplete: 'off',
                placeholder: t('feedForm.displayTitlePlaceholder'),
              },
            }),
          })}

          <div data-customizer-field data-customizer-field-layout="stack" data-feed-form-field>
            <div data-feed-form-inline-head>
              <span data-customizer-field-label>${escapeHtml(t('feedForm.siteUrl'))}</span>
            </div>
            <div data-feed-form-inline-row>
              ${urlInput({
                name: 'site_url',
                value: state.siteUrl,
                attrs: {
                  autocomplete: 'off',
                  spellcheck: 'false',
                  placeholder: t('feedForm.siteUrlPlaceholder'),
                },
              })}
              <button
                type="button"
                class="st-btn"
                data-btn="secondary"
                data-click="feedFormLookup"
                data-feed-form-lookup-btn
                ${state.isLookingUp || !state.siteUrl ? 'disabled' : ''}
              >${state.isLookingUp ? '...' : escapeHtml(t('common.lookup'))}</button>
            </div>
            <p data-settings-hint>${escapeHtml(t('feedForm.siteUrlHelp'))}</p>
            <div data-feed-form-lookup-status>${renderLookupStatus(state)}</div>
          </div>
        `,
      })}

      ${renderFormActions({saveLabel: t('feedForm.saveFeed')})}

      <input type="hidden" name="feed_test_success" value="${state.testSuccess ? '1' : ''}" data-form-state-ignore>
      <input type="hidden" name="feed_last_tested_url" value="${escapeHtml(state.lastTestedUrl || '')}" data-form-state-ignore>
      <input type="hidden" name="feed_can_save" value="${canSave(state) ? '1' : ''}" data-form-state-ignore>
    </form>
  `
}

export function canSaveFeedSourceForm() {
  return canSave(feedFormState)
}

export function patchFeedSourceCrudForm(root, state = feedFormState) {
  if (!(root instanceof HTMLElement) || !state) return false
  const form = root.matches('[data-feed-form]') ? root : root.querySelector('[data-feed-form]')
  if (!(form instanceof HTMLFormElement)) return false

  form.dataset.feedTestSuccess = state.testSuccess ? 'true' : 'false'
  form.dataset.feedLastTestedUrl = state.lastTestedUrl || ''

  const feedUrlInput = form.querySelector('input[name="feed_url"]')
  if (feedUrlInput instanceof HTMLInputElement && feedUrlInput.value !== state.feedUrl) {
    feedUrlInput.value = state.feedUrl
  }

  const titleInput = form.querySelector('input[name="title"]')
  if (titleInput instanceof HTMLInputElement && titleInput.value !== state.title) {
    titleInput.value = state.title
  }

  const siteUrlInput = form.querySelector('input[name="site_url"]')
  if (siteUrlInput instanceof HTMLInputElement && siteUrlInput.value !== state.siteUrl) {
    siteUrlInput.value = state.siteUrl
  }

  const testedLink = form.querySelector('[data-feed-form-tested-link]')
  if (testedLink instanceof HTMLElement) {
    testedLink.innerHTML = renderTestedUrlLink(state)
  }

  const testButton = form.querySelector('[data-feed-form-test-btn]')
  if (testButton instanceof HTMLButtonElement) {
    testButton.textContent = state.isTesting ? '...' : t('common.test')
    testButton.disabled = state.isTesting || !state.feedUrl
  }

  const lookupButton = form.querySelector('[data-feed-form-lookup-btn]')
  if (lookupButton instanceof HTMLButtonElement) {
    lookupButton.textContent = state.isLookingUp ? '...' : t('common.lookup')
    lookupButton.disabled = state.isLookingUp || !state.siteUrl
  }

  const testStatus = form.querySelector('[data-feed-form-test-status]')
  if (testStatus instanceof HTMLElement) {
    testStatus.innerHTML = renderFeedUrlStatus(state)
  }

  const discoveredWrap = form.querySelector('[data-feed-form-discovered-wrap]')
  if (discoveredWrap instanceof HTMLElement) {
    discoveredWrap.innerHTML = renderDiscoveredFeedsBlock(state)
  }

  const lookupStatus = form.querySelector('[data-feed-form-lookup-status]')
  if (lookupStatus instanceof HTMLElement) {
    lookupStatus.innerHTML = renderLookupStatus(state)
  }

  const testSuccessInput = form.querySelector('input[name="feed_test_success"]')
  if (testSuccessInput instanceof HTMLInputElement) {
    testSuccessInput.value = state.testSuccess ? '1' : ''
  }

  const lastTestedInput = form.querySelector('input[name="feed_last_tested_url"]')
  if (lastTestedInput instanceof HTMLInputElement) {
    lastTestedInput.value = state.lastTestedUrl || ''
  }

  const canSaveInput = form.querySelector('input[name="feed_can_save"]')
  if (canSaveInput instanceof HTMLInputElement) {
    canSaveInput.value = canSave(state) ? '1' : ''
  }

  updateFormDirtyState(form)
  return true
}
