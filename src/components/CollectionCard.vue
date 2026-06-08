<script setup lang="ts">
import type { Collection, ModuleType } from '@/types/db';
import FeedsView from './FeedsView.vue';
import NotesView from './NotesView.vue';
import TabsView from './TabsView.vue';

const props = defineProps<{
  collection:  Collection
  moduleType:  ModuleType
  /** Maximum column count from module config_json. `0` means uncapped/infinite. */
  columns:     number
  /** Whether the inline "Add" tile should be shown in tile-based views. */
  showAddTile: boolean
  /** Feed modules can opt into a taller internal reader area. */
  isExpanded?: boolean
  /** Current/remembered expanded width for feed modules. */
  expandedWidth?: 320 | 480 | 740 | 940 | 1240 | 1540 | 'max' | null
  /** Feed modules can auto-refresh while mounted and visible. */
  refreshIntervalMs?: number
  /** Feed modules can optionally limit how many fetched items are shown. */
  feedItemLimit?: number
  /** Temporary local search query for loaded feed items in the active feed tab. */
  feedFilterQuery?: string
  /** Global search URL template for feed item headline search. */
  feedSearchUrlTemplate?: string
  /** Bookmark modules can override whether links open in a new tab. */
  openInNewTab?: boolean | null
  /** Bookmark modules can render as compact quicklinks. */
  quicklinks?: boolean
  /** Quicklinks can optionally ignore custom preview images. */
  forceFavicon?: boolean
  /** Bookmark modules can hide tile hover action buttons. */
  showHoverActions?: boolean
  highlightKind?: 'page' | 'module' | 'collection' | 'bookmark' | 'note' | 'feed_source' | 'archived_feed_item' | null
  highlightEntityId?: number | null
}>()
</script>

<template>
  <div class="st-module-collection min-h-0 h-full">
    <!-- Module-type-specific content -->
    <div class="st-module-collection-content min-h-0 h-full">
      <!-- Tabs module: visual bookmark grid -->
      <TabsView
        v-if="props.moduleType === 'tabs'"
        :collection="props.collection"
        :columns="props.columns"
        :show-add-tile="props.showAddTile"
        :open-in-new-tab="props.openInNewTab"
        :quicklinks="props.quicklinks"
        :force-favicon="props.forceFavicon"
        :show-hover-actions="props.showHoverActions"
        :highlight-tab-id="props.highlightKind === 'bookmark' ? props.highlightEntityId : null"
      />

      <!-- Notes module: tile grid with viewer modal -->
      <NotesView
        v-else-if="props.moduleType === 'notes'"
        :collection="props.collection"
        :columns="props.columns"
        :show-add-tile="props.showAddTile"
        :highlight-note-id="props.highlightKind === 'note' ? props.highlightEntityId : null"
      />

      <!-- Feeds module: aggregated list of RSS/Atom items -->
      <FeedsView
        v-else-if="props.moduleType === 'feeds'"
        :collection="props.collection"
        :expanded="props.isExpanded"
        :expanded-width="props.expandedWidth"
        :refresh-interval-ms="props.refreshIntervalMs"
        :item-limit="props.feedItemLimit"
        :filter-query="props.feedFilterQuery"
        :search-url-template="props.feedSearchUrlTemplate"
        :highlight-source-id="props.highlightKind === 'feed_source' ? props.highlightEntityId : null"
        :highlight-archived-item-id="props.highlightKind === 'archived_feed_item' ? props.highlightEntityId : null"
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
