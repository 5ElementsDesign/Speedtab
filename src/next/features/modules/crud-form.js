import {escapeHtml} from '../../utils/html.js'
import {t} from '../../utils/i18n.js'
import {renderFormActions} from '../forms/actions.js'
import {customizerDivider, customizerField, customizerSection, textarea} from '../../ui/primitives.js'

function getFormTitleKey(entityType, record) {
  if (entityType === 'tab') return record?.id ? 'next.moduleCrud.editTab' : 'next.moduleCrud.newTab'
  if (entityType === 'bookmark') return record?.id ? 'next.moduleCrud.editBookmark' : 'next.moduleCrud.newBookmark'
  if (entityType === 'note') return record?.id ? 'openNotes.editNoteTitle' : 'notesView.newNoteTitle'
  if (entityType === 'feed-source') return record?.id ? 'feeds.editFeedSourceTitle' : 'feeds.newFeedSourceTitle'
  return 'common.customize'
}

export function getCrudPanelTitle(entityType, record) {
  return t(getFormTitleKey(entityType, record))
}

export function renderModuleCrudForm({
  entityType,
  record = null,
  moduleSyncId = '',
  parentId = '',
  parentSyncId = '',
  parentTitle = '',
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
      data-parent-id="${escapeHtml(String(parentId ?? ''))}"
      data-parent-sync-id="${escapeHtml(parentSyncId)}"
    >
      ${parentTitle ? `
        <div data-customizer-section data-section="context">
          <p data-customizer-section-title>${t('next.moduleCrud.sections.context')}</p>
          <p data-module-crud-parent>${escapeHtml(parentTitle)}</p>
        </div>
        ${customizerDivider()}
      ` : ''}

      ${customizerSection({
        title: t('next.moduleCrud.sections.identity'),
        section: 'identity',
        children: `
          ${customizerField({
            label: entityType === 'feed-source' ? t('feedForm.displayTitle') : t('moduleForm.title'),
            control: `<input type="text" name="title" value="${escapeHtml(title)}" required autocomplete="off"${entityType === 'feed-source' ? ` placeholder="${escapeHtml(t('feedForm.displayTitlePlaceholder'))}"` : ''}>`,
          })}
          ${entityType === 'bookmark' ? customizerField({
            label: t('next.moduleCrud.fields.url'),
            control: `<input type="url" name="url" value="${escapeHtml(url)}" required autocomplete="off" spellcheck="false">`,
          }) : ''}
          ${entityType === 'feed-source' ? customizerField({
            label: t('feedForm.feedUrl'),
            control: `<input type="url" name="feed_url" value="${escapeHtml(feedUrl)}" required autocomplete="off" spellcheck="false" placeholder="${escapeHtml(t('feedForm.feedUrlPlaceholder'))}">`,
          }) : ''}
          ${entityType === 'bookmark' ? customizerField({
            label: t('next.moduleCrud.fields.description'),
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

      ${customizerDivider()}

      ${renderFormActions()}
    </form>
  `
}
