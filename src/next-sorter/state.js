export function createSorterState() {
  return {
    pages: [],
    expandedModules: new Set(),
    collapsedPages: new Set(),
    orphanSlotsByPage: new Map(),
    tabSort: {
      moduleType: null,
      sourceModuleSyncId: null,
    },
    contentSort: {
      moduleType: null,
      sourceModuleSyncId: null,
      contentsByTabSyncId: new Map(),
    },
    status: {
      tone: 'idle',
      text: '',
    },
    drag: {
      kind: null,
      pageSyncId: null,
      moduleSyncId: null,
      sourcePageSyncId: null,
      tabSyncId: null,
      sourceModuleSyncId: null,
      sourceModuleType: null,
      contentId: null,
      contentType: null,
      sourceTabSyncId: null,
      sourceCollectionId: null,
    },
  }
}

export function setSorterPages(state, pages) {
  state.pages = Array.isArray(pages) ? pages : []
}

export function toggleCollapsedPage(state, pageSyncId) {
  if (!pageSyncId) return
  if (state.collapsedPages.has(pageSyncId)) {
    state.collapsedPages.delete(pageSyncId)
    return
  }
  state.collapsedPages.add(pageSyncId)
}

export function isPageCollapsed(state, pageSyncId) {
  return !!pageSyncId && state.collapsedPages.has(pageSyncId)
}

export function toggleExpandedModule(state, moduleSyncId) {
  if (!moduleSyncId) return
  if (state.expandedModules.has(moduleSyncId)) {
    state.expandedModules.delete(moduleSyncId)
    return
  }
  state.expandedModules.add(moduleSyncId)
}

export function isModuleExpanded(state, moduleSyncId) {
  return !!moduleSyncId && state.expandedModules.has(moduleSyncId)
}

export function setSorterStatus(state, text = '', tone = 'idle') {
  state.status = {
    tone,
    text,
  }
}

export function setDragState(state, patch = {}) {
  state.drag = {
    ...state.drag,
    ...patch,
  }
}

export function clearDragState(state) {
  state.drag = {
    kind: null,
    pageSyncId: null,
    moduleSyncId: null,
    sourcePageSyncId: null,
    tabSyncId: null,
    sourceModuleSyncId: null,
    sourceModuleType: null,
    contentId: null,
    contentType: null,
    sourceTabSyncId: null,
    sourceCollectionId: null,
  }
}

export function toggleTabSort(state, moduleType, moduleSyncId) {
  if (!moduleType || !moduleSyncId) {
    state.tabSort = {
      moduleType: null,
      sourceModuleSyncId: null,
    }
    return
  }

  if (state.tabSort.moduleType === moduleType && state.tabSort.sourceModuleSyncId === moduleSyncId) {
    state.tabSort = {
      moduleType: null,
      sourceModuleSyncId: null,
    }
    return
  }

  state.tabSort = {
    moduleType,
    sourceModuleSyncId: moduleSyncId,
  }
}

export function clearTabSort(state) {
  state.tabSort = {
    moduleType: null,
    sourceModuleSyncId: null,
  }
}

export function isTabSortActive(state) {
  return !!state?.tabSort?.moduleType
}

export function setContentSortContents(state, contentsByTabSyncId = new Map()) {
  state.contentSort.contentsByTabSyncId = contentsByTabSyncId instanceof Map
    ? contentsByTabSyncId
    : new Map()
}

export function toggleContentSort(state, moduleType, moduleSyncId) {
  if (!moduleType || !moduleSyncId) {
    state.contentSort = {
      moduleType: null,
      sourceModuleSyncId: null,
      contentsByTabSyncId: new Map(),
    }
    return
  }

  if (state.contentSort.moduleType === moduleType && state.contentSort.sourceModuleSyncId === moduleSyncId) {
    state.contentSort = {
      moduleType: null,
      sourceModuleSyncId: null,
      contentsByTabSyncId: new Map(),
    }
    return
  }

  state.contentSort = {
    moduleType,
    sourceModuleSyncId: moduleSyncId,
    contentsByTabSyncId: state.contentSort.contentsByTabSyncId ?? new Map(),
  }
}

export function clearContentSort(state) {
  state.contentSort = {
    moduleType: null,
    sourceModuleSyncId: null,
    contentsByTabSyncId: new Map(),
  }
}

export function isContentSortActive(state) {
  return !!state?.contentSort?.moduleType
}

export function ensureOrphanSlots(state, pageSyncId) {
  if (!pageSyncId) return []
  const slots = state.orphanSlotsByPage.get(pageSyncId) ?? []
  state.orphanSlotsByPage.set(pageSyncId, slots)
  return slots
}

export function appendOrphanSlot(state, pageSyncId, span = 12) {
  if (!pageSyncId) return null
  const slots = ensureOrphanSlots(state, pageSyncId)
  const slot = {
    id: `orphan:${pageSyncId}:${crypto.randomUUID()}`,
    pageSyncId,
    columnSpan: span,
  }
  slots.push(slot)
  return slot
}

export function removeOrphanSlot(state, pageSyncId, slotId) {
  if (!pageSyncId || !slotId) return
  const slots = ensureOrphanSlots(state, pageSyncId)
  state.orphanSlotsByPage.set(pageSyncId, slots.filter((slot) => slot.id !== slotId))
}

export function clearPageOrphanSlots(state, pageSyncId) {
  if (!pageSyncId) return
  state.orphanSlotsByPage.set(pageSyncId, [])
}
