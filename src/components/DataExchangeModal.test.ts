import { createTestI18n } from '@/test/createTestI18n'
import { DEFAULT_REMOTE_LOCAL_SETTINGS, type RemoteLocalSettings } from '@/types/remote'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import DataExchangeModal from './DataExchangeModal.vue'

const exchangeMocks = vi.hoisted(() => ({
  inspectRemotePush: vi.fn(),
  previewRemotePull: vi.fn(),
  pullFromRemote: vi.fn(),
  pushToRemote: vi.fn(),
  verifyRemoteHealth: vi.fn(),
  downloadRemoteExportArtifact: vi.fn(),
  getCompareActions: vi.fn((state: string) => {
    switch (state) {
      case 'identical':
      case 'up_to_date':
        return ['download_remote']
      case 'remote_missing':
      case 'local_newer':
        return ['push', 'download_remote']
      case 'remote_newer':
        return ['pull', 'download_both']
      case 'divergent':
      case 'version_mismatch':
      case 'unknown_endpoint_context':
        return ['push', 'pull', 'download_both']
      default:
        return []
    }
  }),
}))

const localSettingsMocks = vi.hoisted(() => ({
  getLocalSettings: vi.fn(),
  updateLocalSettings: vi.fn(),
  clearRemoteProviderSettings: vi.fn(),
}))

const remoteProviderMocks = vi.hoisted(() => ({
  isRemoteProviderConfigured: vi.fn((settings: RemoteLocalSettings | null) =>
    !!settings?.remote_provider_type && !!settings?.remote_endpoint_url,
  ),
  createRemoteExportProvider: vi.fn(() => ({
    testConnection: vi.fn(async () => ({ ok: true, value: { provider_id: 'provider-hash' } })),
    downloadExport: vi.fn(async () => ({ ok: true, value: new Blob(['{"version":2,"exported_at":"2026-05-31T09:00:00.000Z","pages":[],"modules":[],"collections":[],"tabs":[],"notes":[],"feed_sources":[],"saved_feed_items":[],"assets":[]}'], { type: 'application/json' }) })),
  })),
}))

vi.mock('@/composables/useRemoteExchange', () => exchangeMocks)
vi.mock('@/composables/useLocalSettings', () => localSettingsMocks)
vi.mock('@/composables/useRemoteProvider', () => remoteProviderMocks)
vi.mock('@/composables/useLiveQuery', () => ({
  useLiveQuery: () => ({
    data: ref({
      pages: 1,
      modules: 2,
      collections: 3,
      tabs: 4,
      notes: 5,
      feedSources: 6,
      savedFeedItems: 7,
      assets: 8,
    }),
    loading: ref(false),
    error: ref(null),
  }),
}))
vi.mock('./Modal.vue', () => ({
  default: {
    props: ['show', 'title'],
    emits: ['close'],
    template: `
      <div v-if="show" class="modal-stub">
        <div class="modal-title">
          <span>{{ title }}</span>
          <slot name="header-actions" />
        </div>
        <slot />
      </div>
    `,
  },
}))

function configuredSettings(overrides: Partial<RemoteLocalSettings> = {}): RemoteLocalSettings {
  return {
    ...DEFAULT_REMOTE_LOCAL_SETTINGS,
    remote_provider_type: 'webdav',
    remote_endpoint_url: 'https://dav.example.com/root',
    remote_username: 'alice',
    remote_secret: 'secret-token',
    remote_path: '/speedtab',
    device_label: 'desktop',
    ...overrides,
  }
}

function makeInspection(state: string) {
  return {
    state,
    archiveExists: false,
    local: {
      manifest: {
        version: 2,
        exported_at: '2026-05-31T10:00:00.000Z',
        pages: [],
        modules: [],
        collections: [],
        tabs: [],
        notes: [],
        feed_sources: [],
        saved_feed_items: [],
        assets: [],
      },
      checksum: 'local-checksum',
      exportBlob: new Blob(['{}'], { type: 'application/json' }),
      metadata: {
        manifest_version: 2,
        app_version: '1.1.0',
        exported_at: '2026-05-31T10:00:00.000Z',
        workspace_checksum: 'local-checksum',
        source_device_label: 'desktop',
        provider_endpoint_hash: 'provider-hash',
      },
    },
    remote: state === 'remote_missing'
      ? null
      : {
          provider_id: 'provider-hash',
          meta: {
            manifest_version: 2,
            app_version: '1.1.0',
            exported_at: '2026-05-31T09:00:00.000Z',
            workspace_checksum: state === 'identical' ? 'local-checksum' : 'remote-checksum',
            source_device_label: 'desktop',
            provider_endpoint_hash: 'provider-hash',
          },
          export_exists: true,
          meta_exists: true,
          export_size_bytes: 512,
          warnings: [],
        },
    warnings: [],
  }
}

function makePullPreview(state = 'ready') {
  return {
    state,
    remoteMeta: {
      manifest_version: 2,
      app_version: '1.1.0',
      exported_at: '2026-05-31T09:00:00.000Z',
      workspace_checksum: 'remote-checksum',
      source_device_label: 'desktop',
      provider_endpoint_hash: 'provider-hash',
    },
    providerId: 'provider-hash',
    warnings: [],
  }
}

function makeHealth(health = 'healthy') {
  return {
    health,
    providerId: 'provider-hash',
    remote: null,
    message: health === 'healthy' ? 'Remote metadata is consistent.' : 'Remote requires attention.',
    guidance: health === 'healthy' ? 'No repair action needed.' : 'Repair the remote export before pulling.',
    repairActions: health === 'healthy' ? ['verify'] : ['push', 'verify'],
    warnings: [],
  }
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function findButton(wrapper: VueWrapper, label: string) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text().trim() === label)
  expect(button, `Expected button "${label}" to exist`).toBeDefined()
  return button!
}

function findInputByPlaceholder(wrapper: VueWrapper, placeholder: string) {
  const input = wrapper.find(`input[placeholder="${placeholder}"]`)
  expect(input.exists(), `Expected input with placeholder "${placeholder}" to exist`).toBe(true)
  return input
}

function findInputByName(wrapper: VueWrapper, name: string) {
  const input = wrapper.find(`input[name="${name}"]`)
  expect(input.exists(), `Expected input named "${name}" to exist`).toBe(true)
  return input
}

function findSelect(wrapper: VueWrapper) {
  const select = wrapper.find('select[name="remote_provider_type"]')
  expect(select.exists(), 'Expected provider select to exist').toBe(true)
  return select
}

function mountDataExchangeModal() {
  return mount(DataExchangeModal, {
    props: {
      show: true,
    },
    global: {
      plugins: [createTestI18n()],
    },
  })
}

describe('DataExchangeModal', () => {
  beforeEach(() => {
    localSettingsMocks.getLocalSettings.mockResolvedValue(configuredSettings())
    localSettingsMocks.updateLocalSettings.mockImplementation(async (patch: Partial<RemoteLocalSettings>) => configuredSettings(patch))
    localSettingsMocks.clearRemoteProviderSettings.mockResolvedValue(configuredSettings({
      remote_provider_type: null,
      remote_endpoint_url: null,
      remote_username: null,
      remote_secret: null,
      remote_path: null,
      device_label: null,
    }))
    exchangeMocks.inspectRemotePush.mockResolvedValue(makeInspection('local_newer'))
    exchangeMocks.previewRemotePull.mockResolvedValue(makePullPreview())
    exchangeMocks.verifyRemoteHealth.mockResolvedValue(makeHealth())
    exchangeMocks.pushToRemote.mockResolvedValue({
      outcome: 'pushed',
      inspection: makeInspection('identical'),
      warnings: [],
    })
    exchangeMocks.pullFromRemote.mockResolvedValue({
      preview: makePullPreview(),
      report: {
        pages: 0,
        modules: 0,
        collections: 0,
        tabs: 0,
        notes: 0,
        feed_sources: 0,
        feed_items: 0,
        saved_feed_items: 0,
        assets: 0,
        assets_deduped: 0,
        dry_run: false,
        manifest_version: 2,
      },
      cleanup: {
        removedModules: 0,
        removedCollections: 0,
        removedTabs: 0,
        removedNotes: 0,
        removedFeedSources: 0,
        removedFeedItems: 0,
        removedSavedFeedItems: 0,
        removedAssets: 0,
      },
    })
    exchangeMocks.downloadRemoteExportArtifact.mockResolvedValue({
      blob: new Blob(['{}'], { type: 'application/json' }),
      filename: 'speedtab-remote-export.json',
    })
    remoteProviderMocks.createRemoteExportProvider.mockReset()
    remoteProviderMocks.createRemoteExportProvider.mockImplementation(() => ({
      testConnection: vi.fn(async () => ({ ok: true, value: { provider_id: 'provider-hash' } })),
      downloadExport: vi.fn(async () => ({ ok: true, value: new Blob(['{"version":2,"exported_at":"2026-05-31T09:00:00.000Z","pages":[],"modules":[],"collections":[],"tabs":[],"notes":[],"feed_sources":[],"saved_feed_items":[],"assets":[]}'], { type: 'application/json' }) })),
    }))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('shows transfer progress while verify is in flight and settles after it resolves', async () => {
    const wrapper = mountDataExchangeModal()

    await flushPromises()
    const deferred = createDeferred<ReturnType<typeof makeInspection>>()
    exchangeMocks.inspectRemotePush.mockImplementationOnce(() => deferred.promise)

    await findButton(wrapper, 'Check Status').trigger('click')
    await flushPromises()
    await wait(200)

    expect(wrapper.text()).toContain('Transfer Active')
    expect(wrapper.text()).toContain('Verifying remote compare')

    deferred.resolve(makeInspection('identical'))
    await flushPromises()

    expect(wrapper.text()).not.toContain('Transfer Active')
    expect(wrapper.text()).toContain('Remote and local are identical')
    expect(wrapper.text()).toContain('Remote Sync')
  })

  it('suppresses push nagging when the current checksum is already archived remotely', async () => {
    exchangeMocks.inspectRemotePush.mockResolvedValue({
      ...makeInspection('remote_missing'),
      archiveExists: true,
    })

    const wrapper = mountDataExchangeModal()

    await flushPromises()
    await wait(50)

    expect(wrapper.text()).toContain('Remote missing')
    expect(wrapper.text()).not.toContain('Remote archive contains this checksum')
    expect(wrapper.text()).toContain('Push only if you want the live remote export updated too.')

    await findButton(wrapper, 'Show').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Remote archive contains this checksum')
  })

  it('cancels an in-flight verify when the user clicks Cancel Transfer', async () => {
    const wrapper = mountDataExchangeModal()

    await flushPromises()
    let aborted = false
    exchangeMocks.inspectRemotePush.mockImplementationOnce(({ signal }: { signal?: AbortSignal } = {}) =>
      new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          aborted = true
          reject(new Error('verification aborted'))
        }, { once: true })
      }),
    )

    await findButton(wrapper, 'Check Status').trigger('click')
    await flushPromises()
    await wait(200)
    await findButton(wrapper, 'Cancel Transfer').trigger('click')
    await flushPromises()

    expect(aborted).toBe(true)
    expect(wrapper.text()).not.toContain('Transfer Active')
    expect(wrapper.text()).toContain('Remote check failed: verification aborted')
  })

  it('aborts an in-flight verify when the modal closes', async () => {
    const wrapper = mountDataExchangeModal()

    await flushPromises()
    let aborted = false
    exchangeMocks.inspectRemotePush.mockImplementationOnce(({ signal }: { signal?: AbortSignal } = {}) =>
      new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          aborted = true
          reject(new Error('verification aborted'))
        }, { once: true })
      }),
    )

    await findButton(wrapper, 'Check Status').trigger('click')
    await flushPromises()
    await wrapper.setProps({ show: false })
    await flushPromises()

    expect(aborted).toBe(true)
    expect(wrapper.find('.modal-stub').exists()).toBe(false)
  })

  it('saves remote configuration and clears remote certainty when endpoint identity changes', async () => {
    const wrapper = mountDataExchangeModal()

    await flushPromises()
    await findButton(wrapper, 'Edit Remote').trigger('click')
    await flushPromises()
    await findSelect(wrapper).setValue('webdav')
    await findInputByPlaceholder(wrapper, 'Desktop').setValue('Laptop')
    await findInputByPlaceholder(wrapper, 'https://dav.example.com/root').setValue('https://dav.example.com/next-root')
    await findInputByName(wrapper, 'remote_username').setValue('bob')
    await findInputByName(wrapper, 'remote_secret').setValue('new-secret')
    await findInputByPlaceholder(wrapper, '/speedtab').setValue('/next-speedtab')
    await findButton(wrapper, 'Save The Remote').trigger('click')
    await flushPromises()

    expect(localSettingsMocks.updateLocalSettings).toHaveBeenCalledWith(expect.objectContaining({
      device_label: 'Laptop',
      remote_endpoint_url: 'https://dav.example.com/next-root',
      remote_username: 'bob',
      remote_secret: 'new-secret',
      remote_path: '/next-speedtab',
      last_remote_pull_checksum: null,
      last_remote_push_checksum: null,
      last_remote_seen_checksum: null,
      last_known_local_checksum: null,
    }))
    expect(wrapper.text()).toContain('WEBDAV · /next-speedtab')
  })

  it('tests unsaved remote configuration without persisting it', async () => {
    const testConnection = vi.fn(async () => ({ ok: true, value: { provider_id: 'draft-provider' } }))
    remoteProviderMocks.createRemoteExportProvider.mockImplementation(() => ({
      testConnection,
      downloadExport: vi.fn(async () => ({ ok: true, value: new Blob(['{"version":2,"exported_at":"2026-05-31T09:00:00.000Z","pages":[],"modules":[],"collections":[],"tabs":[],"notes":[],"feed_sources":[],"saved_feed_items":[],"assets":[]}'], { type: 'application/json' }) })),
    }))

    const wrapper = mountDataExchangeModal()

    await flushPromises()
    await findButton(wrapper, 'Edit Remote').trigger('click')
    await flushPromises()
    await findSelect(wrapper).setValue('webdav')
    await findInputByPlaceholder(wrapper, 'Desktop').setValue('Draft Device')
    await findInputByPlaceholder(wrapper, 'https://dav.example.com/root').setValue('https://draft.example.com/root')
    await findInputByName(wrapper, 'remote_username').setValue('draft-user')
    await findInputByName(wrapper, 'remote_secret').setValue('draft-secret')
    await findInputByPlaceholder(wrapper, '/speedtab').setValue('/draft-speedtab')
    await findButton(wrapper, 'Test Remote').trigger('click')
    await flushPromises()

    expect(remoteProviderMocks.createRemoteExportProvider).toHaveBeenCalledWith(expect.objectContaining({
      device_label: 'Draft Device',
      remote_endpoint_url: 'https://draft.example.com/root',
      remote_username: 'draft-user',
      remote_secret: 'draft-secret',
      remote_path: '/draft-speedtab',
    }))
    expect(testConnection).toHaveBeenCalledWith({ timeoutMs: 10_000 })
    expect(localSettingsMocks.updateLocalSettings).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Connection OK · draft-provider')
  })

  it('clears remote configuration and resets compare state', async () => {
    localSettingsMocks.updateLocalSettings.mockResolvedValueOnce(configuredSettings({
      remote_provider_type: null,
      remote_endpoint_url: null,
      remote_username: null,
      remote_secret: null,
      remote_path: null,
      device_label: null,
      last_remote_pull_checksum: null,
      last_remote_push_checksum: null,
      last_remote_seen_checksum: null,
      last_known_local_checksum: null,
    }))

    const wrapper = mountDataExchangeModal()

    await flushPromises()
    await findButton(wrapper, 'Edit Remote').trigger('click')
    await flushPromises()
    await findButton(wrapper, 'Clear Remote').trigger('click')
    await flushPromises()
    expect(localSettingsMocks.clearRemoteProviderSettings).toHaveBeenCalledTimes(1)
    expect(localSettingsMocks.updateLocalSettings).toHaveBeenCalledWith(expect.objectContaining({
      device_label: null,
      last_remote_pull_checksum: null,
      last_remote_push_checksum: null,
      last_remote_seen_checksum: null,
      last_known_local_checksum: null,
    }))
    expect(wrapper.text()).toContain('Remote configuration cleared.')
    expect(wrapper.text()).not.toContain('Remote Sync')
  })

  it('rejects malformed endpoint URLs before save or test', async () => {
    const wrapper = mountDataExchangeModal()

    await flushPromises()
    await findButton(wrapper, 'Edit Remote').trigger('click')
    await flushPromises()
    await findInputByPlaceholder(wrapper, 'https://dav.example.com/root').setValue('not-a-url')
    remoteProviderMocks.createRemoteExportProvider.mockClear()
    await findButton(wrapper, 'Save The Remote').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Endpoint URL must be a valid http:// or https:// URL.')
    expect(localSettingsMocks.updateLocalSettings).not.toHaveBeenCalled()
    expect(remoteProviderMocks.createRemoteExportProvider).not.toHaveBeenCalled()

    await findButton(wrapper, 'Test Remote').trigger('click')
    await flushPromises()

    expect(remoteProviderMocks.createRemoteExportProvider).not.toHaveBeenCalled()
  })
})
