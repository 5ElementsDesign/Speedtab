import {escapeHtml} from '../../../../utils/html.js'
import {t, getLocale, toBcp47} from '../../../../utils/i18n.js'
import {renderModuleTabs} from '../tabs/render.js'

function formatDueAt(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(toBcp47(getLocale()), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function getTodoDueState(todo, now = Date.now()) {
  if (!todo?.due_at) return 'none'
  if (todo.completed_at) return todo.completed_at > todo.due_at ? 'completed-late' : 'ok'
  return todo.due_at <= now ? 'overdue' : 'open'
}

export function renderTodoDue(todo, now = Date.now()) {
  if (!todo?.due_at) return ''
  const dueState = getTodoDueState(todo, now)
  const label = formatDueAt(todo.due_at)
  return `<time data-todo-due-at="${escapeHtml(String(todo.due_at))}" data-todo-due-state="${dueState}" datetime="${escapeHtml(new Date(todo.due_at).toISOString())}">${escapeHtml(label)}</time>`
}

export function renderTodoRow(todo, moduleSyncId = '', now = Date.now()) {
  const id = String(todo.id ?? '')
  const complete = todo.completed_at != null
  const title = String(todo.title || t('todo.untitled'))
  const priority = todo.priority || ''
  const colorScheme = todo.color_scheme || ''
  return `
    <li data-todo-row data-todo-id="${escapeHtml(id)}" data-todo-completed="${complete ? 'true' : 'false'}">
      <button
        type="button"
        class="st-todo-check"
        data-click="toggleTodoCompletion"
        data-todo-id="${escapeHtml(id)}"
        data-module-sync-id="${escapeHtml(moduleSyncId)}"
        aria-pressed="${complete ? 'true' : 'false'}"
        aria-label="${escapeHtml(complete ? t('todo.markIncomplete') : t('todo.markComplete'))}"
      ><i data-icon="check" aria-hidden="true"></i></button>
      <button
        type="button"
        class="st-todo-main"
        data-click="editTodo"
        data-todo-id="${escapeHtml(id)}"
        data-module-sync-id="${escapeHtml(moduleSyncId)}"
      ><span data-todo-title>${escapeHtml(title)}</span>${renderTodoDue(todo, now)}</button>
      ${priority || colorScheme ? `<div class="todo-custom-indicator">${priority ? `<span data-todo-priority-label>${escapeHtml(t(`todo.priority.${priority}`))}</span>` : ''}${colorScheme ? `<span data-todo-color-scheme="${escapeHtml(colorScheme)}" aria-label="${escapeHtml(t(`customizer.options.${colorScheme}`))}"></span>` : ''}</div>` : ''}
    </li>
  `
}

function renderTodoList(todos = [], moduleSyncId = '') {
  return `
    <div data-todo-list data-module-sync-id="${escapeHtml(moduleSyncId)}">
      <ul data-todo-rows${todos.length ? '' : ' hidden'}>${todos.map((todo) => renderTodoRow(todo, moduleSyncId)).join('')}</ul>
      <p data-todo-empty${todos.length ? ' hidden' : ''}>${escapeHtml(t('todo.empty'))}</p>
      <form data-todo-inline-form data-submit="addTodo" data-module-sync-id="${escapeHtml(moduleSyncId)}">
        <input name="todo-title" type="text" maxlength="240" autocomplete="off" placeholder="${escapeHtml(t('todo.addPlaceholder'))}" aria-label="${escapeHtml(t('todo.add'))}">
        <button type="submit" class="st-btn" data-btn="primary" title="${escapeHtml(t('todo.add'))}" aria-label="${escapeHtml(t('todo.add'))}"><i data-icon="plus" aria-hidden="true"></i></button>
      </form>
    </div>
  `
}

export function renderTodoModule(tabs = [], actionsHtml = '', moduleId = null, moduleSyncId = '') {
  return renderModuleTabs(
    tabs,
    (tab) => renderTodoList(tab.todos ?? [], moduleSyncId),
    {actionsHtml, moduleId, emptyLabel: t('todo.empty')},
  )
}
