import {loadBookmarksByTabId} from '../../data/bookmarks.js'
import {countFeedItemsBySourceIds, loadFeedItemsBySourceIds, loadFeedSourcesByCollectionId, loadSavedFeedItemsByCollectionId} from '../../data/feeds.js'
import {loadNotesByCollectionId} from '../../data/notes.js'
import {loadTodosByCollectionId} from '../../data/todos.js'
import {loadTabsByModuleId} from '../../data/tabs.js'
import {getModuleDefinition} from './registry.js'

const moduleContext = {
  loadTabsByModuleId,
  loadBookmarksByTabId,
  loadNotesByCollectionId,
  loadTodosByCollectionId,
  loadFeedSourcesByCollectionId,
  loadFeedItemsBySourceIds,
  countFeedItemsBySourceIds,
  loadSavedFeedItemsByCollectionId,
}

export async function enrichModule(module) {
  const definition = getModuleDefinition(module?.type)
  if (typeof definition.enrich !== 'function') return module
  return definition.enrich(module, moduleContext)
}

export async function enrichModules(modules = []) {
  return Promise.all(modules.map(enrichModule))
}
