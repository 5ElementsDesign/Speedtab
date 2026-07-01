import {describe, expect, it} from 'vitest'
import {
  actionFooter,
  button,
  buttonRow,
  checkbox,
  divider,
  field,
  helperText,
  numberInput,
  section,
  select,
  textarea,
  textInput,
} from '../ui/primitives.js'

describe('ui primitives', () => {
  it('renders a section shell with title and helper', () => {
    expect(section({
      title: 'Appearance',
      helper: 'Shared controls',
      children: '<div>body</div>',
      attrs: {'data-test': 'ok'},
    })).toContain('<section data-section data-test="ok">')
    expect(section({
      title: 'Appearance',
      helper: 'Shared controls',
      children: '<div>body</div>',
    })).toContain('<p data-section-title>Appearance</p>')
  })

  it('renders a labeled field wrapper', () => {
    expect(field({
      type: 'text',
      label: 'Title',
      control: '<input type="text" name="title">',
    })).toBe(`
    <label data-field data-field-type="text">
      <span data-field-label>Title</span>
      <input type="text" name="title">
    </label>
  `)
  })

  it('renders buttons and button rows with consistent attributes', () => {
    expect(button({
      label: 'Save',
      variant: 'primary',
      attrs: {'data-x': '1'},
    })).toBe('<button data-btn="primary" data-x="1" type="button">Save</button>')
    expect(buttonRow(['<button>A</button>', '<button>B</button>'])).toContain('data-button-row')
    expect(actionFooter({save: '<button>Save</button>'})).toContain('data-form-actions')
  })

  it('renders basic control helpers', () => {
    expect(textInput({name: 'title', value: 'Hello'})).toBe('<input type="text" name="title" value="Hello">')
    expect(numberInput({name: 'count', value: 2})).toBe('<input type="number" name="count" value="2">')
    expect(textarea({name: 'content', value: 'Body', rows: 3})).toBe('<textarea name="content" rows="3">Body</textarea>')
    expect(select({
      name: 'mode',
      value: 'b',
      options: [
        {value: 'a', label: 'A'},
        {value: 'b', label: 'B'},
      ],
    })).toContain('<option value="b" selected>B</option>')
    expect(checkbox({name: 'enabled', checked: true})).toBe('<input type="checkbox" name="enabled" checked>')
    expect(divider()).toBe('<div data-divider aria-hidden="true"></div>')
    expect(helperText('Hint')).toBe('<p data-helper-text>Hint</p>')
  })
})
