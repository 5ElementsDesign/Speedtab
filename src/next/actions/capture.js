import {
  discardCaptureItem,
  openCaptureInbox,
  saveCaptureItem,
  selectCaptureCollection,
  selectCaptureItem,
  selectCaptureModule,
  selectCaptureNote,
  updateCaptureDraft,
} from '../features/capture/manager.js'

export const captureActions = {
  async openCaptureInbox() {
    await openCaptureInbox()
  },

  captureSelectItem(target) {
    selectCaptureItem(target?.dataset?.captureItemId)
  },

  captureEditText(target) {
    updateCaptureDraft(target?.value ?? '')
  },

  captureSelectModule(target) {
    selectCaptureModule(target?.value)
  },

  captureSelectCollection(target) {
    selectCaptureCollection(target?.value)
  },

  captureSelectNote(target) {
    selectCaptureNote(target?.value)
  },

  async captureDiscard(target) {
    await discardCaptureItem(Number(target?.dataset?.captureItemId))
  },

  async captureSave() {
    await saveCaptureItem()
  },
}
