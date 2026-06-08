import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import NoteForm from './NoteForm.vue'

vi.mock('./NoteViewerModal.vue', () => ({
  default: {
    template: '<div />',
  },
}))

describe('NoteForm', () => {
  it('emits typeChange immediately and when the new-note type changes', async () => {
    const wrapper = mount(NoteForm, {
      props: {
        collectionId: 1,
      },
    })

    expect(wrapper.emitted('typeChange')?.[0]).toEqual(['text'])

    await wrapper.findAll('button').find((candidate) => candidate.text().trim() === 'HTML')!.trigger('click')

    const events = wrapper.emitted('typeChange') ?? []
    expect(events.at(-1)).toEqual(['html'])
  })
})
