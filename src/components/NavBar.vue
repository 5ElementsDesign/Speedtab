<script setup lang="ts">
import { useDragSort } from '@/composables/useDragSort'
import type { Page } from '@/types/db'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Dropdown from './Dropdown.vue'

// ─── Props & emits ────────────────────────────────────────────────────────────

interface Props {
  pages:      Page[]
  activePage: Page | null
  captureCount?: number
  exportPending?: boolean
  exportReminderLabel?: string | null
  searchOpen?: boolean
  searchQuery?: string
}

const props = defineProps<Props>()
const { t } = useI18n()

const emit = defineEmits<{
  toggleHelpers: []
  navigate:     [page: Page]
  addPage:      []
  editPage:     [page: Page]
  addModule:    []
  /** Drag-and-drop: fromIndex / toIndex within the *full* page list. */
  movePage:     [fromIndex: number, toIndex: number]
  openDataExchange: []
  cleanupData:  []
  openSettings: []
  openAssets:   []
  copyUrl:      []
  openCaptureInbox: []
  updateSearchOpen: [open: boolean]
  updateSearchQuery: [query: string]
  searchFocus: []
}>()

// ─── Page partitions ──────────────────────────────────────────────────────────

const mainPages     = computed(() => props.pages.filter(p => p.nav_group === 'main'))
const overflowPages = computed(() => props.pages.filter(p => p.nav_group === 'overflow'))

// ─── Drag-and-drop on the main nav row ────────────────────────────────────────
// `mainPages` is a view of the full list, so we translate the local drag
// indices back into the global indices the parent's reorder helper expects.

const dnd = useDragSort({
  onReorder(fromLocal, toLocal) {
    const list = mainPages.value
    const fromGlobal = props.pages.findIndex(p => p.id === list[fromLocal].id)
    const toGlobal   = props.pages.findIndex(p => p.id === list[toLocal].id)
    if (fromGlobal < 0 || toGlobal < 0) return
    emit('movePage', fromGlobal, toGlobal)
  },
})

const searchInput = ref<HTMLInputElement | null>(null)
const localSearchFocused = ref(false)
const inboxItemsLabel = computed(() =>
  (props.captureCount ?? 0) === 1
    ? t('nav.inboxItemSingular')
    : t('nav.inboxItemPlural'),
)

watch(() => props.searchOpen, async (open) => {
  if (!open) return
  await nextTick()
  searchInput.value?.focus()
})

function openSearch() {
  emit('updateSearchOpen', true)
  emit('searchFocus')
  void nextTick(() => searchInput.value?.focus())
}

function handleSearchBlur() {
  localSearchFocused.value = false
  window.setTimeout(() => {
    if (!localSearchFocused.value && !(props.searchQuery?.trim())) {
      emit('updateSearchOpen', false)
    }
  }, 120)
}
</script>

<template>
  <header
    class="
      st-app-header
      flex items-center gap-1 shrink-0
      bg-black/65 border-b border-white/10 leading-none
      px-3 h-10
    "
  >
    <!-- Brand mark -->
    <button
      type="button"
      class="text-[11px] font-semibold text-white/90 select-none mr-3 shrink-0 flex items-center gap-1 hover:text-white hover:bg-white/5 px-1.5 min-h-[28px]"
      :title="t('nav.helpers')"
      :aria-label="t('nav.helpers')"
      @click="emit('toggleHelpers')"
    >
      <span class="st-h-icon">⚡</span> <span class="st-h-title hidden sm:inline">Speedtab</span>
    </button>

    <!-- Main nav page tabs (scrollable + drag-to-reorder) -->
    <nav
      class="flex items-center gap-1 flex-1 overflow-x-auto min-w-0 h-full"
      style="scrollbar-width: none"
      role="tablist"
      :aria-label="t('nav.pages')"
    >
      <button
        v-for="(page, idx) in mainPages"
        :key="page.id"
        v-bind="dnd.bindFor(idx)"
        @click="emit('navigate', page)"
        @contextmenu.prevent="emit('editPage', page)"
        class="
          flex items-center gap-1.5 px-3 min-h-[32px]
          text-[11px] font-normal whitespace-nowrap transition-colors cursor-grab active:cursor-grabbing
          border border-transparent
          focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40
        "
        :class="[
          activePage?.id === page.id
            ? 'bg-white/15 text-white'
            : 'text-[#a0a0a0] hover:text-white hover:bg-white/5',
          dnd.draggingIndex.value === idx ? 'opacity-40' : '',
          dnd.dragOverIndex.value === idx && dnd.draggingIndex.value !== idx
            ? 'ring-1 ring-white/40'
            : '',
        ]"
        role="tab"
        :aria-selected="activePage?.id === page.id"
        :title="t('nav.rightClickDragHint', { title: page.title })"
      >
        <span v-if="page.icon" class="shrink-0">{{ page.icon }}</span>
        <span :class="page.icon && activePage?.id !== page.id ? 'hidden sm:inline' : 'inline'">{{ page.title }}</span>
      </button>

      <Dropdown
        v-if="overflowPages.length > 0"
        :label="t('nav.morePages')"
        :title="t('nav.morePages')"
        align="left"
        trigger-class="px-3 min-h-[28px] text-[11px] text-[#a0a0a0] hover:text-white hover:bg-white/5 shrink-0 flex items-center"
      >
        <template #trigger>{{ t('nav.more') }}</template>

        <div class="px-[0.1rem]">
          <button
            v-for="page in overflowPages"
            :key="page.id"
            @click="emit('navigate', page)"
            @contextmenu.prevent="emit('editPage', page)"
            class="w-full text-left px-2 py-1 text-[11px] font-normal hover:bg-white/10 flex items-center gap-2 focus:outline-none focus-visible:bg-white/10"
            :class="activePage?.id === page.id ? 'text-white bg-white/5' : 'text-[#a0a0a0]'"
          >
            <span v-if="page.icon" class="shrink-0">{{ page.icon }}</span>
            {{ page.title }}
          </button>
        </div>
      </Dropdown>

    </nav>

    <button
      v-if="(captureCount ?? 0) > 0"
      type="button"
      @click="emit('openCaptureInbox')"
      class="px-2 min-h-[28px] text-[10px] uppercase tracking-wider text-white/85 hover:text-white hover:bg-white/5 shrink-0 flex items-center gap-1"
      :title="t('nav.inboxWaiting', { count: captureCount ?? 0, itemsLabel: inboxItemsLabel })"
    >
      {{ t('nav.inbox') }}
      <span class="px-1 rounded-sm bg-white/15 text-[9px] leading-none">{{ captureCount }}</span>
    </button>

    <div class="shrink-0 flex items-center min-w-0" data-speedtab-search>
      <button
        v-if="!searchOpen"
        type="button"
        @click="openSearch"
        class="px-2 min-h-[28px] text-white/70 hover:text-white hover:bg-white/5 shrink-0 flex items-center justify-center"
        :title="t('common.search')"
        :aria-label="t('nav.openSearch')"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M8.5 3a5.5 5.5 0 014.33 8.89l3.64 3.64a1 1 0 01-1.41 1.41l-3.64-3.64A5.5 5.5 0 118.5 3zm0 2a3.5 3.5 0 100 7 3.5 3.5 0 000-7z" clip-rule="evenodd" />
        </svg>
      </button>
      <div
        v-else
        class="w-full transition-all duration-150 ease-out"
        style="max-width: 220px;"
      >
        <input
          ref="searchInput"
          id="workspace-search"
          name="workspace_search"
          :value="searchQuery || ''"
          type="search"
          :placeholder="t('app.searchPlaceholder')"
          class="w-full h-7 px-2 text-[11px] bg-white/10 border border-white/10 text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
          @focus="localSearchFocused = true; emit('updateSearchOpen', true); emit('searchFocus')"
          @click="emit('searchFocus')"
          @blur="handleSearchBlur"
          @input="emit('updateSearchQuery', ($event.target as HTMLInputElement).value)"
          @keydown.escape="emit('updateSearchQuery', ''); emit('updateSearchOpen', false)"
        />
      </div>
    </div>

    <!-- Page-level actions dropdown -->
    <Dropdown
      :label="t('nav.pageActions')"
      :title="t('nav.pageActions')"
      align="right"
      trigger-class="px-3 min-h-[28px] text-[10px] leading-normal uppercase tracking-wider text-[#a0a0a0] hover:text-white hover:bg-white/5 shrink-0 flex items-center"
    >
      <template #trigger>{{ t('nav.page') }}</template>

      <div class="px-[0.1rem]">
        <button
          type="button"
          role="menuitem"
          :disabled="!activePage"
          @click="activePage && emit('editPage', activePage)"
          class="w-full text-left px-2 py-1 text-[11px] text-white/90 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          {{ t('nav.actions.editPage') }}
        </button>
        <button
          type="button"
          role="menuitem"
          @click="emit('addPage')"
          class="w-full text-left px-2 py-1 text-[11px] text-white/90 hover:bg-white/10"
        >
          {{ t('nav.actions.addPage') }}
        </button>
      </div>
      <hr class="my-1 border-0 border-t border-white/10" />
      <div class="px-[0.1rem]">
        <button
          type="button"
          role="menuitem"
          :disabled="!activePage"
          @click="emit('addModule')"
          class="w-full text-left px-2 py-1 text-[11px] text-white/90 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          {{ t('nav.actions.addModule') }}
        </button>
      </div>
      <hr class="my-1 border-0 border-t border-white/10" />
      <div class="px-[0.1rem]">
        <button
          type="button"
          role="menuitem"
          :disabled="!activePage"
          @click="emit('copyUrl')"
          class="w-full text-left px-2 py-1 text-[11px] text-white/90 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          {{ t('nav.actions.copyUrl') }}
        </button>
      </div>
    </Dropdown>

    <!-- Utility / settings cluster -->
    <div class="ml-2 shrink-0 flex items-center gap-1">
      <Dropdown
        :label="t('common.settings')"
        :title="t('nav.settingsAndMaintenance')"
        align="right"
        :hide-chevron="true"
        trigger-class="p-1.5 min-h-[28px] min-w-[28px] flex items-center justify-center text-white/70 hover:text-white hover:bg-white/5"
      >
        <template #trigger>
          <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
              clip-rule="evenodd"
            />
          </svg>
        </template>

        <div class="px-[0.1rem]">
          <button
            type="button"
            role="menuitem"
            @click="emit('openSettings')"
            class="w-full text-left px-2 py-1 text-[11px] text-white/90 hover:bg-white/10"
          >
            {{ t('nav.actions.settings') }}
          </button>
        </div>
        <hr class="my-1 border-0 border-t border-white/10" />
        <div class="px-[0.1rem]">
          <button
            type="button"
            role="menuitem"
            @click="emit('openDataExchange')"
            class="w-full text-left px-2 py-1 text-[11px] text-white/90 hover:bg-white/10 flex items-center justify-between gap-3"
          >
            <span>{{ t('nav.actions.dataExchange') }}</span>
            <span
              v-if="exportPending"
              class="rounded-sm bg-amber-400/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-amber-200"
              :title="exportReminderLabel ? `${t('nav.exportNeeded')}: ${exportReminderLabel}` : t('nav.exportNeeded')"
            >
              {{ t('nav.localExport') }}
            </span>
          </button>
        </div>
        <hr class="my-1 border-0 border-t border-white/10" />
        <div class="px-[0.1rem]">
          <button
            type="button"
            role="menuitem"
            @click="emit('openAssets')"
            class="w-full text-left px-2 py-1 text-[11px] text-white/90 hover:bg-white/10"
          >
            {{ t('nav.actions.assets') }}
          </button>
          <button
            type="button"
            role="menuitem"
            @click="emit('cleanupData')"
            class="w-full text-left px-2 py-1 text-[11px] text-white/90 hover:bg-white/10"
          >
            {{ t('nav.actions.cleanup') }}
          </button>
        </div>
      </Dropdown>
    </div>
  </header>
</template>
