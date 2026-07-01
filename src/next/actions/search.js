import {
  closeSearch,
  locateSearchResult,
  openSearch,
  searchFocus,
  toggleSearchResult,
  updateSearchQuery,
} from '../features/search/manager.js'

export const searchActions = {
  openSearch() {
    openSearch()
  },

  closeSearch() {
    closeSearch()
  },

  searchFocus() {
    searchFocus()
  },

  updateSearchQuery(target) {
    updateSearchQuery(target?.value ?? '')
  },

  toggleSearchResult(target) {
    toggleSearchResult(target?.dataset?.searchResultId ?? '')
  },

  locateSearchResult(target) {
    void locateSearchResult(target?.dataset?.searchResultId ?? '')
  },
}
