import {escapeHtml} from '../../../utils/html.js'
import {t} from '../../../utils/i18n.js'

function renderOrphanRow(kind, row, parentLabel = '') {
  const id = typeof row.id === 'number' ? String(row.id) : ''
  const syncId = row.sync_id ? String(row.sync_id) : ''
  const title = row.title || row.url || row.feed_url || t('modules.untitled')

  return `
    <article data-orphan-row>
      <div data-orphan-row-main>
        <strong data-orphan-row-title>${escapeHtml(title)}</strong>
        <p data-orphan-row-meta>
          <span>ID ${escapeHtml(id || '—')}</span>
          <span>${escapeHtml(syncId || '—')}</span>
          ${parentLabel ? `<span>${escapeHtml(parentLabel)}</span>` : ''}
        </p>
      </div>
      <button
        type="button"
        class="st-btn"
        data-btn="danger"
        data-click="deleteOrphanRow"
        data-orphan-kind="${escapeHtml(kind)}"
        data-orphan-id="${escapeHtml(id)}"
      >${escapeHtml(t('common.delete'))}</button>
    </article>
  `
}

function renderOrphanGroup(title, kind, rows = [], parentLabelBuilder = null) {
  if (!rows.length) return ''
  return `
    <section data-orphan-group>
      <header data-orphan-group-header>
        <h2 data-orphan-group-title>${escapeHtml(title)}</h2>
        <span data-orphan-group-count>${escapeHtml(String(rows.length))}</span>
      </header>
      <div data-orphan-group-list>
        ${rows.map((row) => renderOrphanRow(kind, row, parentLabelBuilder ? parentLabelBuilder(row) : '')).join('')}
      </div>
    </section>
  `
}

export function renderOrphansPage(candidates) {
  const total = [
    candidates.modules,
    candidates.collections,
    candidates.tabs,
    candidates.notes,
    candidates.feedSources,
    candidates.feedItems,
    candidates.savedFeedItems,
  ].reduce((sum, rows) => sum + rows.length, 0)

  if (!total) {
    return `
      <div data-orphans-page>
        <header data-orphans-page-header>
          <div>
            <h1 data-orphans-page-title>${escapeHtml(t('maintenance.orphans'))}</h1>
            <p data-orphans-page-copy>${escapeHtml(t('maintenance.orphansResolved'))}</p>
          </div>
        </header>
      </div>
    `
  }

  return `
    <div data-orphans-page>
      <header data-orphans-page-header>
        <div>
          <h1 data-orphans-page-title>${escapeHtml(t('maintenance.orphansDetectedTitle'))}</h1>
          <p data-orphans-page-copy>${escapeHtml(t('maintenance.orphansDetectedCopy'))}</p>
        </div>
        <button type="button" class="st-btn" data-btn="danger" data-click="deleteAllOrphansShown">${escapeHtml(t('maintenance.deleteAllOrphans'))}</button>
      </header>

      ${renderOrphanGroup(t('maintenance.orphanModules'), 'module', candidates.modules, (row) => `page_id:${row.page_id}`)}
      ${renderOrphanGroup(t('maintenance.orphanCollections'), 'collection', candidates.collections, (row) => `module_id:${row.module_id}`)}
      ${renderOrphanGroup(t('maintenance.orphanTabs'), 'tab', candidates.tabs, (row) => `collection_id:${row.collection_id}`)}
      ${renderOrphanGroup(t('maintenance.orphanNotes'), 'note', candidates.notes, (row) => `collection_id:${row.collection_id}`)}
      ${renderOrphanGroup(t('maintenance.orphanFeedSources'), 'feed_source', candidates.feedSources, (row) => `collection_id:${row.collection_id}`)}
      ${renderOrphanGroup(t('maintenance.orphanFeedItems'), 'feed_item', candidates.feedItems, (row) => `feed_source_id:${row.feed_source_id}`)}
      ${renderOrphanGroup(t('maintenance.orphanSavedItems'), 'saved_feed_item', candidates.savedFeedItems, (row) => `collection_id:${row.collection_id}`)}
    </div>
  `
}
