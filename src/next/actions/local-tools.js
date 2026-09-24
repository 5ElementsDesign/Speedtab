import {
  closeFloatingNote,
  focusFloatingNote as focusFloatingNoteWindow,
  cancelFloatingNoteEdit as cancelFloatingNoteEditWindow,
  closeQuicknoteWindow,
  lockFloatingCryptNote as lockFloatingCryptNoteWindow,
  openFloatingNote,
  openVirtualNote,
  openQuicknote,
  resetFloatingNoteWindowLayout as resetFloatingNoteWindowLayoutWindow,
  saveFloatingNoteEdit as saveFloatingNoteEditWindow,
  saveFloatingNoteWindowOption as saveFloatingNoteWindowOptionWindow,
  startFloatingNoteEdit as startFloatingNoteEditWindow,
  syncFloatingNoteEditorField as syncFloatingNoteEditorFieldWindow,
  insertFloatingNoteTabber as insertFloatingNoteTabberWindow,
  insertFloatingNoteTableau as insertFloatingNoteTableauWindow,
  filterFloatingNoteWorldClockZones as filterFloatingNoteWorldClockZonesWindow,
  generateFloatingNoteWorldClock as generateFloatingNoteWorldClockWindow,
  syncFloatingNoteWorldClockDefaultTimezone as syncFloatingNoteWorldClockDefaultTimezoneWindow,
  toggleFloatingNoteWorldClockAnalogSize as toggleFloatingNoteWorldClockAnalogSizeWindow,
  toggleFloatingNotePreview as toggleFloatingNotePreviewWindow,
  toggleVirtualNoteMarkup as toggleVirtualNoteMarkupWindow,
  toggleFloatingNoteWorldClockGenerator as toggleFloatingNoteWorldClockGeneratorWindow,
  toggleFloatingCryptPassphrase as toggleFloatingCryptPassphraseWindow,
  unlockFloatingCryptNote as unlockFloatingCryptNoteWindow,
  updateQuicknoteContent,
  saveVirtualNoteToInbox as saveVirtualNoteToInboxWindow,
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

  openVirtualNote(target) {
    openVirtualNote(target)
  },

  async toggleVirtualNoteMarkup(target) {
    await toggleVirtualNoteMarkupWindow(target?.dataset?.noteId)
  },

  async saveVirtualNoteToInbox(target) {
    await saveVirtualNoteToInboxWindow(target?.dataset?.noteId)
  },

  async editFloatingNote(target) {
    await startFloatingNoteEditWindow(target?.dataset?.noteId)
  },

  closeFloatingNote(target) {
    closeFloatingNote(target?.dataset?.noteId)
  },

  focusFloatingNote(target) {
    focusFloatingNoteWindow(target?.dataset?.noteId)
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
    const zones = [...generator?.querySelectorAll?.('[data-world-clock-zone-option] input:checked') ?? []].map((input) => input.value)
    generateFloatingNoteWorldClockWindow(target?.dataset?.noteId, zones, {
      display: generator?.querySelector?.('[name="worldclock_display"]')?.value,
      analogSize: generator?.querySelector?.('[name="worldclock_analog_size"]')?.value,
      defaultTimeZone: generator?.querySelector?.('[name="worldclock_default_timezone"]:checked')?.value,
      topDateFormat: generator?.querySelector?.('[name="worldclock_top_date_format"]')?.value,
      itemDateFormat: generator?.querySelector?.('[name="worldclock_item_date_format"]')?.value,
    })
  },

  toggleFloatingNoteWorldClockAnalogSize(target) {
    toggleFloatingNoteWorldClockAnalogSizeWindow(target)
  },

  filterFloatingNoteWorldClockZones(target) {
    filterFloatingNoteWorldClockZonesWindow(target)
  },

  syncFloatingNoteWorldClockDefaultTimezone(target) {
    syncFloatingNoteWorldClockDefaultTimezoneWindow(target)
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
