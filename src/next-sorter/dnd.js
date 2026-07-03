function clearModuleDropIndicators(root) {
  root.querySelectorAll('[data-drop-marker]')
    .forEach((slot) => slot.removeAttribute('data-drop-marker'))

  root.querySelectorAll('[data-sorter-module-lane][data-drop-active]')
    .forEach((lane) => lane.removeAttribute('data-drop-active'))
}

function clearPageDropIndicators(root) {
  root.querySelectorAll('[data-sorter-page][data-page-drop-marker]')
    .forEach((page) => page.removeAttribute('data-page-drop-marker'))
}

function getLaneSlots(lane, draggingSourceSlot = null) {
  return [...lane.querySelectorAll('[data-grid-col]')]
    .filter((slot) => slot !== draggingSourceSlot)
}

function countModuleSlotsBefore(slots, targetSlot) {
  let count = 0
  for (const slot of slots) {
    if (slot === targetSlot) return count
    if (slot.dataset.slotKind === 'module') count += 1
  }
  return count
}

function resolveModuleDrop(lane, draggingSourceSlot, event) {
  const slots = getLaneSlots(lane, draggingSourceSlot)
  const hoveredSlot = event.target.closest?.('[data-grid-col]')

  if (!hoveredSlot || !slots.includes(hoveredSlot)) {
    return {
      targetSlot: null,
      targetIndex: slots.filter((slot) => slot.dataset.slotKind === 'module').length,
      targetSlotId: null,
      targetSlotKind: null,
      marker: null,
    }
  }

  if (hoveredSlot.dataset.slotKind === 'orphan') {
    return {
      targetSlot: hoveredSlot,
      targetIndex: countModuleSlotsBefore(slots, hoveredSlot),
      targetSlotId: hoveredSlot.dataset.slotId || null,
      targetSlotKind: hoveredSlot.dataset.slotKind || null,
      marker: 'inside',
    }
  }

  const rect = hoveredSlot.getBoundingClientRect()
  const isSameRow = event.clientY >= rect.top && event.clientY <= rect.bottom
  const placeBefore = isSameRow
    ? event.clientX < rect.left + (rect.width / 2)
    : event.clientY < rect.top + (rect.height / 2)
  const baseIndex = countModuleSlotsBefore(slots, hoveredSlot)

  return {
    targetSlot: hoveredSlot,
    targetIndex: placeBefore ? baseIndex : baseIndex + 1,
    targetSlotId: hoveredSlot.dataset.slotId || null,
    targetSlotKind: hoveredSlot.dataset.slotKind || null,
    marker: placeBefore ? 'before' : 'after',
  }
}

function clearTabDropIndicators(root) {
  root.querySelectorAll('[data-tab-drop-marker]')
    .forEach((row) => row.removeAttribute('data-tab-drop-marker'))

  root.querySelectorAll('[data-sorter-tab-dropzone][data-drop-active]')
    .forEach((zone) => zone.removeAttribute('data-drop-active'))
}

function clearContentDropIndicators(root) {
  root.querySelectorAll('[data-content-drop-marker]')
    .forEach((row) => row.removeAttribute('data-content-drop-marker'))

  root.querySelectorAll('[data-sorter-content-dropzone][data-drop-active]')
    .forEach((zone) => zone.removeAttribute('data-drop-active'))
}

function getTabRows(dropzone, draggingTabSyncId = null) {
  return [...dropzone.querySelectorAll('[data-sorter-tab-row]')]
    .filter((row) => row.dataset.tabSyncId !== draggingTabSyncId)
}

function resolveTabDrop(dropzone, draggingTabSyncId, event) {
  const rows = getTabRows(dropzone, draggingTabSyncId)
  const hoveredRow = event.target.closest?.('[data-sorter-tab-row]')

  if (!hoveredRow || !rows.includes(hoveredRow)) {
    return {
      targetRow: null,
      targetIndex: rows.length,
      targetModuleId: parseInt(dropzone.dataset.moduleId ?? '', 10) || null,
      targetModuleSyncId: dropzone.dataset.moduleSyncId || null,
      marker: null,
    }
  }

  const rect = hoveredRow.getBoundingClientRect()
  const placeBefore = event.clientY < rect.top + (rect.height / 2)
  const baseIndex = rows.findIndex((row) => row === hoveredRow)

  return {
    targetRow: hoveredRow,
    targetIndex: placeBefore ? baseIndex : baseIndex + 1,
    targetModuleId: parseInt(dropzone.dataset.moduleId ?? '', 10) || null,
    targetModuleSyncId: dropzone.dataset.moduleSyncId || null,
    marker: placeBefore ? 'before' : 'after',
  }
}

function getContentRows(dropzone, draggingContentId = null) {
  return [...dropzone.querySelectorAll('[data-sorter-content-row]')]
    .filter((row) => row.dataset.contentId !== String(draggingContentId ?? ''))
}

function resolveContentDrop(dropzone, draggingContentId, event) {
  const rows = getContentRows(dropzone, draggingContentId)
  const hoveredRow = event.target.closest?.('[data-sorter-content-row]')

  if (!hoveredRow || !rows.includes(hoveredRow)) {
    return {
      targetRow: null,
      targetIndex: rows.length,
      targetTabId: parseInt(dropzone.dataset.tabId ?? '', 10) || null,
      targetTabSyncId: dropzone.dataset.tabSyncId || null,
      marker: null,
    }
  }

  const rect = hoveredRow.getBoundingClientRect()
  const placeBefore = event.clientY < rect.top + (rect.height / 2)
  const baseIndex = rows.findIndex((row) => row === hoveredRow)

  return {
    targetRow: hoveredRow,
    targetIndex: placeBefore ? baseIndex : baseIndex + 1,
    targetTabId: parseInt(dropzone.dataset.tabId ?? '', 10) || null,
    targetTabSyncId: dropzone.dataset.tabSyncId || null,
    marker: placeBefore ? 'before' : 'after',
  }
}

export function initSorterDnd({root, state, onDropPage, onDropModule, onDropTab, onDropContent}) {
  let draggingCard = null
  let draggingSourceSlot = null
  let draggingPage = null
  let currentPageDrop = null
  let currentModuleDrop = null
  let currentTabDrop = null
  let currentContentDrop = null

  function cleanupDraggingState() {
    clearPageDropIndicators(root)
    clearModuleDropIndicators(root)
    clearTabDropIndicators(root)
    clearContentDropIndicators(root)
    root.querySelectorAll('[data-sorter-page][data-dragging]')
      .forEach((page) => page.removeAttribute('data-dragging'))
    root.querySelectorAll('[data-sorter-module-card][data-dragging]')
      .forEach((card) => card.removeAttribute('data-dragging'))
    root.querySelectorAll('[data-sorter-tab-row][data-dragging]')
      .forEach((row) => row.removeAttribute('data-dragging'))
    root.querySelectorAll('[data-sorter-content-row][data-dragging]')
      .forEach((row) => row.removeAttribute('data-dragging'))
    draggingPage = null
    draggingCard = null
    draggingSourceSlot = null
    currentPageDrop = null
    currentModuleDrop = null
    currentTabDrop = null
    currentContentDrop = null
  }

  root.addEventListener('dragstart', (event) => {
    const pageHandle = event.target.closest?.('[data-sorter-page-drag-handle]')
    if (pageHandle) {
      if (state.tabSort?.moduleType || state.contentSort?.moduleType) {
        event.preventDefault()
        return
      }

      const page = pageHandle.closest('[data-sorter-page]')
      if (!page) return

      draggingPage = page
      state.drag.kind = 'page'
      state.drag.pageSyncId = page.dataset.pageSyncId || null
      page.setAttribute('data-dragging', '')
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', state.drag.pageSyncId || '')
      return
    }

    const contentHandle = event.target.closest?.('[data-sorter-content-drag-handle]')
    if (contentHandle) {
      if (!state.contentSort?.moduleType) {
        event.preventDefault()
        return
      }

      const row = contentHandle.closest('[data-sorter-content-row]')
      if (!row) return

      state.drag.kind = 'content'
      state.drag.contentId = parseInt(row.dataset.contentId ?? '', 10) || null
      state.drag.contentType = row.dataset.contentType || null
      state.drag.sourceTabSyncId = row.dataset.tabSyncId || null
      state.drag.sourceCollectionId = parseInt(row.dataset.tabId ?? '', 10) || null
      state.drag.sourceModuleSyncId = row.dataset.moduleSyncId || null
      state.drag.sourceModuleType = row.dataset.moduleType || null
      row.setAttribute('data-dragging', '')
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', String(state.drag.contentId || ''))
      return
    }

    const tabHandle = event.target.closest?.('[data-sorter-tab-drag-handle]')
    if (tabHandle) {
      if (!state.tabSort?.moduleType) {
        event.preventDefault()
        return
      }

      const row = tabHandle.closest('[data-sorter-tab-row]')
      if (!row) return

      state.drag.kind = 'tab'
      state.drag.tabSyncId = row.dataset.tabSyncId || null
      state.drag.sourceModuleSyncId = row.dataset.moduleSyncId || null
      state.drag.sourceModuleType = row.dataset.moduleType || null
      row.setAttribute('data-dragging', '')
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', state.drag.tabSyncId || '')
      return
    }

    const moduleHandle = event.target.closest?.('[data-sorter-drag-handle]')
    if (!moduleHandle || state.tabSort?.moduleType) return

    const card = moduleHandle.closest('[data-sorter-module-card]')
    if (!card) return

    draggingCard = card
    draggingSourceSlot = card.closest('[data-grid-col]')
    state.drag.kind = 'module'
    state.drag.moduleSyncId = card.dataset.moduleSyncId || null
    state.drag.sourcePageSyncId = card.closest('[data-sorter-page]')?.dataset?.pageSyncId || null
    card.setAttribute('data-dragging', '')
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', state.drag.moduleSyncId || '')
  })

  root.addEventListener('dragover', (event) => {
    if (state.drag.kind === 'page') {
      const page = event.target.closest?.('[data-sorter-page]')
      if (!page || page === draggingPage) return

      event.preventDefault()
      clearPageDropIndicators(root)

      const rect = page.getBoundingClientRect()
      const placeBefore = event.clientY < rect.top + (rect.height / 2)
      currentPageDrop = {
        targetPageSyncId: page.dataset.pageSyncId || null,
        marker: placeBefore ? 'before' : 'after',
      }
      page.setAttribute('data-page-drop-marker', currentPageDrop.marker)
      return
    }

    if (state.drag.kind === 'content') {
      const dropzone = event.target.closest?.('[data-sorter-content-dropzone]')
      if (!dropzone || !state.drag.contentId) return
      if (dropzone.dataset.moduleType !== state.drag.sourceModuleType) return

      event.preventDefault()
      clearContentDropIndicators(root)
      dropzone.setAttribute('data-drop-active', '')

      currentContentDrop = resolveContentDrop(dropzone, state.drag.contentId, event)
      if (currentContentDrop.targetRow && currentContentDrop.marker) {
        currentContentDrop.targetRow.setAttribute('data-content-drop-marker', currentContentDrop.marker)
      }
      return
    }

    if (state.drag.kind === 'tab') {
      const dropzone = event.target.closest?.('[data-sorter-tab-dropzone]')
      if (!dropzone || !state.drag.tabSyncId) return
      if (dropzone.dataset.moduleType !== state.drag.sourceModuleType) return

      event.preventDefault()
      clearTabDropIndicators(root)
      dropzone.setAttribute('data-drop-active', '')

      currentTabDrop = resolveTabDrop(dropzone, state.drag.tabSyncId, event)
      if (currentTabDrop.targetRow && currentTabDrop.marker) {
        currentTabDrop.targetRow.setAttribute('data-tab-drop-marker', currentTabDrop.marker)
      }
      return
    }

    const lane = event.target.closest?.('[data-sorter-module-lane]')
    if (!lane || !state.drag.moduleSyncId) return

    event.preventDefault()
    clearModuleDropIndicators(root)
    lane.setAttribute('data-drop-active', '')

    currentModuleDrop = {
      lane,
      targetPageSyncId: lane.dataset.pageSyncId || null,
      ...resolveModuleDrop(lane, draggingSourceSlot, event),
    }

    if (currentModuleDrop.targetSlot && currentModuleDrop.marker) {
      currentModuleDrop.targetSlot.setAttribute('data-drop-marker', currentModuleDrop.marker)
    }
  })

  root.addEventListener('dragleave', (event) => {
    const contentZone = event.target.closest?.('[data-sorter-content-dropzone]')
    if (contentZone && !contentZone.contains(event.relatedTarget)) {
      contentZone.removeAttribute('data-drop-active')
    }

    const tabZone = event.target.closest?.('[data-sorter-tab-dropzone]')
    if (tabZone && !tabZone.contains(event.relatedTarget)) {
      tabZone.removeAttribute('data-drop-active')
    }

    const lane = event.target.closest?.('[data-sorter-module-lane]')
    if (lane && !lane.contains(event.relatedTarget)) {
      lane.removeAttribute('data-drop-active')
    }
  })

  root.addEventListener('drop', async (event) => {
    if (state.drag.kind === 'page') {
      const page = event.target.closest?.('[data-sorter-page]')
      if (!page || !state.drag.pageSyncId || page === draggingPage) return

      event.preventDefault()

      const pages = [...root.querySelectorAll('[data-sorter-page]')].filter((entry) => entry !== draggingPage)
      const targetIndexBase = pages.findIndex((entry) => entry.dataset.pageSyncId === page.dataset.pageSyncId)
      const targetIndex = currentPageDrop?.marker === 'after'
        ? targetIndexBase + 1
        : targetIndexBase

      clearPageDropIndicators(root)

      if (typeof onDropPage === 'function') {
        await onDropPage({
          pageSyncId: state.drag.pageSyncId,
          targetIndex,
        })
      }
      return
    }

    if (state.drag.kind === 'content') {
      const dropzone = event.target.closest?.('[data-sorter-content-dropzone]')
      const fallbackDropzone = currentContentDrop?.targetTabSyncId
        ? root.querySelector(`[data-sorter-content-dropzone][data-tab-sync-id="${CSS.escape(currentContentDrop.targetTabSyncId)}"]`)
        : null
      const activeDropzone = dropzone || fallbackDropzone
      if (!activeDropzone || !state.drag.contentId) return
      if (activeDropzone.dataset.moduleType !== state.drag.sourceModuleType) return

      event.preventDefault()

      const drop = currentContentDrop?.targetTabSyncId === activeDropzone.dataset.tabSyncId
        ? currentContentDrop
        : resolveContentDrop(activeDropzone, state.drag.contentId, event)

      clearContentDropIndicators(root)

      await onDropContent({
        contentId: state.drag.contentId,
        contentType: state.drag.contentType,
        targetTabId: drop.targetTabId,
        targetTabSyncId: drop.targetTabSyncId,
        targetIndex: drop.targetIndex,
      })
      return
    }

    if (state.drag.kind === 'tab') {
      const dropzone = event.target.closest?.('[data-sorter-tab-dropzone]')
      const fallbackDropzone = currentTabDrop?.targetModuleSyncId
        ? root.querySelector(`[data-sorter-tab-dropzone][data-module-sync-id="${CSS.escape(currentTabDrop.targetModuleSyncId)}"]`)
        : null
      const activeDropzone = dropzone || fallbackDropzone
      if (!activeDropzone || !state.drag.tabSyncId) return
      if (activeDropzone.dataset.moduleType !== state.drag.sourceModuleType) return

      event.preventDefault()

      const drop = currentTabDrop?.targetModuleSyncId === activeDropzone.dataset.moduleSyncId
        ? currentTabDrop
        : resolveTabDrop(activeDropzone, state.drag.tabSyncId, event)

      clearTabDropIndicators(root)

      await onDropTab({
        tabSyncId: state.drag.tabSyncId,
        sourceModuleSyncId: state.drag.sourceModuleSyncId,
        targetModuleId: drop.targetModuleId,
        targetModuleSyncId: drop.targetModuleSyncId,
        targetIndex: drop.targetIndex,
      })
      return
    }

    const lane = event.target.closest?.('[data-sorter-module-lane]')
    if (!lane || !state.drag.moduleSyncId) return

    event.preventDefault()

    const drop = currentModuleDrop?.lane === lane
      ? currentModuleDrop
      : {
          lane,
          targetPageSyncId: lane.dataset.pageSyncId || null,
          ...resolveModuleDrop(lane, draggingSourceSlot, event),
        }

    clearModuleDropIndicators(root)

    await onDropModule({
      moduleSyncId: state.drag.moduleSyncId,
      targetPageSyncId: drop.targetPageSyncId,
      targetIndex: drop.targetIndex,
      targetSlotId: drop.targetSlotId,
      targetSlotKind: drop.targetSlotKind,
    })
  })

  root.addEventListener('dragend', () => {
    cleanupDraggingState()
  })
}
