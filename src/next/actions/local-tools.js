import {
  closeFloatingNote,
  cancelFloatingNoteEdit as cancelFloatingNoteEditWindow,
  closeQuicknoteWindow,
  lockFloatingCryptNote as lockFloatingCryptNoteWindow,
  openFloatingNote,
  openQuicknote,
  refreshQuicknoteWindow,
  saveFloatingNoteEdit as saveFloatingNoteEditWindow,
  startFloatingNoteEdit as startFloatingNoteEditWindow,
  syncFloatingNoteEditorField as syncFloatingNoteEditorFieldWindow,
  insertFloatingNoteTabber as insertFloatingNoteTabberWindow,
  toggleFloatingNotePreview as toggleFloatingNotePreviewWindow,
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

  async refreshQuicknote() {
    await refreshQuicknoteWindow()
  },

  updateQuicknoteContent(target) {
    updateQuicknoteContent(target?.value ?? '')
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

  syncFloatingNoteEditorField(target) {
    syncFloatingNoteEditorFieldWindow(target?.dataset?.noteId, target?.dataset?.editorField, target?.value ?? '')
  },

  insertFloatingNoteTabber(target) {
    insertFloatingNoteTabberWindow(target?.dataset?.noteId)
  },

  async toggleFloatingNotePreview(target) {
    await toggleFloatingNotePreviewWindow(target?.dataset?.noteId)
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
