import {escapeHtml} from '../next/utils/html.js'
import {t} from '../next/utils/i18n.js'

function renderStatus(state) {
  if (!state.status?.text) return ''
  return `
    <div data-ie-status data-tone="${escapeHtml(state.status.tone || 'idle')}">
      <strong>${escapeHtml(state.status.text)}</strong>
      ${state.status.details ? `<p>${escapeHtml(state.status.details)}</p>` : ''}
    </div>
  `
}

function renderTransfer(state) {
  if (!state.transfer?.active || !state.transfer?.label) return ''
  return `
    <div data-ie-transfer>
      <span data-ie-spinner aria-hidden="true"></span>
      <span data-ie-transfer-label>${escapeHtml(state.transfer.label)}</span>
    </div>
  `
}

function renderSummaryCell(label, value) {
  return `
    <div data-ie-summary-cell>
      <span data-ie-summary-label>${escapeHtml(label)}</span>
      <strong data-ie-summary-value>${escapeHtml(String(value ?? 0))}</strong>
    </div>
  `
}

function renderWarnings(warnings = []) {
  const uniqueWarnings = Array.from(new Set((warnings || []).filter(Boolean)))
  if (!uniqueWarnings.length) return ''
  return `
    <div data-ie-warnings>
      ${uniqueWarnings.map((warning) => `<p>${escapeHtml(warning)}</p>`).join('')}
    </div>
  `
}

function renderRemotePreviewSummary(summary) {
  if (!summary) return ''
  return `
    <div data-ie-summary-grid>
      ${renderSummaryCell(t('dataExchange.pages'), summary.pages)}
      ${renderSummaryCell(t('dataExchange.modules'), summary.modules)}
      ${renderSummaryCell(t('dataExchange.collections'), summary.collections)}
      ${renderSummaryCell(t('dataExchange.bookmarks'), summary.tabs)}
      ${renderSummaryCell(t('dataExchange.notes'), summary.notes)}
      ${renderSummaryCell(t('dataExchange.feeds'), summary.feedSources)}
      ${renderSummaryCell(t('dataExchange.archived'), summary.savedFeedItems)}
      ${renderSummaryCell(t('dataExchange.assets'), summary.assets)}
    </div>
  `
}

function renderDeepCheckGroup(group, selectedAssetIds = new Set()) {
  if (!group?.rows?.length) return ''
  return `
    <section data-ie-deep-group>
      <header data-ie-deep-group-header>
        <h4 data-ie-deep-group-title>${escapeHtml(group.label)}</h4>
        <span data-ie-deep-group-count>${escapeHtml(String(group.rows.length))}</span>
      </header>
      <div data-ie-deep-group-list>
        ${group.rows.map((row) => `
          <article data-ie-deep-row>
            ${row.checkbox ? `
              <label data-ie-deep-row-check>
                <input
                  type="checkbox"
                  value="${escapeHtml(String(row.id ?? ''))}"
                  data-change="toggleDeepCheckAsset"
                  ${selectedAssetIds.has(row.id) ? 'checked' : ''}
                >
                <span data-ie-deep-row-checkmark></span>
              </label>
            ` : ''}
            ${row.previewUrl ? `
              <div data-ie-deep-row-visual>
                <img src="${escapeHtml(row.previewUrl)}" alt="" loading="lazy">
              </div>
            ` : ''}
            <div data-ie-deep-row-main>
              <strong data-ie-deep-row-title>${escapeHtml(row.title)}</strong>
              ${row.preview ? `<p data-ie-deep-row-preview>${escapeHtml(row.preview)}</p>` : ''}
              <p data-ie-deep-row-meta>${escapeHtml(row.meta)}</p>
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  `
}

function renderDeepCheck(state) {
  const report = state.deepCheckReport
  const selectedAssetCount = state.deepCheckSelectedUnusedAssetIds?.length ?? 0
  const selectedAssetIds = new Set(state.deepCheckSelectedUnusedAssetIds ?? [])
  const isClean = !!report && report.total === 0
  return `
    <div data-ie-deep-check>
      <div data-ie-panel-head>
        <div>
          <p data-ie-section-kicker>${escapeHtml(t('dataExchange.deepCheckKicker'))}</p>
          <h3 data-ie-section-title>${escapeHtml(report ? t('dataExchange.deepCheckReady') : t('dataExchange.deepCheckIdle'))}</h3>
        </div>
        <div data-ie-actions>
          <button type="button" data-click="runDeepOrphanCheck" data-btn="ghost"${state.busy.deepCheck ? ' disabled' : ''}>${escapeHtml(t('dataExchange.runDeepCheck'))}</button>
          ${report?.unusedAssets && !isClean ? `<button type="button" data-click="deleteUnusedAssetsFromDeepCheck" data-btn="danger"${state.busy.deepCheck || !selectedAssetCount ? ' disabled' : ''}>${escapeHtml(t('dataExchange.deleteUnusedAssetsSelected', {count: selectedAssetCount}))}</button>` : ''}
        </div>
      </div>
      <p data-ie-copy>${escapeHtml(t('dataExchange.deepCheckCopy'))}</p>
      ${report ? `
        <p data-ie-muted>${escapeHtml(t('dataExchange.deepCheckCheckedAt', {value: report.checkedAt}))}</p>
        ${isClean ? `
          <div data-ie-status data-tone="success">
            <strong>${escapeHtml(t('cleanup.noOrphans'))}</strong>
          </div>
        ` : `
          <div data-ie-summary-grid>
            ${renderSummaryCell(t('maintenance.orphanModules'), report.modules)}
            ${renderSummaryCell(t('maintenance.orphanCollections'), report.collections)}
            ${renderSummaryCell(t('maintenance.orphanTabs'), report.tabs)}
            ${renderSummaryCell(t('maintenance.orphanNotes'), report.notes)}
            ${renderSummaryCell(t('maintenance.orphanFeedSources'), report.feedSources)}
            ${renderSummaryCell(t('maintenance.orphanFeedItems'), report.feedItems)}
            ${renderSummaryCell(t('maintenance.orphanSavedItems'), report.savedFeedItems)}
            ${renderSummaryCell(t('cleanup.unusedAssets'), report.unusedAssets)}
          </div>
          <p data-ie-muted>${escapeHtml(t('dataExchange.deepCheckFound', {count: report.total}))}</p>
          ${report.groups?.length ? `
            <div data-ie-deep-groups>
              ${report.groups.map((group) => renderDeepCheckGroup(group, selectedAssetIds)).join('')}
            </div>
          ` : `<p data-ie-muted>${escapeHtml(t('dataExchange.deepCheckNoDetails'))}</p>`}
        `}
      ` : ''}
    </div>
  `
}

function renderRemoteCompare(state) {
  const inspection = state.compareInspection
  if (!inspection) return ''

  const remoteMeta = inspection.remote?.meta
  const checksumLine = remoteMeta
    ? t('dataExchange.remoteChecksum', {checksum: remoteMeta.workspace_checksum, exportedAt: remoteMeta.exported_at})
    : t('dataExchange.status.remoteMetadataUnavailable')

  return `
    <div data-ie-block>
      <p>${escapeHtml(checksumLine)}</p>
      <p>${escapeHtml(t('dataExchange.localChecksum', {checksum: inspection.local.checksum}))}</p>
      <p>${escapeHtml(inspection.archiveExists ? t('dataExchange.remoteArchiveContains') : t('dataExchange.remoteArchiveMissing'))}</p>
    </div>
  `
}

function renderRemoteHealth(state) {
  if (!state.remoteHealth) return ''
  return `
    <div data-ie-block data-tone="${escapeHtml(state.remoteHealth.health)}">
      <strong>${escapeHtml(state.remoteHealth.message)}</strong>
      <p>${escapeHtml(state.remoteHealth.guidance)}</p>
    </div>
  `
}

function renderRemoteForm(state) {
  const settings = state.remoteDraft || {}
  const busy = state.busy.remoteConfig
  return `
    <div data-ie-form-grid>
      <label data-ie-field>
        <span>${escapeHtml(t('dataExchange.provider'))}</span>
        <select id="remote_provider_type" name="remote_provider_type" data-change="updateRemoteDraft"${busy ? ' disabled' : ''}>
          <option value="">${escapeHtml(t('dataExchange.selectProvider'))}</option>
          <option value="webdav"${settings.remote_provider_type === 'webdav' ? ' selected' : ''}>WebDAV</option>
        </select>
      </label>
      <label data-ie-field>
        <span>${escapeHtml(t('dataExchange.deviceLabel'))}</span>
        <input id="device_label" name="device_label" type="text" value="${escapeHtml(settings.device_label || '')}" data-change="updateRemoteDraft"${busy ? ' disabled' : ''}>
      </label>
      <label data-ie-field>
        <span>${escapeHtml(t('dataExchange.endpointUrl'))}</span>
        <input id="remote_endpoint_url" name="remote_endpoint_url" type="url" value="${escapeHtml(settings.remote_endpoint_url || '')}" data-change="updateRemoteDraft"${busy ? ' disabled' : ''}>
      </label>
      <label data-ie-field>
        <span>${escapeHtml(t('dataExchange.username'))}</span>
        <input id="remote_username" name="remote_username" type="text" value="${escapeHtml(settings.remote_username || '')}" data-change="updateRemoteDraft"${busy ? ' disabled' : ''}>
      </label>
      <label data-ie-field>
        <span>${escapeHtml(t('dataExchange.secret'))}</span>
        <input id="remote_secret" name="remote_secret" type="password" value="${escapeHtml(settings.remote_secret || '')}" data-change="updateRemoteDraft" autocomplete="off"${busy ? ' disabled' : ''}>
      </label>
      <label data-ie-field>
        <span>${escapeHtml(t('dataExchange.remotePath'))}</span>
        <input id="remote_path" name="remote_path" type="text" value="${escapeHtml(settings.remote_path || '')}" data-change="updateRemoteDraft"${busy ? ' disabled' : ''}>
      </label>
      <label data-ie-field data-ie-field-full>
        <span>${escapeHtml(t('dataExchange.dashboardUrl'))}</span>
        <input id="remote_dashboard_url" name="remote_dashboard_url" type="url" value="${escapeHtml(settings.remote_dashboard_url || '')}" data-change="updateRemoteDraft"${busy ? ' disabled' : ''}>
      </label>
    </div>
  `
}

function renderDeepCheckPanel(state) {
  return `
    <section data-ie-panel>
      ${renderDeepCheck(state)}
    </section>
  `
}

function renderResetPanel(state) {
  return `
    <section data-ie-panel>
      <div data-ie-panel-head>
        <div>
          <p data-ie-section-kicker>${escapeHtml(t('cleanup.resetOptions'))}</p>
          <h2 data-ie-section-title>${escapeHtml(t('cleanup.resetDatabase'))}</h2>
        </div>
        <div data-ie-actions>
          <button type="button" data-click="toggleResetOptions" data-btn="ghost">${escapeHtml(t('cleanup.resetOptions'))}</button>
        </div>
      </div>
      ${state.resetOptionsOpen ? `
        <div data-ie-block data-tone="error">
          <p>${escapeHtml(t('cleanup.resetWarning'))}</p>
          <p>${escapeHtml(t('cleanup.resetDatabaseHelp'))}</p>
          <div data-ie-actions>
            <button
              type="button"
              data-click="resetImportExportDatabase"
              data-btn="danger"
              ${state.busy.resetDatabase ? 'disabled' : ''}
            >${escapeHtml(state.busy.resetDatabase ? t('cleanup.resetting') : t('cleanup.resetDatabase'))}</button>
          </div>
        </div>
      ` : ''}
    </section>
  `
}

export function renderImportExportApp(state) {
  if (state.error) {
    return `
      <div data-ie-app>
        <header data-ie-header>
          <div>
            <p data-ie-eyebrow>Speedtab</p>
            <h1 data-ie-title>${escapeHtml(t('dataExchange.title'))}</h1>
          </div>
        </header>
        <div data-ie-status data-tone="error"><strong>${escapeHtml(state.error)}</strong></div>
      </div>
    `
  }

  const exportState = state.exportState || {
    export_dirty: false,
    export_dirty_reasons: [],
    remote_out_of_date: false,
    last_export_checksum: null,
    last_exported_at: null,
  }

  return `
    <div data-ie-app>
      <header data-ie-header>
        <div>
          <p data-ie-eyebrow>Speedtab</p>
          <h1 data-ie-title>${escapeHtml(t('dataExchange.title'))}</h1>
        </div>
        <div data-ie-header-actions>
          <button type="button" data-click="reloadImportExport" data-ie-link data-btn="ghost">${escapeHtml(t('sorter.reload'))}</button>
          <a href="./newtab.html" data-ie-link data-btn="dark">${escapeHtml(t('sorter.backToSpeedtab'))}</a>
        </div>
      </header>

      ${renderStatus(state)}
      ${renderTransfer(state)}

      <section data-ie-panel>
        <div data-ie-panel-head>
          <div>
            <p data-ie-section-kicker>${escapeHtml(t('dataExchange.localFileBackup'))}</p>
            <h2 data-ie-section-title>${escapeHtml(exportState.export_dirty ? t('dataExchange.status.localBackupNotCurrent') : exportState.last_exported_at ? t('dataExchange.status.localBackupCurrent') : t('dataExchange.status.noLocalExportYet'))}</h2>
          </div>
          <div data-ie-actions>
            <button type="button" data-click="downloadLocalExport" data-btn="ghost"${state.busy.localExport ? ' disabled' : ''}>${escapeHtml(t('dataExchange.downloadExportFile'))}</button>
            <button type="button" data-click="triggerLocalImport" data-btn="ghost"${state.busy.localImport ? ' disabled' : ''}>${escapeHtml(t('dataExchange.importLocalFile'))}</button>
          </div>
        </div>
        <p data-ie-copy>${escapeHtml(exportState.export_dirty ? t('dataExchange.status.downloadPortableBackup') : exportState.last_exported_at ? t('dataExchange.status.workspaceAlreadyExported') : t('dataExchange.status.createFirstSnapshot'))}</p>
        ${exportState.export_dirty_reasons?.length ? `<p data-ie-muted>${escapeHtml(t('dataExchange.localExportReasons', {reasons: exportState.export_dirty_reasons.join(', ')}))}</p>` : ''}
        ${exportState.last_exported_at ? `<p data-ie-muted>${escapeHtml(t('dataExchange.lastLocalExport', {value: exportState.last_exported_at}))}</p>` : ''}
        <div data-ie-summary-grid>
          ${renderSummaryCell(t('dataExchange.pages'), state.localSummary.pages)}
          ${renderSummaryCell(t('dataExchange.modules'), state.localSummary.modules)}
          ${renderSummaryCell(t('dataExchange.collections'), state.localSummary.collections)}
          ${renderSummaryCell(t('dataExchange.bookmarks'), state.localSummary.tabs)}
          ${renderSummaryCell(t('dataExchange.notes'), state.localSummary.notes)}
          ${renderSummaryCell(t('dataExchange.feeds'), state.localSummary.feedSources)}
          ${renderSummaryCell(t('dataExchange.archived'), state.localSummary.savedFeedItems)}
          ${renderSummaryCell(t('dataExchange.assets'), state.localSummary.assets)}
        </div>
      </section>

      ${renderDeepCheckPanel(state)}

      <section data-ie-panel>
        <div data-ie-panel-head>
          <div>
            <p data-ie-section-kicker>${escapeHtml(t('dataExchange.remoteConfiguration'))}</p>
            <h2 data-ie-section-title>${escapeHtml(t('dataExchange.remoteSync'))}</h2>
          </div>
          <div data-ie-actions>
            <button type="button" data-click="saveRemoteConfig" data-btn="ghost"${state.busy.remoteConfig ? ' disabled' : ''}>${escapeHtml(t('dataExchange.saveRemote'))}</button>
            <button type="button" data-click="clearRemoteConfig" data-btn="ghost"${state.busy.remoteConfig ? ' disabled' : ''}>${escapeHtml(t('dataExchange.clearRemote'))}</button>
            <button type="button" data-click="testRemoteConfig" data-btn="ghost"${state.busy.remoteConfig ? ' disabled' : ''}>${escapeHtml(t('dataExchange.testConnection'))}</button>
          </div>
        </div>
        <p data-ie-copy>${escapeHtml(t('dataExchange.remoteConfigurationHelp'))}</p>
        ${renderRemoteForm(state)}
      </section>

      <section data-ie-panel>
        <div data-ie-panel-head>
          <div>
            <p data-ie-section-kicker>${escapeHtml(t('dataExchange.remoteSync'))}</p>
            <h2 data-ie-section-title>${escapeHtml(state.remoteActivity || t('dataExchange.noRemoteActivity'))}</h2>
          </div>
          <div data-ie-actions>
            <button type="button" data-click="refreshRemoteCompare" data-btn="ghost"${state.busy.remoteCheck ? ' disabled' : ''}>${escapeHtml(t('dataExchange.checkStatus'))}</button>
            <button type="button" data-click="previewRemotePull" data-btn="ghost"${state.busy.remotePreview ? ' disabled' : ''}>${escapeHtml(t('dataExchange.checkRemoteContents'))}</button>
            <button type="button" data-click="pushRemoteWorkspace" data-btn="ghost"${state.busy.remotePush ? ' disabled' : ''} title="${escapeHtml(t('dataExchange.pushOverwriteTitle'))}">${escapeHtml(t('dataExchange.pushToRemote'))}</button>
            <button type="button" data-click="pullRemoteWorkspace" data-btn="ghost"${state.busy.remotePull ? ' disabled' : ''}>${escapeHtml(t('dataExchange.pullFromRemote'))}</button>
            <button type="button" data-click="downloadRemoteExport" data-btn="ghost"${state.busy.remoteDownload ? ' disabled' : ''}>${escapeHtml(t('dataExchange.downloadRemoteExport'))}</button>
          </div>
        </div>
        ${renderRemoteCompare(state)}
        ${renderRemoteHealth(state)}
        ${renderRemotePreviewSummary(state.remotePreviewSummary)}
        ${renderWarnings(state.remoteWarnings)}
      </section>

      ${renderResetPanel(state)}

      <input id="workspace_import_file" name="workspace_import_file" type="file" accept="application/json,.json" hidden>
    </div>
  `
}
