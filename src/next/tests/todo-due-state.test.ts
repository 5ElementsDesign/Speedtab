import {describe, expect, it} from 'vitest'
import {getTodoDueState} from '../features/pages/modules/todo/render.js'

describe('todo due states', () => {
  const now = Date.UTC(2026, 7, 24, 12, 0)

  it('reserves ok for tasks completed on time', () => {
    expect(getTodoDueState({due_at: now + 60_000, completed_at: null}, now)).toBe('open')
    expect(getTodoDueState({due_at: now + 60_000, completed_at: now}, now)).toBe('ok')
  })

  it('distinguishes overdue, completed-late, and missing dates', () => {
    expect(getTodoDueState({due_at: now - 60_000, completed_at: null}, now)).toBe('overdue')
    expect(getTodoDueState({due_at: now - 60_000, completed_at: now}, now)).toBe('completed-late')
    expect(getTodoDueState({due_at: null, completed_at: null}, now)).toBe('none')
  })
})
