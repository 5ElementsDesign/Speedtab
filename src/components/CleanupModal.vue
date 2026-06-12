<script setup lang="ts">
import { refreshStaleFavicons } from '@/composables/useFavicon'
import { type CleanupCandidates, getCleanupCandidates, type CleanupReport } from '@/composables/useMaintenance'
import { db } from '@/db/db'
import type { Asset } from '@/types/db'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from './Modal.vue'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
  completed: [report: CleanupReport, refreshedFavicons: number]
}>()
const { t } = useI18n()

const loading = ref(false)
const applying = ref(false)
const assetsExpanded = ref(false)
const refreshFavicons = ref(true)
const resetOptionsOpen = ref(false)
const resettingDatabase = ref(false)
const assetPreviewUrls = ref<Record<number, string>>({})
const candidates = ref<CleanupCandidates>({
  modules: [],
  collections: [],
  tabs: [],
  notes: [],
  feedSources: [],
  feedItems: [],
  savedFeedItems: [],
  unusedAssets: [],
})

const selected = ref({
  modules: new Set<number>(),
  collections: new Set<number>(),
  tabs: new Set<number>(),
  notes: new Set<number>(),
  feedSources: new Set<number>(),
  feedItems: new Set<number>(),
  savedFeedItems: new Set<number>(),
  unusedAssets: new Set<number>(),
})

function resetSelection() {
  selected.value = {
    modules: new Set(candidates.value.modules.map((item) => item.id!).filter((id): id is number => typeof id === 'number')),
    collections: new Set(candidates.value.collections.map((item) => item.id!).filter((id): id is number => typeof id === 'number')),
    tabs: new Set(candidates.value.tabs.map((item) => item.id!).filter((id): id is number => typeof id === 'number')),
    notes: new Set(candidates.value.notes.map((item) => item.id!).filter((id): id is number => typeof id === 'number')),
    feedSources: new Set(candidates.value.feedSources.map((item) => item.id!).filter((id): id is number => typeof id === 'number')),
    feedItems: new Set(candidates.value.feedItems.map((item) => item.id!).filter((id): id is number => typeof id === 'number')),
    savedFeedItems: new Set(candidates.value.savedFeedItems.map((item) => item.id!).filter((id): id is number => typeof id === 'number')),
    unusedAssets: new Set<number>(),
  }
}

async function loadCandidates() {
  loading.value = true
  try {
    candidates.value = await getCleanupCandidates()
    resetSelection()
    assetsExpanded.value = false
    refreshFavicons.value = true
  } finally {
    loading.value = false
  }
}

watch(() => props.show, (show) => {
  if (show) {
    void loadCandidates()
  }
})

function toggle(set: Set<number>, id: number) {
  if (set.has(id)) set.delete(id)
  else set.add(id)
}

const allUnusedAssetIds = computed<number[]>(() =>
  candidates.value.unusedAssets
    .map((asset) => asset.id)
    .filter((id): id is number => typeof id === 'number'),
)

const allUnusedAssetsSelected = computed<boolean>(() =>
  allUnusedAssetIds.value.length > 0 &&
  allUnusedAssetIds.value.every((id) => selected.value.unusedAssets.has(id)),
)

function toggleAllUnusedAssets() {
  if (allUnusedAssetsSelected.value) {
    selected.value.unusedAssets.clear()
    return
  }
  selected.value.unusedAssets = new Set(allUnusedAssetIds.value)
}

const totalSelected = computed(() =>
  selected.value.modules.size +
  selected.value.collections.size +
  selected.value.tabs.size +
  selected.value.notes.size +
  selected.value.feedSources.size +
  selected.value.feedItems.size +
  selected.value.savedFeedItems.size +
  selected.value.unusedAssets.size
)

const unusedAssetsByKind = computed(() => {
  const groups: Record<Asset['kind'], Asset[]> = {
    background: [],
    preview: [],
    note_image: [],
    favicon: [],
  }
  for (const asset of candidates.value.unusedAssets) {
    groups[asset.kind].push(asset)
  }
  return groups
})

function kindLabel(kind: Asset['kind']) {
  switch (kind) {
    case 'background': return t('cleanup.assetKinds.background')
    case 'preview': return t('cleanup.assetKinds.preview')
    case 'note_image': return t('cleanup.assetKinds.noteImage')
    case 'favicon': return t('cleanup.assetKinds.favicon')
  }
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function revokeAssetPreviewUrls() {
  for (const url of Object.values(assetPreviewUrls.value)) {
    URL.revokeObjectURL(url)
  }
  assetPreviewUrls.value = {}
}

watch(
  () => candidates.value.unusedAssets.map((asset) => `${asset.id}:${asset.checksum}`).join('|'),
  () => {
    revokeAssetPreviewUrls()
    const nextUrls: Record<number, string> = {}
    for (const asset of candidates.value.unusedAssets) {
      if (!asset.id) continue
      nextUrls[asset.id] = URL.createObjectURL(asset.blob)
    }
    assetPreviewUrls.value = nextUrls
  },
  { immediate: true },
)

onBeforeUnmount(revokeAssetPreviewUrls)

async function applyCleanup() {
  if (applying.value) return
  applying.value = true

  const report: CleanupReport = {
    removedModules: 0,
    removedCollections: 0,
    removedTabs: 0,
    removedNotes: 0,
    removedFeedSources: 0,
    removedFeedItems: 0,
    removedSavedFeedItems: 0,
    removedAssets: 0,
  }

  let refreshed = 0

  try {
    await db.transaction(
      'rw',
      [db.modules, db.collections, db.tabs, db.notes, db.feed_sources, db.feed_items, db.saved_feed_items, db.assets],
      async () => {
        if (selected.value.modules.size) {
          const ids = Array.from(selected.value.modules)
          await db.modules.bulkDelete(ids)
          report.removedModules = ids.length
        }
        if (selected.value.collections.size) {
          const ids = Array.from(selected.value.collections)
          await db.collections.bulkDelete(ids)
          report.removedCollections = ids.length
        }
        if (selected.value.tabs.size) {
          const ids = Array.from(selected.value.tabs)
          await db.tabs.bulkDelete(ids)
          report.removedTabs = ids.length
        }
        if (selected.value.notes.size) {
          const ids = Array.from(selected.value.notes)
          await db.notes.bulkDelete(ids)
          report.removedNotes = ids.length
        }
        if (selected.value.feedSources.size) {
          const ids = Array.from(selected.value.feedSources)
          await db.feed_sources.bulkDelete(ids)
          report.removedFeedSources = ids.length
        }
        if (selected.value.feedItems.size) {
          const ids = Array.from(selected.value.feedItems)
          await db.feed_items.bulkDelete(ids)
          report.removedFeedItems = ids.length
        }
        if (selected.value.savedFeedItems.size) {
          const ids = Array.from(selected.value.savedFeedItems)
          await db.saved_feed_items.bulkDelete(ids)
          report.removedSavedFeedItems = ids.length
        }
        if (selected.value.unusedAssets.size) {
          const ids = Array.from(selected.value.unusedAssets)
          await db.assets.bulkDelete(ids)
          report.removedAssets = ids.length
        }
      },
    )

    if (refreshFavicons.value) {
      refreshed = await refreshStaleFavicons()
    }

    emit('completed', report, refreshed)
  } finally {
    applying.value = false
  }
}

async function resetDatabase() {
  if (resettingDatabase.value) return
  const confirmed = confirm(
    t('cleanup.confirmReset')
  )
  if (!confirmed) return

  resettingDatabase.value = true
  try {
    db.close()
    await db.delete()
    window.location.reload()
  } finally {
    resettingDatabase.value = false
  }
}
</script>

<template>
  <Modal :show="show" :title="t('cleanup.title')" @close="emit('close')">
    <div class="space-y-4">
      <p class="text-[11px] text-white/60">
        {{ t('cleanup.intro') }}
      </p>

      <div v-if="loading" class="text-[11px] text-white/60 italic">
        {{ t('cleanup.scanning') }}
      </div>

      <template v-else>
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-[11px] uppercase tracking-wider text-white/75">{{ t('cleanup.orphans') }}</h3>
            <span class="text-[10px] text-white/45">
              {{ candidates.modules.length + candidates.collections.length + candidates.tabs.length + candidates.notes.length + candidates.feedSources.length + candidates.feedItems.length + candidates.savedFeedItems.length }}
            </span>
          </div>

          <div class="max-h-80 overflow-y-auto space-y-3 pr-1">
            <section v-if="candidates.modules.length" class="space-y-1">
              <h4 class="text-[10px] uppercase tracking-wider text-white/55">{{ t('cleanup.modules') }}</h4>
              <label v-for="item in candidates.modules" :key="item.id" class="flex items-start gap-2 text-[11px] text-white/85">
                <input :id="`cleanup-module-${item.id}`" :name="`cleanup_module_${item.id}`" type="checkbox" :checked="selected.modules.has(item.id!)" @change="toggle(selected.modules, item.id!)" />
                <span>{{ item.title || t('cleanup.untitledModule') }}</span>
              </label>
            </section>

            <section v-if="candidates.collections.length" class="space-y-1">
              <h4 class="text-[10px] uppercase tracking-wider text-white/55">{{ t('cleanup.collections') }}</h4>
              <label v-for="item in candidates.collections" :key="item.id" class="flex items-start gap-2 text-[11px] text-white/85">
                <input :id="`cleanup-collection-${item.id}`" :name="`cleanup_collection_${item.id}`" type="checkbox" :checked="selected.collections.has(item.id!)" @change="toggle(selected.collections, item.id!)" />
                <span>{{ item.title || t('cleanup.untitledCollection') }}</span>
              </label>
            </section>

            <section v-if="candidates.tabs.length" class="space-y-1">
              <h4 class="text-[10px] uppercase tracking-wider text-white/55">{{ t('cleanup.bookmarks') }}</h4>
              <label v-for="item in candidates.tabs" :key="item.id" class="flex items-start gap-2 text-[11px] text-white/85">
                <input :id="`cleanup-tab-${item.id}`" :name="`cleanup_tab_${item.id}`" type="checkbox" :checked="selected.tabs.has(item.id!)" @change="toggle(selected.tabs, item.id!)" />
                <span>{{ item.title || item.url }}</span>
              </label>
            </section>

            <section v-if="candidates.notes.length" class="space-y-1">
              <h4 class="text-[10px] uppercase tracking-wider text-white/55">{{ t('cleanup.notes') }}</h4>
              <label v-for="item in candidates.notes" :key="item.id" class="flex items-start gap-2 text-[11px] text-white/85">
                <input :id="`cleanup-note-${item.id}`" :name="`cleanup_note_${item.id}`" type="checkbox" :checked="selected.notes.has(item.id!)" @change="toggle(selected.notes, item.id!)" />
                <span>{{ item.title || t('cleanup.untitledNote') }}</span>
              </label>
            </section>

            <section v-if="candidates.feedSources.length" class="space-y-1">
              <h4 class="text-[10px] uppercase tracking-wider text-white/55">{{ t('cleanup.feedSources') }}</h4>
              <label v-for="item in candidates.feedSources" :key="item.id" class="flex items-start gap-2 text-[11px] text-white/85">
                <input :id="`cleanup-feed-source-${item.id}`" :name="`cleanup_feed_source_${item.id}`" type="checkbox" :checked="selected.feedSources.has(item.id!)" @change="toggle(selected.feedSources, item.id!)" />
                <span>{{ item.title || item.feed_url }}</span>
              </label>
            </section>

            <section v-if="candidates.feedItems.length" class="space-y-1">
              <h4 class="text-[10px] uppercase tracking-wider text-white/55">{{ t('cleanup.feedItems') }}</h4>
              <label v-for="item in candidates.feedItems" :key="item.id" class="flex items-start gap-2 text-[11px] text-white/85">
                <input :id="`cleanup-feed-item-${item.id}`" :name="`cleanup_feed_item_${item.id}`" type="checkbox" :checked="selected.feedItems.has(item.id!)" @change="toggle(selected.feedItems, item.id!)" />
                <span>{{ item.title || item.url || t('cleanup.untitledFeedItem') }}</span>
              </label>
            </section>

            <section v-if="candidates.savedFeedItems.length" class="space-y-1">
              <h4 class="text-[10px] uppercase tracking-wider text-white/55">{{ t('cleanup.archivedFeedItems') }}</h4>
              <label v-for="item in candidates.savedFeedItems" :key="item.id" class="flex items-start gap-2 text-[11px] text-white/85">
                <input :id="`cleanup-saved-feed-item-${item.id}`" :name="`cleanup_saved_feed_item_${item.id}`" type="checkbox" :checked="selected.savedFeedItems.has(item.id!)" @change="toggle(selected.savedFeedItems, item.id!)" />
                <span>{{ item.title || item.url || t('cleanup.untitledArchivedItem') }}</span>
              </label>
            </section>

            <p
              v-if="!candidates.modules.length && !candidates.collections.length && !candidates.tabs.length && !candidates.notes.length && !candidates.feedSources.length && !candidates.feedItems.length && !candidates.savedFeedItems.length"
              class="text-[11px] text-white/40 italic"
            >
              {{ t('cleanup.noOrphans') }}
            </p>
          </div>
        </div>

        <div class="space-y-2 border-t border-white/10 pt-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              @click="assetsExpanded = !assetsExpanded"
              class="text-[11px] uppercase tracking-wider text-white/75 hover:text-white transition-colors"
            >
              {{ assetsExpanded ? t('cleanup.hide') : t('cleanup.show') }} {{ t('cleanup.unusedAssets') }} ({{ candidates.unusedAssets.length }})
            </button>
            <button
              v-if="assetsExpanded && candidates.unusedAssets.length"
              type="button"
              @click="toggleAllUnusedAssets"
              class="text-[10px] uppercase tracking-wider text-white/55 hover:text-white transition-colors"
            >
              {{ allUnusedAssetsSelected ? t('cleanup.clearAll') : t('cleanup.selectAll') }}
            </button>
          </div>

          <div v-if="assetsExpanded" class="max-h-64 overflow-y-auto space-y-3 pr-1">
            <section
              v-for="kind in ['background', 'preview', 'note_image', 'favicon']"
              :key="kind"
              v-show="unusedAssetsByKind[kind as Asset['kind']].length"
              class="space-y-1"
            >
              <h4 class="text-[10px] uppercase tracking-wider text-white/55">{{ kindLabel(kind as Asset['kind']) }}</h4>
              <label
                v-for="asset in unusedAssetsByKind[kind as Asset['kind']]"
                :key="asset.id"
                class="flex items-start gap-2 text-[11px] text-white/85"
              >
                <input :id="`cleanup-asset-${asset.id}`" :name="`cleanup_asset_${asset.id}`" type="checkbox" :checked="selected.unusedAssets.has(asset.id!)" @change="toggle(selected.unusedAssets, asset.id!)" />
                <div class="flex items-start gap-2 min-w-0">
                  <div class="w-[100px] h-[60px] bg-black/30 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                    <img
                      v-if="asset.id && assetPreviewUrls[asset.id]"
                      :src="assetPreviewUrls[asset.id]"
                      :alt="kindLabel(asset.kind)"
                      class="w-full h-full"
                      :class="asset.kind === 'favicon' ? 'object-contain' : 'object-cover'"
                    />
                  </div>
                  <span>#{{ asset.id }} · {{ formatBytes(asset.blob.size) }}</span>
                </div>
              </label>
            </section>

            <p v-if="!candidates.unusedAssets.length" class="text-[11px] text-white/40 italic">
              {{ t('cleanup.noUnusedAssets') }}
            </p>
          </div>
        </div>

        <label class="flex items-center gap-2 text-[11px] text-white/70">
          <input id="cleanup-refresh-favicons" v-model="refreshFavicons" name="cleanup_refresh_favicons" type="checkbox" />
          {{ t('cleanup.refreshFavicons') }}
        </label>

        <div class="space-y-3 border-t border-white/10 pt-3">
          <button
            type="button"
            @click="resetOptionsOpen = !resetOptionsOpen"
            class="text-[11px] uppercase tracking-wider text-white/75 hover:text-white transition-colors"
          >
            {{ resetOptionsOpen ? t('cleanup.hide') : t('cleanup.show') }} {{ t('cleanup.resetOptions') }}
          </button>

          <div v-if="resetOptionsOpen" class="space-y-3 border border-red-500/20 bg-red-950/15 p-3">
            <p class="text-[11px] text-red-100/85">
              {{ t('cleanup.resetWarning') }}
            </p>

            <div class="flex items-center justify-between gap-3 border-t border-red-500/20 pt-3">
              <div>
                <p class="text-[10px] uppercase tracking-wider text-red-200/75">{{ t('cleanup.resetDatabase') }}</p>
                <p class="mt-1 text-[11px] text-red-100/65">
                  {{ t('cleanup.resetDatabaseHelp') }}
                </p>
              </div>
              <button
                type="button"
                :disabled="resettingDatabase || applying"
                @click="resetDatabase"
                class="shrink-0 rounded border border-red-400/30 bg-red-700/80 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {{ resettingDatabase ? t('cleanup.resetting') : t('cleanup.resetDatabase') }}
              </button>
            </div>
          </div>
        </div>
      </template>

      <div class="flex items-center justify-between pt-3 border-t border-white/10">
        <span class="text-[11px] text-white/55">
          {{ t('cleanup.selectedItems', { count: totalSelected }) }}
        </span>

        <div class="flex items-center gap-3">
          <button
            type="button"
            @click="emit('close')"
            class="px-4 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors"
          >
            {{ t('common.close') }}
          </button>
          <button
            type="button"
            :disabled="applying || (!totalSelected && !refreshFavicons)"
            @click="applyCleanup"
            class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition-all disabled:opacity-50"
          >
            {{ applying ? t('cleanup.cleaning') : t('cleanup.applyCleanup') }}
          </button>
        </div>
      </div>
    </div>
  </Modal>
</template>
