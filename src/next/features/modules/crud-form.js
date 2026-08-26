import {escapeHtml} from '../../utils/html.js'
import {t} from '../../utils/i18n.js'
import {renderFormActions} from '../forms/actions.js'
import {customizerDivider, customizerField, customizerSection, textarea} from '../../ui/primitives.js'
import {getCollectionImportExample, getCollectionImportKind} from './collection-import.js'
import {FEED_AUTO_REFRESH_INTERVALS, getFeedAutoRefreshInterval} from './feed-auto-refresh.js'

function getFormTitleKey(entityType, record) {
  if (entityType === 'tab') return record?.id ? 'moduleCrud.editTab' : 'moduleCrud.newTab'
  if (entityType === 'bookmark') return record?.id ? 'moduleCrud.editBookmark' : 'moduleCrud.newBookmark'
  if (entityType === 'note') return record?.id ? 'openNotes.editNoteTitle' : 'notesView.newNoteTitle'
  if (entityType === 'feed-source') return record?.id ? 'feeds.editFeedSourceTitle' : 'feeds.newFeedSourceTitle'
  return 'common.customize'
}

export function getCrudPanelTitle(entityType, record) {
  return t(getFormTitleKey(entityType, record))
}

function renderCollectionImport({moduleType, record, hasContent, moduleSyncId}) {
  const kind = getCollectionImportKind(moduleType)
  if (!kind || !record?.id) return ''
  const fileId = `module-collection-import-file-${kind}`
  return `
    ${customizerDivider()}
    <form
      data-module-crud-import
      data-submit="moduleCrudImport"
      data-record-id="${escapeHtml(String(record.id))}"
      data-record-sync-id="${escapeHtml(record.sync_id ?? '')}"
      data-module-sync-id="${escapeHtml(moduleSyncId)}"
      data-module-type="${escapeHtml(moduleType)}"
    >
      ${customizerSection({
        title: t('moduleCrud.sections.import'),
        section: 'import',
        children: `
          ${customizerField({
            label: t(`moduleCrud.import.${kind}`),
            layout: 'stack',
            control: textarea({
              name: 'collection-import-json',
              rows: 8,
              attrs: {placeholder: getCollectionImportExample(kind), spellcheck: 'false'},
            }),
          })}
          <p data-settings-hint>${escapeHtml(t('moduleCrud.import.help'))}</p>
          <div data-form-actions>
            <label for="${escapeHtml(fileId)}" class="st-btn" data-btn="ghost">${escapeHtml(t('moduleCrud.import.chooseFile'))}</label>
            ${hasContent ? `<button type="button" data-btn="ghost" data-click="downloadModuleTabContent" data-record-id="${escapeHtml(String(record.id))}" data-record-sync-id="${escapeHtml(record.sync_id ?? '')}" data-module-sync-id="${escapeHtml(moduleSyncId)}" data-module-type="${escapeHtml(moduleType)}">${escapeHtml(t('moduleCrud.import.download'))}</button>` : ''}
          </div>
          <input id="${escapeHtml(fileId)}" type="file" accept="application/json,.json" hidden data-change="collectionImportFileChange">
          <div data-form-actions><button type="submit" data-btn="primary">${escapeHtml(t('moduleCrud.import.import'))}</button></div>
        `,
      })}
    </form>
  `
}

function renderFeedAutoRefresh(record, moduleType, moduleSyncId) {
  if (moduleType !== 'feeds' || !record?.id) return ''
  const value = getFeedAutoRefreshInterval(record.config_json)
  return `
    ${customizerDivider()}
    <label data-customizer-field>
      <span data-customizer-field-label>${escapeHtml(t('feeds.autoRefresh'))}</span>
      <select data-change="changeFeedAutoRefresh" data-record-id="${escapeHtml(String(record.id))}" data-record-sync-id="${escapeHtml(record.sync_id ?? '')}" data-module-sync-id="${escapeHtml(moduleSyncId)}">
        <option value="">${escapeHtml(t('feeds.autoRefreshOff'))}</option>
        ${FEED_AUTO_REFRESH_INTERVALS.map((interval) => `<option value="${interval}"${value === interval ? ' selected' : ''}>${escapeHtml(t('feeds.autoRefreshMinutes', {minutes: interval}))}</option>`).join('')}
      </select>
    </label>
  `
}

export function renderModuleCrudForm({
  entityType,
  record = null,
  moduleSyncId = '',
  moduleType = '',
  parentId = '',
  parentSyncId = '',
  hasContent = false,
}) {
  const title = record?.title ?? ''
  const description = record?.description ?? ''
  const url = record?.url ?? ''
  const feedUrl = record?.feed_url ?? ''
  const siteUrl = record?.site_url ?? ''

  return `
    <form
      data-module-crud-form
      data-customizer-form
      data-submit="moduleCrudSave"
      data-entity-type="${escapeHtml(entityType)}"
      data-record-id="${escapeHtml(String(record?.id ?? ''))}"
      data-record-sync-id="${escapeHtml(record?.sync_id ?? '')}"
      data-module-sync-id="${escapeHtml(moduleSyncId)}"
      data-module-type="${escapeHtml(moduleType)}"
      data-parent-id="${escapeHtml(String(parentId ?? ''))}"
      data-parent-sync-id="${escapeHtml(parentSyncId)}"
    >
      ${customizerSection({
        title: t('moduleCrud.sections.identity'),
        section: 'identity',
        children: `
          ${customizerField({
            label: entityType === 'feed-source' ? t('feedForm.displayTitle') : entityType === 'tab' ? t('noteForm.title') : t('moduleForm.title'),
            control: `<input type="text" name="title" value="${escapeHtml(title)}" required autocomplete="off"${entityType === 'feed-source' ? ` placeholder="${escapeHtml(t('feedForm.displayTitlePlaceholder'))}"` : ''}>`,
          })}
          ${entityType === 'bookmark' ? customizerField({
            label: t('moduleCrud.fields.url'),
            control: `<input type="url" name="url" value="${escapeHtml(url)}" required autocomplete="off" spellcheck="false">`,
          }) : ''}
          ${entityType === 'feed-source' ? customizerField({
            label: t('feedForm.feedUrl'),
            control: `<input type="url" name="feed_url" value="${escapeHtml(feedUrl)}" required autocomplete="off" spellcheck="false" placeholder="${escapeHtml(t('feedForm.feedUrlPlaceholder'))}">`,
          }) : ''}
          ${entityType === 'bookmark' ? customizerField({
            label: t('moduleCrud.fields.description'),
            layout: 'stack',
            control: textarea({
              name: 'description',
              value: description,
              rows: 4,
            }),
          }) : ''}
          ${entityType === 'feed-source' ? customizerField({
            label: t('feedForm.siteUrl'),
            layout: 'stack',
            control: `<input type="url" name="site_url" value="${escapeHtml(siteUrl)}" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(t('feedForm.siteUrlPlaceholder'))}">`,
          }) : ''}
          ${entityType === 'feed-source' ? `<p data-settings-hint>${escapeHtml(t('feedForm.siteUrlHelp'))}</p>` : ''}
        `,
      })}

      ${renderFormActions()}
    </form>
    ${entityType === 'tab' ? renderFeedAutoRefresh(record, moduleType, moduleSyncId) : ''}
    ${entityType === 'tab' ? renderCollectionImport({moduleType, record, hasContent, moduleSyncId}) : ''}
  `
}
