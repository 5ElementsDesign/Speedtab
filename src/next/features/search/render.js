import {escapeHtml} from '../../utils/html.js'
import {t} from '../../utils/i18n.js'

function renderSearchIcon() {
  return '<i data-icon="search" aria-hidden="true"></i>'
}

export function renderSearchChrome(state = {}) {
  const open = state.open === true
  const query = escapeHtml(state.query ?? '')

  return `
    <div data-speedtab-search data-swipe-ignore>
      ${open ? `
        <div data-search-input-wrap>
          <input
            id="workspace-search"
            name="workspace_search"
            type="search"
            value="${query}"
            placeholder="${escapeHtml(t('app.searchPlaceholder'))}"
            data-input="updateSearchQuery"
            data-search-input
            autocomplete="off"
            spellcheck="false"
          >
          <button
            type="button"
            class="st-btn"
            data-click="closeSearch"
            data-search-dismiss
            title="${escapeHtml(t('common.close'))}"
            aria-label="${escapeHtml(t('common.close'))}"
          ><i data-icon="x" aria-hidden="true"></i></button>
        </div>
      ` : `
        <button
          type="button"
          class="st-btn"
          data-click="openSearch"
          data-search-trigger
          title="${escapeHtml(t('common.search'))}"
          aria-label="${escapeHtml(t('nav.openSearch'))}"
        >${renderSearchIcon()}</button>
      `}
    </div>
  `
}

function renderSearchResult(result, expandedIds = new Set(), kindLabels = {}) {
  const expanded = expandedIds.has(result.id)
  const title = escapeHtml(result.title || t('app.workspace'))
  const path = escapeHtml(result.path || t('app.workspace'))
  const snippet = result.snippet ? escapeHtml(result.snippet) : ''
  const externalUrl = result.externalUrl ? escapeHtml(result.externalUrl) : ''
  const kindLabel = escapeHtml(kindLabels[result.kind] ?? result.kind)

  return `
    <article data-search-result>
      <button
        type="button"
        class="st-btn"
        data-click="toggleSearchResult"
        data-search-result-id="${escapeHtml(result.id)}"
        data-search-toggle
      >
        <span data-search-result-main>
          <span data-search-result-head>
            <span data-search-result-kind>${kindLabel}</span>
            <span data-search-result-title>${title}</span>
          </span>
          <span data-search-result-path>${path}</span>
        </span>
        <span data-search-result-toggle>${expanded ? '−' : '+'}</span>
      </button>

      ${expanded ? `
        <div data-search-result-details>
          <div data-search-result-fields>
            <span>${escapeHtml(t('app.matched'))}</span>
            ${(result.fields ?? []).map((field) => `
              <span data-search-result-chip>${escapeHtml(field.length > 40 ? `${field.slice(0, 40)}…` : field)}</span>
            `).join('')}
          </div>

          ${snippet ? `
            <p data-search-result-snippet>
              ${result.kind === 'bookmark' && externalUrl
                ? `<a href="${externalUrl}" target="_blank" rel="noopener noreferrer">${snippet}</a>`
                : snippet}
            </p>
          ` : ''}

          <div data-search-result-footer>
            <span>${escapeHtml(result.path || t('app.workspaceRoot'))}</span>
            ${result.pageSlug ? `
              <button
                type="button"
                class="st-btn"
                data-click="locateSearchResult"
                data-search-result-id="${escapeHtml(result.id)}"
                data-search-locate
              >${escapeHtml(t('app.locate'))}</button>
            ` : ''}
          </div>
        </div>
      ` : ''}
    </article>
  `
}

export function renderSearchPanel(state = {}) {
  const show = state.panelVisible === true
  if (!show) return `<section data-search-panel hidden></section>`

  const query = String(state.query ?? '').trim()
  const results = state.results ?? []
  const expandedIds = state.expandedIds instanceof Set ? state.expandedIds : new Set(state.expandedIds ?? [])
  const kindLabels = state.kindLabels ?? {}

  return `
    <section data-search-panel aria-label="${escapeHtml(t('app.searchAria'))}">
      <div data-search-panel-header>
        ${query
          ? escapeHtml(t('app.searchResults', {count: results.length, query}))
          : escapeHtml(t('app.searchPrompt'))}
      </div>
      <div data-search-panel-body>
        ${!query ? `
          <div data-search-panel-empty>${escapeHtml(t('app.searchHint'))}</div>
        ` : !results.length ? `
          <div data-search-panel-empty>${escapeHtml(t('app.noMatches'))}</div>
        ` : `
          <div data-search-panel-results>
            ${results.map((result) => renderSearchResult(result, expandedIds, kindLabels)).join('')}
          </div>
        `}
      </div>
    </section>
  `
}
