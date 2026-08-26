import {subscribeToAppClock} from '../app/clock.js'
import {closeModal, openModal} from '../components/modal.js'
import {createTodoData, loadTodoById, saveTodoData, softDeleteTodo, toggleTodoCompletion} from '../data/todos.js'
import {initFormDirtyState} from '../features/forms/actions.js'
import {getTodoDueState, renderTodoRow} from '../features/pages/modules/todo/render.js'
import {escapeHtml} from '../utils/html.js'
import {getLocale, t, toBcp47} from '../utils/i18n.js'

function getActiveTodoContext(moduleSyncId) {
  const moduleRoot = document.querySelector(`[data-module-card][data-sync-id="${CSS.escape(moduleSyncId || '')}"]`)
  const activeButton = moduleRoot?.querySelector('[data-yai-tabs] > [data-controller] [data-open].active')
  const collectionId = parseInt(activeButton?.dataset?.tabId ?? '', 10)
  if (!moduleRoot || !collectionId) return null
  return {moduleRoot, collectionId}
}

function toDateTimeLocal(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function getDueAt(form) {
  const raw = form.querySelector('[name="todo-due-at"]')?.value?.trim() || ''
  if (!raw) return null
  const value = new Date(raw).getTime()
  return Number.isFinite(value) ? value : null
}

function formatTodoDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(toBcp47(getLocale()), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function renderTodoDates(todo) {
  const items = [
    [t('todo.created'), todo?.created_at],
    [t('todo.updated'), todo?.updated_at],
    ...(todo?.completed_at ? [[t('todo.finished'), todo.completed_at]] : []),
  ].filter(([, value]) => Boolean(value))
  if (!items.length) return ''
  return `<div data-todo-dates>${items.map(([label, value]) => `<span><small>${escapeHtml(label)}</small>${escapeHtml(formatTodoDate(value))}</span>`).join('')}</div>`
}

function renderTodoEditor(todo, moduleSyncId) {
  const priority = todo?.priority ?? ''
  const colorScheme = todo?.color_scheme ?? ''
  const completed = todo?.completed_at != null
  return `
    <form data-todo-editor data-submit="saveTodo" data-todo-id="${escapeHtml(String(todo?.id ?? ''))}" data-module-sync-id="${escapeHtml(moduleSyncId)}">
      <label data-customizer-field><span data-customizer-field-label>${escapeHtml(t('todo.completed'))}</span><input name="todo-completed" type="checkbox"${completed ? ' checked' : ''}></label>
      <label data-customizer-field><span data-customizer-field-label>${escapeHtml(t('noteForm.title'))}</span><input name="todo-title" type="text" maxlength="240" required autocomplete="off" value="${escapeHtml(todo?.title ?? '')}"></label>
      <label data-customizer-field data-customizer-field-layout="stack"><textarea name="todo-note" rows="4" maxlength="4000" placeholder="${escapeHtml(t('todo.note'))}" aria-label="${escapeHtml(t('todo.note'))}">${escapeHtml(todo?.note ?? '')}</textarea></label>
      <div data-customizer-divider="" aria-hidden="true"></div>
      <label data-customizer-field><span data-customizer-field-label>${escapeHtml(t('todo.dueAt'))}</span><input name="todo-due-at" type="datetime-local" value="${escapeHtml(toDateTimeLocal(todo?.due_at))}"></label>
      <label data-customizer-field><span data-customizer-field-label>${escapeHtml(t('todo.priority.label'))}</span><select name="todo-priority"><option value="">${escapeHtml(t('todo.priority.none'))}</option><option value="low"${priority === 'low' ? ' selected' : ''}>${escapeHtml(t('todo.priority.low'))}</option><option value="medium"${priority === 'medium' ? ' selected' : ''}>${escapeHtml(t('todo.priority.medium'))}</option><option value="high"${priority === 'high' ? ' selected' : ''}>${escapeHtml(t('todo.priority.high'))}</option></select></label>
      <label data-customizer-field><span data-customizer-field-label>${escapeHtml(t('noteForm.colorScheme'))}</span><select name="todo-color-scheme"><option value="">${escapeHtml(t('todo.priority.none'))}</option>${['primary', 'secondary', 'success', 'warning', 'danger', 'dark', 'light'].map((value) => `<option value="${value}"${colorScheme === value ? ' selected' : ''}>${escapeHtml(t(`customizer.options.${value}`))}</option>`).join('')}</select></label>
      <div data-customizer-divider="" aria-hidden="true"></div>
      ${renderTodoDates(todo)}
      <div data-form-actions class="mt-1 pt-3 border-t-1">
        <button type="button" class="st-btn" data-btn="danger" data-click="deleteTodo" data-todo-id="${escapeHtml(String(todo.id))}" data-module-sync-id="${escapeHtml(moduleSyncId)}">${escapeHtml(t('common.delete'))}</button>
        <button type="button" class="st-btn" data-modal-close>${escapeHtml(t('common.cancel'))}</button>
        <button type="submit" class="st-btn" data-btn="primary" data-form-save-btn disabled>${escapeHtml(t('common.save'))}</button>
      </div>
    </form>
  `
}

function updateTodoRow(row, todo) {
  if (!(row instanceof HTMLElement) || !todo) return
  const complete = todo.completed_at != null
  row.dataset.todoCompleted = complete ? 'true' : 'false'
  const button = row.querySelector('.st-todo-check')
  button?.setAttribute('aria-pressed', complete ? 'true' : 'false')
  button?.setAttribute('aria-label', complete ? t('todo.markIncomplete') : t('todo.markComplete'))
  const due = row.querySelector('[data-todo-due-at]')
  if (due instanceof HTMLElement) due.dataset.todoDueState = getTodoDueState(todo)
}

export function refreshTimedTodoRows(now = Date.now()) {
  document.querySelectorAll('[data-todo-row]').forEach((row) => {
    if (!(row instanceof HTMLElement) || row.dataset.todoCompleted === 'true') return
    const due = row.querySelector('[data-todo-due-at]')
    if (!(due instanceof HTMLElement)) return
    const dueAt = Number(due.dataset.todoDueAt)
    if (Number.isFinite(dueAt)) due.dataset.todoDueState = dueAt <= now ? 'overdue' : 'open'
  })
}

let unsubscribeTodoClock = null

export function syncTodoClockSubscription() {
  const dueRow = Array.from(document.querySelectorAll('[data-todo-row][data-todo-completed="false"] [data-todo-due-at]'))
    .find((element) => !element.closest('[aria-hidden="true"], [inert]'))
  if (dueRow && !unsubscribeTodoClock) {
    unsubscribeTodoClock = subscribeToAppClock(refreshTimedTodoRows)
    refreshTimedTodoRows()
  } else if (!dueRow && unsubscribeTodoClock) {
    unsubscribeTodoClock()
    unsubscribeTodoClock = null
  }
}

export const todoActions = {
  focusTodoAdd(target) {
    getActiveTodoContext(target.dataset.syncId || '')?.moduleRoot.querySelector('[data-todo-inline-form] input')?.focus()
  },
  async addTodo(target) {
    const form = target?.matches?.('[data-todo-inline-form]') ? target : target?.closest?.('[data-todo-inline-form]')
    if (!(form instanceof HTMLFormElement)) return
    if (form.hasAttribute('data-todo-submitting')) return
    const moduleSyncId = form.dataset.moduleSyncId || ''
    const context = getActiveTodoContext(moduleSyncId)
    const titleInput = form.querySelector('[name="todo-title"]')
    const title = titleInput?.value?.trim() || ''
    if (!context || !title) return
    form.setAttribute('data-todo-submitting', '')
    try {
      const todo = await createTodoData(context.collectionId, {title})
      if (!todo) return
      const list = form.closest('[data-todo-list]')
      const rows = list?.querySelector('[data-todo-rows]')
      if (rows instanceof HTMLElement) {
        rows.insertAdjacentHTML('beforeend', renderTodoRow(todo, moduleSyncId))
        rows.hidden = false
      }
      list?.querySelector('[data-todo-empty]')?.setAttribute('hidden', '')
      titleInput.value = ''
      titleInput.focus()
      syncTodoClockSubscription()
    } finally {
      form.removeAttribute('data-todo-submitting')
    }
  },
  async toggleTodoCompletion(target) {
    const id = parseInt(target.dataset.todoId ?? '', 10)
    if (!id) return
    const todo = await toggleTodoCompletion(id, target.getAttribute('aria-pressed') !== 'true')
    updateTodoRow(target.closest('[data-todo-row]'), todo)
  },
  async editTodo(target) {
    const todo = await loadTodoById(parseInt(target.dataset.todoId ?? '', 10))
    const moduleSyncId = target.dataset.moduleSyncId || ''
    if (!todo || !moduleSyncId) return
    openModal({title: t('todo.edit'), content: renderTodoEditor(todo, moduleSyncId)})
    const form = document.querySelector('[data-modal][data-modal-open] [data-todo-editor]')
    initFormDirtyState(form)
  },
  async saveTodo(target) {
    const form = target?.matches?.('[data-todo-editor]') ? target : target?.closest?.('[data-todo-editor]')
    if (!(form instanceof HTMLFormElement) || !form.reportValidity()) return
    const id = parseInt(form.dataset.todoId ?? '', 10)
    const moduleSyncId = form.dataset.moduleSyncId || ''
    const title = form.querySelector('[name="todo-title"]')?.value?.trim() || ''
    const note = form.querySelector('[name="todo-note"]')?.value?.trim() || null
    const priority = form.querySelector('[name="todo-priority"]')?.value || null
    const colorScheme = form.querySelector('[name="todo-color-scheme"]')?.value || null
    const completed = form.querySelector('[name="todo-completed"]')?.checked === true
    if (!id || !title) return
    const todo = await saveTodoData(id, {title, note, due_at: getDueAt(form), priority, color_scheme: colorScheme, completed_at: completed ? Date.now() : null})
    const row = document.querySelector(`[data-module-card][data-sync-id="${CSS.escape(moduleSyncId)}"] [data-todo-row][data-todo-id="${CSS.escape(String(id))}"]`)
    if (row instanceof HTMLElement && todo) {
      const wrapper = document.createElement('div')
      wrapper.innerHTML = renderTodoRow(todo, moduleSyncId)
      row.replaceWith(wrapper.firstElementChild)
    }
    closeModal()
    syncTodoClockSubscription()
  },
  async deleteTodo(target) {
    const id = parseInt(target.dataset.todoId ?? '', 10)
    if (!id || !confirm(t('todo.confirmDelete'))) return
    await softDeleteTodo(id)
    const row = document.querySelector(`[data-todo-row][data-todo-id="${CSS.escape(String(id))}"]`)
    const list = row?.closest?.('[data-todo-list]')
    row?.remove()
    if (list && !list.querySelector('[data-todo-row]')) {
      list.querySelector('[data-todo-rows]')?.setAttribute('hidden', '')
      list.querySelector('[data-todo-empty]')?.removeAttribute('hidden')
    }
    closeModal()
    syncTodoClockSubscription()
  },
}
