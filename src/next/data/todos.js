import {db, isActiveRecord} from '../../db/db.ts'
import {createOrderedEntity, loadEntityById, softDeleteEntity, updateEntity} from './ordered-entities.js'

export async function loadTodosByCollectionId(collectionId) {
  if (!collectionId) return []
  return db.todos
    .where('collection_id')
    .equals(collectionId)
    .filter(isActiveRecord)
    .sortBy('sort_order')
}

export async function loadTodoById(id) {
  return loadEntityById(db.todos, id)
}

export async function createTodoData(collectionId, payload = {}) {
  if (!collectionId) return null
  const title = String(payload.title ?? '').trim()
  if (!title) return null
  return createOrderedEntity(db.todos, 'collection_id', collectionId, {
    title,
    note: typeof payload.note === 'string' ? payload.note : null,
    completed_at: Number.isFinite(payload.completed_at) ? payload.completed_at : null,
    due_at: Number.isFinite(payload.due_at) ? payload.due_at : null,
    priority: ['low', 'medium', 'high'].includes(payload.priority) ? payload.priority : null,
    color_scheme: ['primary', 'secondary', 'success', 'warning', 'danger', 'dark', 'light'].includes(payload.color_scheme) ? payload.color_scheme : null,
  })
}

export async function saveTodoData(id, updates = {}) {
  return updateEntity(db.todos, id, updates)
}

export async function toggleTodoCompletion(id, completed) {
  return updateEntity(db.todos, id, {completed_at: completed ? Date.now() : null})
}

export async function softDeleteTodo(id) {
  return softDeleteEntity(db.todos, id)
}
