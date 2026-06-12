import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ModuleForm from './ModuleForm.vue'
import { createTestI18n } from '@/test/createTestI18n'

describe('ModuleForm', () => {
  it('emits typeChange immediately and when the new-module type changes', async () => {
    const wrapper = mount(ModuleForm, {
      props: {
        pageId: 1,
      },
      global: {
        plugins: [createTestI18n()],
      },
    })

    expect(wrapper.emitted('typeChange')?.[0]).toEqual(['tabs'])

    await wrapper.findAll('button').find((candidate) => candidate.text().includes('Notes'))!.trigger('click')

    const events = wrapper.emitted('typeChange') ?? []
    expect(events.at(-1)).toEqual(['notes'])
  })
})
