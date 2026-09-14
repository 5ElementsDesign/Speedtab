import {
  closeFloatingNote,
  cancelFloatingNoteEdit as cancelFloatingNoteEditWindow,
  closeQuicknoteWindow,
  lockFloatingCryptNote as lockFloatingCryptNoteWindow,
  openFloatingNote,
  openQuicknote,
  resetFloatingNoteWindowLayout as resetFloatingNoteWindowLayoutWindow,
  saveFloatingNoteEdit as saveFloatingNoteEditWindow,
  saveFloatingNoteWindowOption as saveFloatingNoteWindowOptionWindow,
  startFloatingNoteEdit as startFloatingNoteEditWindow,
  syncFloatingNoteEditorField as syncFloatingNoteEditorFieldWindow,
  insertFloatingNoteTabber as insertFloatingNoteTabberWindow,
  insertFloatingNoteTableau as insertFloatingNoteTableauWindow,
  generateFloatingNoteWorldClock as generateFloatingNoteWorldClockWindow,
  toggleFloatingNotePreview as toggleFloatingNotePreviewWindow,
  toggleFloatingNoteWorldClockGenerator as toggleFloatingNoteWorldClockGeneratorWindow,
  toggleFloatingCryptPassphrase as toggleFloatingCryptPassphraseWindow,
  unlockFloatingCryptNote as unlockFloatingCryptNoteWindow,
  updateQuicknoteContent,
} from '../features/local-tools/manager.js'

export const localToolsActions = {
  openQuicknote() {
    openQuicknote()
  },

  closeQuicknote() {
    closeQuicknoteWindow()
  },

  updateQuicknoteContent(target) {
    updateQuicknoteContent(target?.value ?? '')
  },

  clearQuicknoteTitleMarker() {
    document.dispatchEvent(new CustomEvent('speedtab:clear-quicknote-marker'))
  },

  openFloatingNote(target) {
    openFloatingNote(target?.dataset?.noteId)
  },

  async editFloatingNote(target) {
    await startFloatingNoteEditWindow(target?.dataset?.noteId)
  },

  closeFloatingNote(target) {
    closeFloatingNote(target?.dataset?.noteId)
  },

  async cancelFloatingNoteEdit(target) {
    await cancelFloatingNoteEditWindow(target?.dataset?.noteId)
  },

  async saveFloatingNoteEdit(target) {
    const form = target?.closest?.('[data-floating-note-form]')
    await saveFloatingNoteEditWindow(target?.dataset?.noteId || form?.dataset?.noteId, form)
  },

  async saveFloatingNoteWindowOption(target) {
    await saveFloatingNoteWindowOptionWindow(
      target?.dataset?.noteId,
      target?.dataset?.windowOption,
      target?.checked === true,
    )
  },

  syncFloatingNoteEditorField(target) {
    const value = target instanceof HTMLInputElement && target.type === 'checkbox'
      ? target.checked
      : (target?.value ?? '')
    syncFloatingNoteEditorFieldWindow(target?.dataset?.noteId, target?.dataset?.editorField, value)
  },

  insertFloatingNoteTabber(target) {
    insertFloatingNoteTabberWindow(target?.dataset?.noteId)
  },

  insertFloatingNoteTableau(target) {
    insertFloatingNoteTableauWindow(target?.dataset?.noteId)
  },

  async toggleFloatingNoteWorldClockGenerator(target) {
    await toggleFloatingNoteWorldClockGeneratorWindow(target?.dataset?.noteId)
  },

  generateFloatingNoteWorldClock(target) {
    const generator = target?.closest?.('[data-world-clock-generator]')
    const source = generator?.querySelector?.('textarea')?.value ?? ''
    generateFloatingNoteWorldClockWindow(target?.dataset?.noteId, source)
  },

  async toggleFloatingNotePreview(target) {
    await toggleFloatingNotePreviewWindow(target?.dataset?.noteId)
  },

  async resetFloatingNoteWindowLayout(target) {
    await resetFloatingNoteWindowLayoutWindow(target?.dataset?.noteId)
  },

  async unlockFloatingCryptNote(target) {
    const noteId = target?.dataset?.noteId
    const passphrase = target
      ?.closest?.('[data-floating-window]')
      ?.querySelector?.('[data-note-crypt-passphrase]')?.value ?? ''
    await unlockFloatingCryptNoteWindow(noteId, passphrase)
  },

  async lockFloatingCryptNote(target) {
    await lockFloatingCryptNoteWindow(target?.dataset?.noteId)
  },

  async toggleFloatingCryptPassphrase(target) {
    const noteId = target?.dataset?.noteId
    const passphrase = target
      ?.closest?.('[data-floating-window]')
      ?.querySelector?.('[data-note-crypt-passphrase]')?.value ?? ''
    await toggleFloatingCryptPassphraseWindow(noteId, passphrase)
  },
}
