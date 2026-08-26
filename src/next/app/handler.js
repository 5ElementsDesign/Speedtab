import {YEH} from '../../lib/yai/yeh.js'
import {closeAll, getOpenDropdownTrigger, isDropdownOpen, positionPanel, syncOpenQuickSettingState, toggle} from '../components/dropdown.js'
import {closeModal, isModalOpen} from '../components/modal.js'
import {closeSidepanel, isSidepanelOpen} from '../components/sidepanel.js'
import {updateFormDirtyState} from '../features/forms/actions.js'
import {handleOutsideSearchClick, isSearchOpen} from '../features/search/manager.js'

export function createHandler(appActions = {}) {
  const INPUT_DEBOUNCE_MS = 150
  const CHANGE_DEBOUNCE_MS = 100
  const FORM_STATE_DEBOUNCE_MS = 500
  const RESIZE_THROTTLE_MS = 100
  const SCROLL_THROTTLE_MS = 60

  function getActionTargetKey(target) {
    if (!target) return 'unknown'
    return target.dataset.settingKey
      || target.dataset.fieldName
      || target.dataset.pageSyncId
      || target.dataset.assetId
      || target.dataset.archiveId
      || target.getAttribute?.('name')
      || target.id
      || target.type
      || target.tagName?.toLowerCase?.()
      || 'unknown'
  }

  function runAction(action, target, event) {
    if (!action) return
    const fn = appActions[action]
    if (typeof fn === 'function') fn(target, event)
  }

  function updateTrackedFormState(form) {
    if (!(form instanceof HTMLFormElement)) return
    const formKey = form.dataset.formStateKey || form.dataset.submit || form.dataset.pageSyncId || form.dataset.recordSyncId || 'form'
    YEH.debounce(() => updateFormDirtyState(form), FORM_STATE_DEBOUNCE_MS, `st:form-state:${formKey}`)()
  }

  return new YEH({
    body: [
      'click',
      'keydown',
      'submit',
      'input',
      'change',
    ],
    window: [
      {type: 'resize', throttle: RESIZE_THROTTLE_MS},
      {type: 'scroll', throttle: SCROLL_THROTTLE_MS},
    ],
  }, {}, {
    enableStats: false,
    enableConfigValidation: false,
    enableHandlerValidation: false,
    methodsFirst: false,
    methods: {
      handleClick(event, target) {
        // Any actionable target outside [data-yai-tabs] reaches here (those inside are handled by YaiTabs)
        // Use closest() so clicking a child (SVG, span) of an actionable element still fires correctly
        const clickable = target?.closest?.('[data-click]') || target?.closest?.('[data-action]')
        const action = clickable?.dataset?.click || clickable?.dataset?.action

        if (action) {
          if (clickable.closest?.('[data-yai-tabs]')) return
          if (isSearchOpen()) handleOutsideSearchClick(clickable)
          event.preventDefault()
          event.stopPropagation()
          const originTrigger = target?.closest?.('[data-dropdown-panel]')
            ? getOpenDropdownTrigger()
            : null
          const keepDropdownOpen = clickable.closest?.('[data-quick-setting-key]')
          if (isDropdownOpen() && !keepDropdownOpen) closeAll()
          event.__dropdownTrigger = originTrigger
          const fn = appActions[action]
          if (typeof fn === 'function') {
            const result = fn(clickable, event)
            if (keepDropdownOpen) {
              Promise.resolve(result).then(syncOpenQuickSettingState, syncOpenQuickSettingState)
            }
          }
          return
        }

        const trigger = target.closest?.('[data-dropdown-trigger]')
        if (trigger) {
          toggle(trigger.closest('[data-dropdown]'))
          return
        }

        if (isDropdownOpen() && !target.closest?.('[data-dropdown], [data-dropdown-panel]')) closeAll()
        if (isModalOpen() && target.closest?.('[data-modal-backdrop], [data-modal-close]')) closeModal()
        if (isSidepanelOpen() && target.closest?.('[data-sidepanel-close]')) closeSidepanel()
        if (isSearchOpen()) handleOutsideSearchClick(target)

        // Rare path: feed focus mode is open and the user clicked the surrounding
        // backdrop area. Keep this as the final branch so normal page clicks do
        // not pay for the deeper matching unless focus mode is active.
        const isFocusOpen = target?.closest?.('[data-feed-focus-app-open]')
        if (!isFocusOpen) return

        const clickedInsideFocusedModule = target?.closest?.('[data-feed-focus-open]')
        if (clickedInsideFocusedModule) return

        const clickedBackdropArea = target?.matches?.(`
          [data-feed-focus-app-open] [data-app-tab-content],
          [data-feed-focus-app-open] [data-page-grid],
          [data-feed-focus-app-open] [data-grid-row]
        `)

        if (!clickedBackdropArea) return

        const closeButton = document.querySelector('[data-feed-focus-open] [data-click="closeFeedFocusMode"]')
        if (!(closeButton instanceof HTMLElement)) return
        const closeFocusMode = appActions.closeFeedFocusMode
        if (typeof closeFocusMode === 'function') closeFocusMode(closeButton, event)
      },

      handleKeydown(event) {
        if (
          !event.defaultPrevented
          && !event.altKey
          && !event.shiftKey
          && !event.isComposing
          && (event.ctrlKey || event.metaKey)
          && event.key.toLowerCase() === 's'
        ) {
          const form = event.target instanceof HTMLElement
            ? event.target.closest('form[data-submit]')
            : null
          if (form instanceof HTMLFormElement) {
            event.preventDefault()
            form.requestSubmit()
            return
          }
        }

        if (event.key === 'Escape') {
          if (isDropdownOpen()) closeAll()
          if (isModalOpen()) closeModal()
          if (isSidepanelOpen()) closeSidepanel()
          if (isSearchOpen() && typeof appActions.closeSearch === 'function') appActions.closeSearch()
        }
      },

      handleInput(event, target) {
        updateTrackedFormState(target?.form)
        const immediateAction = target?.dataset?.inputImmediate
        if (immediateAction) {
          runAction(immediateAction, target, event)
          return
        }

        const action = target?.dataset?.input
        if (!action) return

        const key = `st:input:${action}:${getActionTargetKey(target)}`
        YEH.debounce(() => runAction(action, target, event), INPUT_DEBOUNCE_MS, key)()
      },

      handleChange(event, target) {
        updateTrackedFormState(target?.form)
        const action = target?.dataset?.change
        if (!action) return
        const key = `st:change:${action}:${getActionTargetKey(target)}`
        YEH.debounce(() => runAction(action, target, event), CHANGE_DEBOUNCE_MS, key)()
      },

      handleSubmit(event, target) {
        event.preventDefault()
        const submitter = target?.closest?.('[data-submit]')
        const action = submitter?.dataset?.submit
        if (!action) return
        runAction(action, submitter, event)
      },

      handleMouseover(event, target) {
        const item = target?.closest?.('[data-customizer-list-item][data-sync-id]')
        if (!item?.dataset?.syncId) return

        const syncId = item.dataset.syncId
        if (!syncId) return
        document.querySelector(`[data-module-card][data-sync-id="${CSS.escape(syncId)}"]`)
          ?.setAttribute('data-customizer-focus', '')
      },

      handleMouseout(event, target) {
        const item = target?.closest?.('[data-customizer-list-item][data-sync-id]')
        if (!item || item.contains(event.relatedTarget)) return
        const syncId = item.dataset.syncId
        if (!syncId) return
        document.querySelector(`[data-module-card][data-sync-id="${CSS.escape(syncId)}"]`)
          ?.removeAttribute('data-customizer-focus')
      },

      handleResize() {
        if (!isDropdownOpen()) return
        document.querySelectorAll('[data-dropdown][data-dropdown-open]').forEach(positionPanel)
      },

      handleScroll() {
        if (!isDropdownOpen()) return
        document.querySelectorAll('[data-dropdown][data-dropdown-open]').forEach(positionPanel)
      }

    }
  })
}
