<script setup lang="ts">
import type { Collection, ModuleType } from '@/types/db';
import FeedsView from './FeedsView.vue';
import NotesView from './NotesView.vue';
import TabsView from './TabsView.vue';

const props = defineProps<{
  collection:  Collection
  moduleType:  ModuleType
  /** Maximum column count from module config_json (1–6). */
  columns:     number
  /** Whether the inline "Add" tile should be shown in tile-based views. */
  showAddTile: boolean
  /** Feed modules can opt into a taller internal reader area. */
  isExpanded?: boolean
  /** Feed modules can auto-refresh while mounted and visible. */
  refreshIntervalMs?: number
  /** Feed modules can optionally limit how many fetched items are shown. */
  feedItemLimit?: number
  /** Bookmark modules can override whether links open in a new tab. */
  openInNewTab?: boolean | null
}>()
</script>

<template>
  <div class="st-module-collection min-h-0 h-full">
    <!-- Module-type-specific content -->
    <div class="st-module-collection-content min-h-0 h-full">
      <!-- Tabs module: visual 98×56 bookmark grid -->
      <TabsView
        v-if="props.moduleType === 'tabs'"
        :collection="props.collection"
        :columns="props.columns"
        :show-add-tile="props.showAddTile"
        :open-in-new-tab="props.openInNewTab"
      />

      <!-- Notes module: tile grid with viewer modal -->
      <NotesView
        v-else-if="props.moduleType === 'notes'"
        :collection="props.collection"
        :show-add-tile="props.showAddTile"
      />

      <!-- Feeds module: aggregated list of RSS/Atom items -->
      <FeedsView
        v-else-if="props.moduleType === 'feeds'"
        :collection="props.collection"
        :expanded="props.isExpanded"
        :refresh-interval-ms="props.refreshIntervalMs"
        :item-limit="props.feedItemLimit"
      />

      <!-- Unknown / Future modules -->
      <div v-else class="bg-white/[0.02] border border-white/10 p-2 text-center">
        <p class="text-[11px] text-white/50 italic">
          Unknown module type: {{ props.moduleType }}
        </p>
      </div>
    </div>
  </div>
</template>
