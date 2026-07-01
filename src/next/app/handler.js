import {YEH} from '../../lib/yai/yeh.js'
import {closeAll, getOpenDropdownTrigger, positionPanel, toggle} from '../components/dropdown.js'
import {closeModal} from '../components/modal.js'
import {closeSidepanel} from '../components/sidepanel.js'
import {updateFormDirtyState} from '../features/forms/actions.js'
import {handleOutsideSearchClick} from '../features/search/manager.js'

export function createHandler(appActions = {}) {
  const INPUT_DEBOUNCE_MS = 150
  const CHANGE_DEBOUNCE_MS = 100
  const FORM_STATE_DEBOUNCE_MS = 500
  const HOVER_THROTTLE_MS = 5
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
      'mouseover',
      'mouseout',
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
          handleOutsideSearchClick(clickable)
          event.preventDefault()
          event.stopPropagation()
          const originTrigger = target?.closest?.('[data-dropdown-panel]')
            ? getOpenDropdownTrigger()
            : null
          closeAll()
          event.__dropdownTrigger = originTrigger
          const fn = appActions[action]
          if (typeof fn === 'function') fn(clickable, event)
          return
        }

        const trigger = target.closest?.('[data-dropdown-trigger]')
        if (trigger) {
          toggle(trigger.closest('[data-dropdown]'))
          return
        }

        if (!target.closest?.('[data-dropdown]')) closeAll()
        if (target.closest?.('[data-modal-backdrop], [data-modal-close]')) closeModal()
        if (target.closest?.('[data-sidepanel-close]')) closeSidepanel()
        handleOutsideSearchClick(target)
      },

      handleKeydown(event) {
        if (event.key === 'Escape') {
          closeAll()
          closeModal()
          closeSidepanel()
          if (typeof appActions.closeSearch === 'function') appActions.closeSearch()
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
        YEH.throttle(() => {
          const item = target?.closest?.('[data-customizer-list-item][data-sync-id]')
          const syncId = item?.dataset?.syncId
          if (!syncId) return
          document.querySelector(`[data-module-card][data-sync-id="${CSS.escape(syncId)}"]`)
            ?.setAttribute('data-customizer-focus', '')
        }, HOVER_THROTTLE_MS, 'st:customizer:hover')()
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
        document.querySelectorAll('[data-dropdown][data-dropdown-open]').forEach(positionPanel)
      },

      handleScroll() {
        document.querySelectorAll('[data-dropdown][data-dropdown-open]').forEach(positionPanel)
      }

    }
  })
}
