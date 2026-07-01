let ready = false
let pending = null

async function ensureLoaded() {
  if (ready) return
  if (pending) return pending
  pending = import('../../lib/color-picker/index.js').then(() => {
    Coloris.set({
      el: '[data-coloris]',
      themeMode: 'dark',
      alpha: true,
      format: 'hex',
      wrap: true,
      clearButton: false,
      closeButton: false,
    })
    ready = true
    pending = null
  })
  return pending
}

export async function initColorPicker() {
  await ensureLoaded()
}

export function wrapColorPicker(container) {
  if (!ready) return
  container.querySelectorAll('[data-coloris]').forEach(input => {
    if (!input.closest('.clr-field')) Coloris.wrap(input)
    const clrField = input.closest('.clr-field')
    if (clrField) clrField.style.color = input.value || ''
  })
}

export function closeColorPicker() {
  if (ready) Coloris.close()
}
