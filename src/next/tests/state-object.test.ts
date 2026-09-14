import {describe, expect, it} from 'vitest'
import {activateTrigger, getState, setState} from '../components/state-object.js'

describe('trigger state object', () => {
  it('claims a trigger once and restores it through its cleanup', () => {
    document.body.innerHTML = '<button type="button"><i data-icon="plus"></i>Add Page</button>'
    const button = document.querySelector('button') as HTMLButtonElement
    const icon = button.querySelector('i')

    const release = activateTrigger(icon)
    expect(button.disabled).toBe(true)
    expect(button.hasAttribute('data-state-active')).toBe(true)
    expect(activateTrigger(button)).toBeNull()

    release?.()
    expect(button.disabled).toBe(false)
    expect(button.hasAttribute('data-state-active')).toBe(false)
  })

  it('synchronizes opt-in checkbox controls by state name', () => {
    document.body.innerHTML = `
      <input type="checkbox" data-state-sync="shell-theme">
      <input type="checkbox" data-state-sync="shell-theme">
      <input type="checkbox" data-state-sync="unrelated" checked>
    `

    setState('shell-theme', true)
    const inputs = document.querySelectorAll('input') as NodeListOf<HTMLInputElement>
    expect(getState('shell-theme')).toBe(true)
    expect(inputs[0].checked).toBe(true)
    expect(inputs[1].checked).toBe(true)
    expect(inputs[2].checked).toBe(true)

    setState('shell-theme', false)
    expect(inputs[0].checked).toBe(false)
    expect(inputs[1].checked).toBe(false)
  })

  it('synchronizes toggle buttons with their pressed state', () => {
    document.body.innerHTML = '<button type="button" data-state-sync="wallspeed" aria-pressed="false">Wallspeed</button>'
    const button = document.querySelector('button') as HTMLButtonElement

    setState('wallspeed', true)
    expect(button.hasAttribute('data-state-active')).toBe(true)
    expect(button.getAttribute('aria-pressed')).toBe('true')

    setState('wallspeed', false)
    expect(button.hasAttribute('data-state-active')).toBe(false)
    expect(button.getAttribute('aria-pressed')).toBe('false')
  })
})
