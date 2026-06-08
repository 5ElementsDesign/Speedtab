import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useOpenNotes } from './useOpenNotes'

describe('useOpenNotes', () => {
  const openNotes = useOpenNotes()

  beforeEach(() => {
    openNotes.resetOpenNotes()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    openNotes.resetOpenNotes()
  })

  it('opens multiple notes and marks only the open note ids', () => {
    openNotes.openNote({ id: 101 })
    openNotes.openNote({ id: 202 })

    expect(openNotes.openWindows.value.map((entry) => entry.noteId)).toEqual([101, 202])
    expect(openNotes.isNoteOpen(101)).toBe(true)
    expect(openNotes.isNoteOpen(202)).toBe(true)
    expect(openNotes.isNoteOpen(303)).toBe(false)
  })

  it('raises a lower note above the current top note and updates the body z-index marker', () => {
    openNotes.openNote({ id: 101 })
    openNotes.openNote({ id: 202 })

    const [firstWindow, secondWindow] = openNotes.openWindows.value
    expect(secondWindow.zIndex).toBeGreaterThan(firstWindow.zIndex)

    openNotes.focusNote(101)

    const raisedFirstWindow = openNotes.openWindows.value.find((entry) => entry.noteId === 101)!
    expect(raisedFirstWindow.zIndex).toBeGreaterThan(secondWindow.zIndex)
    expect(document.body.dataset.stNoteZIndex).toBe(String(openNotes.currentZIndex.value))
  })

  it('resets the global z-index marker after the last note closes', () => {
    openNotes.openNote({ id: 101 })
    openNotes.closeNote(101)

    expect(openNotes.openWindows.value).toHaveLength(0)
    expect(openNotes.currentZIndex.value).toBe(70)
    expect(document.body.dataset.stNoteZIndex).toBeUndefined()
  })
})
