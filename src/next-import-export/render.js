import {escapeHtml} from '../next/utils/html.js'
import {t} from '../next/utils/i18n.js'

function region(name, content) {
  return `<div data-ie-region="${escapeHtml(name)}">${content}</div>`
}

function renderFieldHelp(text) {
  if (!text) return ''
  const escaped = escapeHtml(text)
  return `
    <button
      type="button"
      data-btn="ghost"
      data-ie-help
      title="${escaped}"
      aria-label="${escaped}"
    >?</button>
  `
}

function renderStatus(state) {
  if (!state.status?.text) return ''
  return `
    <div data-ie-status data-tone="${escapeHtml(state.status.tone || 'idle')}">
      <button
        type="button"
        data-click="dismissUiNode"
        data-dismiss-clear="status"
        data-dismiss-closest="[data-ie-status]"
        data-btn="ghost"
        data-ie-dismiss
        aria-label="${escapeHtml(t('common.close'))}"
        title="${escapeHtml(t('common.close'))}"
      >×</button>
      <strong>${escapeHtml(state.status.text)}</strong>
      ${state.status.details ? `<p>${escapeHtml(state.status.details)}</p>` : ''}
    </div>
  `
}

function renderStatusForArea(state, ...areas) {
  const area = state.status?.area || ''
  if (!areas.includes(area)) return ''
  return renderStatus(state)
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

function renderTransferForArea(state, ...areas) {
  const area = state.transfer?.area || ''
  if (!areas.includes(area)) return ''
  return renderTransfer(state)
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

function formatBytes(bytes) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function getRemoteSyncRenderState(state) {
  const compareState = state.compareInspection?.state ?? null
  const health = state.remoteHealth?.health ?? null
  const remote = state.remoteHealth?.remote ?? state.compareInspection?.remote ?? null

  return {
    isRemoteMissing: compareState === 'remote_missing' || (!remote?.export_exists && !remote?.meta_exists && health !== 'healthy'),
  }
}

function renderRemotePackageOverview(state) {
  const { isRemoteMissing } = getRemoteSyncRenderState(state)
  if (isRemoteMissing) return ''

  const remote = state.remoteHealth?.remote ?? state.compareInspection?.remote ?? null
  if (!remote) return ''

  const rows = [
    {
      label: t('dataExchange.remoteDataFile'),
      present: remote.export_exists,
      size: formatBytes(remote.export_size_bytes),
      action: 'downloadRemoteData',
    },
    {
      label: t('dataExchange.remoteAssetsFile'),
      present: remote.payload_mode === 'split' ? remote.assets_exists : false,
      size: remote.payload_mode === 'split' ? formatBytes(remote.assets_size_bytes) : '—',
      action: 'downloadRemoteAssets',
      disabled: remote.payload_mode !== 'split' || !remote.assets_exists,
    },
    {
      label: t('dataExchange.remoteMetadataFile'),
      present: remote.meta_exists,
      size: 'JSON',
      action: 'downloadRemoteMeta',
    },
  ]

  return `
    <div data-ie-block>
      <div data-ie-package-list>
        ${rows.map((row) => `
          <div data-ie-package-row>
            <div data-ie-package-main>
              <strong>${escapeHtml(row.label)}</strong>
              <span data-ie-package-meta>${escapeHtml(row.present ? t('dataExchange.remotePackagePresent', {size: row.size}) : t('dataExchange.remotePackageMissing'))}</span>
            </div>
            <button
              type="button"
              data-click="${escapeHtml(row.action)}"
              data-btn="ghost"
              ${state.busy.remoteDownload || row.disabled || !row.present ? 'disabled' : ''}
            >${escapeHtml(t('dataExchange.download'))}</button>
          </div>
        `).join('')}
      </div>
    </div>
  `
}

function renderRemoteAutoSync(state) {
  const autoSync = state.remoteAutoSync
  const providerType = state.remoteDraft?.remote_provider_type || state.remoteSettings?.remote_provider_type || ''
  if (!autoSync || providerType !== 'gdrive') return ''

  const toneByState = {
    disabled: 'idle',
    not_configured: 'error',
    offline: 'error',
    blocked: 'error',
    pending: 'success',
    idle: 'success',
  }

  const titleByState = {
    disabled: t('dataExchange.autoSyncDisabled'),
    not_configured: t('dataExchange.autoSyncNeedsConfig'),
    offline: t('dataExchange.autoSyncOffline'),
    blocked: t('dataExchange.autoSyncBlocked'),
    pending: t('dataExchange.autoSyncPending'),
    idle: t('dataExchange.autoSyncIdle'),
  }

  const details = autoSync.interval_minutes
    ? t('dataExchange.autoSyncEveryMinutes', {count: autoSync.interval_minutes})
    : t('dataExchange.autoSyncManualOnly')

  return `
    <div data-ie-block data-tone="${escapeHtml(toneByState[autoSync.state] || 'idle')}">
      <strong class="d-block mb-1">${escapeHtml(titleByState[autoSync.state] || '')}</strong>
      <span>${escapeHtml(details)}</span>
    </div>
  `
}

function renderRemoteArchives(state) {
  const archives = state.remoteArchives ?? []
  if (!archives.length) return ''
  const configuredKeepLatest = state.remoteDraft?.remote_archive_keep_latest_count
    ?? state.remoteSettings?.remote_archive_keep_latest_count
    ?? state.remoteArchiveKeepLatest
  const keepLatest = typeof configuredKeepLatest === 'number' && Number.isFinite(configuredKeepLatest) && configuredKeepLatest > 0
    ? configuredKeepLatest
    : ''
  const pruneDisabled = state.busy.remoteArchivePrune || state.busy.remoteArchiveDelete || state.busy.remoteRestore || state.busy.remoteDownload || !keepLatest

  return `
    <div data-ie-block>
      <p>${escapeHtml(t('dataExchange.remoteArchives'))}</p>
      <div data-ie-actions>
        <button
          type="button"
          data-click="pruneRemoteArchives"
          data-btn="danger"
          ${pruneDisabled ? 'disabled' : ''}
        >${escapeHtml(t('dataExchange.pruneArchives'))}</button>
      </div>
      <div data-ie-package-list>
        ${archives.map((archive) => `
          <div data-ie-package-row>
            <div data-ie-package-main>
              <strong>${escapeHtml(archive.workspace_checksum)}</strong>
              <span data-ie-package-meta>${escapeHtml([
                archive.exported_at ? t('dataExchange.remoteExportedAt', {value: archive.exported_at}) : null,
                archive.source_device_label ? t('dataExchange.remoteSourceDevice', {value: archive.source_device_label}) : null,
              ].filter(Boolean).join(' · '))}</span>
            </div>
            <div data-ie-actions>
              <button
                type="button"
                data-click="downloadRemoteArchive"
                data-archive-checksum="${escapeHtml(archive.workspace_checksum)}"
                data-btn="ghost"
                ${state.busy.remoteDownload || state.busy.remoteRestore || state.busy.remoteArchiveDelete || state.busy.remoteArchivePrune ? 'disabled' : ''}
              >${escapeHtml(t('dataExchange.download'))}</button>
              <button
                type="button"
                data-click="restoreRemoteArchive"
                data-archive-checksum="${escapeHtml(archive.workspace_checksum)}"
                data-btn="danger"
                ${state.busy.remoteRestore || state.busy.remoteDownload || state.busy.remoteArchiveDelete || state.busy.remoteArchivePrune ? 'disabled' : ''}
              >${escapeHtml(t('dataExchange.restore'))}</button>
              <button
                type="button"
                data-click="deleteRemoteArchive"
                data-archive-checksum="${escapeHtml(archive.workspace_checksum)}"
                data-btn="danger"
                ${state.busy.remoteArchiveDelete || state.busy.remoteRestore || state.busy.remoteDownload || state.busy.remoteArchivePrune ? 'disabled' : ''}
              >${escapeHtml(t('common.delete'))}</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `
}

function renderRemotePreviewSummary(summary) {
  if (!summary) return ''
  return `
    <div data-ie-block>
      ${summary.exportedAt ? `<p>${escapeHtml(t('dataExchange.remoteExportedAt', {value: summary.exportedAt}))}</p>` : ''}
      ${summary.checksum ? `<p>${escapeHtml(t('dataExchange.remoteChecksumOnly', {checksum: summary.checksum}))}</p>` : ''}
    </div>
    <div data-ie-summary-grid>
      ${renderSummaryCell(t('dataExchange.pages'), summary.pages)}
      ${renderSummaryCell(t('dataExchange.modules'), summary.modules)}
      ${renderSummaryCell(t('dataExchange.collections'), summary.collections)}
      ${renderSummaryCell(t('dataExchange.bookmarks'), summary.tabs)}
      ${renderSummaryCell(t('dataExchange.notes'), summary.notes)}
      ${renderSummaryCell(t('todo.moduleType'), summary.todos)}
      ${renderSummaryCell(t('dataExchange.feeds'), summary.feedSources)}
      ${renderSummaryCell(t('dataExchange.archived'), summary.savedFeedItems)}
      ${renderSummaryCell(t('dataExchange.assets'), summary.assets)}
    </div>
  `
}

function renderCurrentWorkspaceSummary(state) {
  if (!state.remotePreviewSummary) return ''
  return `
    <div data-ie-block>
      <strong>${escapeHtml(t('dataExchange.currentWorkspace'))}</strong>
    </div>
    <div data-ie-summary-grid>
      ${renderSummaryCell(t('dataExchange.pages'), state.localSummary.pages)}
      ${renderSummaryCell(t('dataExchange.modules'), state.localSummary.modules)}
      ${renderSummaryCell(t('dataExchange.collections'), state.localSummary.collections)}
      ${renderSummaryCell(t('dataExchange.bookmarks'), state.localSummary.tabs)}
      ${renderSummaryCell(t('dataExchange.notes'), state.localSummary.notes)}
      ${renderSummaryCell(t('todo.moduleType'), state.localSummary.todos)}
      ${renderSummaryCell(t('dataExchange.feeds'), state.localSummary.feedSources)}
      ${renderSummaryCell(t('dataExchange.archived'), state.localSummary.savedFeedItems)}
      ${renderSummaryCell(t('dataExchange.assets'), state.localSummary.assets)}
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
  const showCleanNotice = isClean && !state.deepCheckCleanDismissed
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
      ${renderStatusForArea(state, 'deep-check')}
      ${renderTransferForArea(state, 'deep-check')}
      ${report ? `
        ${showCleanNotice ? `
          <div data-ie-status-wrapper>
            <p data-ie-muted>${escapeHtml(t('dataExchange.deepCheckCheckedAt', {value: report.checkedAt}))}</p>
            <div data-ie-status data-tone="success">
              <button
                type="button"
                data-click="dismissUiNode"
                data-dismiss-closest="[data-ie-status-wrapper]"
                data-dismiss-clear="deep-check-clean"
                data-btn="ghost"
                data-ie-dismiss
                aria-label="${escapeHtml(t('common.close'))}"
                title="${escapeHtml(t('common.close'))}"
              >×</button>
              <strong>${escapeHtml(t('cleanup.noOrphans'))}</strong>
            </div>
          </div>
        ` : report && !isClean ? `
          <p data-ie-muted>${escapeHtml(t('dataExchange.deepCheckCheckedAt', {value: report.checkedAt}))}</p>
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
        ` : ''}
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
      ${remoteMeta?.assets_count != null ? `<p>${escapeHtml(t('dataExchange.remoteAssetsCount', {count: remoteMeta.assets_count}))}</p>` : ''}
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
  const widgetSettings = state.widgetSettings || {}
  const busy = state.busy.remoteConfig
  const isGoogleDrive = settings.remote_provider_type === 'gdrive'
  const providerSelected = !!settings.remote_provider_type
  const hasConnectedGoogleAccount = isGoogleDrive && !!settings.remote_provider_account_email
  return `
    <div data-ie-form-grid>
      <label data-ie-field>
        <span>${escapeHtml(t('dataExchange.provider'))}</span>
        <div data-ie-inline-fields-flat>
          <select id="remote_provider_type" name="remote_provider_type" data-change="updateRemoteDraft"${busy ? ' disabled' : ''}>
            <option value="">${escapeHtml(t('dataExchange.selectProvider'))}</option>
            <option value="webdav"${settings.remote_provider_type === 'webdav' ? ' selected' : ''}>WebDAV</option>
            <option value="gdrive"${isGoogleDrive ? ' selected' : ''}>Google Drive</option>
          </select>
        </div>
      </label>
      ${providerSelected ? `
      <label data-ie-field>
        <span>${escapeHtml(t('dataExchange.deviceLabel'))}</span>
        <input id="device_label" name="device_label" type="text" value="${escapeHtml(settings.device_label || '')}" data-change="updateRemoteDraft"${busy ? ' disabled' : ''}>
      </label>
      ${isGoogleDrive ? `
      <div data-ie-inline-fields data-ie-field-full>
        <label data-ie-field>
          <span>${escapeHtml(t('dataExchange.autoSyncEnable'))}</span>
          <input
            id="remote_auto_sync_enabled"
            name="remote_auto_sync_enabled"
            type="checkbox"
            data-change="updateRemoteDraft"
            ${settings.remote_auto_sync_enabled ? ' checked' : ''}
            ${busy ? ' disabled' : ''}
          >
          ${renderFieldHelp(t('dataExchange.autoSyncHelp'))}
        </label>
        ${settings.remote_auto_sync_enabled ? `
        <label data-ie-field>
          <span>${escapeHtml(t('dataExchange.autoSyncInterval'))}</span>
          <input
            id="remote_auto_sync_interval_minutes"
            name="remote_auto_sync_interval_minutes"
            type="number"
            min="1"
            step="1"
            value="${settings.remote_auto_sync_interval_minutes ?? 10}"
            data-change="updateRemoteDraft"
            ${busy ? ' disabled' : ''}
          >
        </label>
        <label data-ie-field>
          <span>${escapeHtml(t('dataExchange.syncIndicatorInRail'))}</span>
          <input
            id="remote_sync_indicator"
            name="remote_sync_indicator"
            type="checkbox"
            data-change="updateRemoteDraft"
            ${widgetSettings.remote_sync_indicator ? ' checked' : ''}
            ${busy ? ' disabled' : ''}
          >
        </label>
        ` : ''}
      </div>
      ` : ''}
      <label data-ie-field data-ie-field-full>
        <span>${escapeHtml(t('dataExchange.archiveRetention'))}</span>
        <input
          id="remote_archive_keep_latest_count"
          name="remote_archive_keep_latest_count"
          type="number"
          min="1"
          step="1"
          value="${settings.remote_archive_keep_latest_count ?? ''}"
          data-change="updateRemoteDraft"
          ${busy ? ' disabled' : ''}
        >
        ${renderFieldHelp(t('dataExchange.archiveRetentionHelp'))}
      </label>
      ${isGoogleDrive ? `
      ` : `
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
      `}
      ` : ''}
    </div>
  `
}

function renderDeepCheckPanel(state) {
  return region('deep-check', `
    <section data-ie-panel>
      ${renderDeepCheck(state)}
    </section>
  `)
}

function renderResetPanel(state) {
  const providerType = state.remoteDraft?.remote_provider_type || state.localSettings?.remote_provider_type || ''
  const showRemoteReset = providerType === 'gdrive'

  return region('reset', `
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
        ${renderStatusForArea(state, 'reset')}
        ${renderTransferForArea(state, 'reset')}
        ${showRemoteReset ? `
        <div data-ie-block data-tone="error">
          <p>${escapeHtml(t('cleanup.resetRemoteHelp'))}</p>
          <hr>
          <div data-ie-actions>
            <button
              type="button"
              data-click="wipeRemoteData"
              data-btn="danger"
              ${state.busy.remoteConfig ? 'disabled' : ''}
            >${escapeHtml(t('cleanup.resetRemote'))}</button>
          </div>
        </div>
        ` : ''}
        <div data-ie-block data-tone="error">
          <p>${escapeHtml(t('cleanup.resetWarning'))}</p>
          <p>${escapeHtml(t('cleanup.resetDatabaseHelp'))}</p>
          <hr>
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
  `)
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

      ${region('global', `
        ${renderStatusForArea(state, '')}
        ${renderTransferForArea(state, '')}
      `)}

      ${region('local', `
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
        ${renderStatusForArea(state, 'local')}
        ${renderTransferForArea(state, 'local')}
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
      `)}

      ${renderDeepCheckPanel(state)}

      ${region('remote-config', `
      <section data-ie-panel>
        <div data-ie-panel-head>
          <div>
            <p data-ie-section-kicker>${escapeHtml(t('dataExchange.remoteConfiguration'))}</p>
            <h2 data-ie-section-title>${escapeHtml(t('dataExchange.remoteSync'))}</h2>
          </div>
          ${state.remoteDraft?.remote_provider_type ? `
          <div data-ie-actions>
            <button type="button" data-click="saveRemoteConfig" data-btn="primary"${state.busy.remoteConfig || state.remoteConfigValidationMessage ? ' disabled' : ''}>${escapeHtml(t('dataExchange.saveRemote'))}</button>
            <button type="button" data-click="testRemoteConfig" data-btn="success"${state.busy.remoteConfig ? ' disabled' : ''}>${escapeHtml(t('dataExchange.testConnection'))}</button>
            <button type="button" data-click="clearRemoteConfig" data-btn="danger"${state.busy.remoteConfig ? ' disabled' : ''}>${escapeHtml(t('dataExchange.clearRemote'))}</button>
          </div>
          ` : ''}
        </div>
        ${renderStatusForArea(state, 'remote-config')}
        ${renderTransferForArea(state, 'remote-config')}
        ${renderRemoteForm(state)}
        ${renderRemoteAutoSync(state)}
        ${state.remoteDraft?.remote_provider_type ? `
        <footer data-ie-panel-footer>
          <p data-ie-copy>${escapeHtml(
            state.remoteDraft?.remote_provider_type === 'gdrive'
              ? t('dataExchange.gdriveSplitHelp')
              : t('dataExchange.remoteConfigurationHelp')
          )}</p>
        </footer>
        ` : ''}
      </section>
      `)}

      ${state.remoteDraft?.remote_provider_type ? region('remote-sync', `
      <section data-ie-panel>
        ${(() => {
          const { isRemoteMissing } = getRemoteSyncRenderState(state)
          return `
        <div data-ie-panel-head>
          <div>
            <p data-ie-section-kicker>${escapeHtml(t('dataExchange.remoteSync'))}</p>
            <h2 data-ie-section-title>${escapeHtml(state.remoteActivity || t('dataExchange.noRemoteActivity'))}</h2>
          </div>
          <div data-ie-actions>
            <button type="button" data-click="refreshRemoteCompare" data-btn="ghost"${state.busy.remoteCheck ? ' disabled' : ''}>${escapeHtml(t('dataExchange.checkStatus'))}</button>
            <button type="button" data-click="previewRemotePull" data-btn="ghost"${state.busy.remotePreview ? ' disabled' : ''}>${escapeHtml(t('dataExchange.checkRemoteContents'))}</button>
            <button type="button" data-click="pushRemoteWorkspace" data-btn="ghost"${state.busy.remotePush ? ' disabled' : ''} title="${escapeHtml(t('dataExchange.pushOverwriteTitle'))}">${escapeHtml(t('dataExchange.pushToRemote'))}</button>
            <button type="button" data-click="pullRemoteWorkspace" data-btn="ghost"${state.busy.remotePull || isRemoteMissing ? ' disabled' : ''}>${escapeHtml(t('dataExchange.pullFromRemote'))}</button>
            <button type="button" data-click="downloadRemoteExport" data-btn="ghost"${state.busy.remoteDownload || isRemoteMissing ? ' disabled' : ''}>${escapeHtml(t('dataExchange.downloadRemoteExport'))}</button>
          </div>
        </div>
        `
        })()}
        ${renderStatusForArea(state, 'remote-sync')}
        ${renderTransferForArea(state, 'remote-sync')}
        ${renderRemoteCompare(state)}
        ${renderRemotePackageOverview(state)}
        ${renderRemoteArchives(state)}
        ${renderRemoteHealth(state)}
        ${renderRemotePreviewSummary(state.remotePreviewSummary)}
        ${renderCurrentWorkspaceSummary(state)}
        ${renderWarnings(state.remoteWarnings)}
      </section>
      `) : ''}

      ${renderResetPanel(state)}

      <input id="workspace_import_file" name="workspace_import_file" type="file" accept="application/json,.json" hidden>
    </div>
  `
}
