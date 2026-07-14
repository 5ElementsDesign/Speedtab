export function createFragment(markup = '') {
  const template = document.createElement('template')
  template.innerHTML = String(markup).trim()
  return template.content.firstElementChild
}

export function patchHost(host, markup = '') {
  if (!(host instanceof HTMLElement)) return null

  const next = createFragment(markup)
  if (!(next instanceof HTMLElement)) return host

  for (const attr of [...host.attributes]) {
    host.removeAttribute(attr.name)
  }
  for (const attr of [...next.attributes]) {
    host.setAttribute(attr.name, attr.value)
  }
  host.innerHTML = next.innerHTML
  return host
}

export function replaceNode(node, markup = '') {
  if (!(node instanceof Element)) return null
  const next = createFragment(markup)
  if (!(next instanceof Element)) return null
  node.replaceWith(next)
  return next
}

export function patchInner(host, markup = '') {
  if (!(host instanceof HTMLElement)) return null
  const next = createFragment(`<div data-patch-inner-root>${String(markup)}</div>`)
  if (!(next instanceof HTMLElement)) return host
  host.innerHTML = next.innerHTML
  return host
}

export function readActiveFieldState() {
  const active = document.activeElement
  if (
    !(active instanceof HTMLInputElement)
    && !(active instanceof HTMLTextAreaElement)
    && !(active instanceof HTMLSelectElement)
  ) {
    return null
  }

  return {
    name: active.name || '',
    id: active.id || '',
    selectionStart: active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
      ? active.selectionStart
      : null,
    selectionEnd: active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
      ? active.selectionEnd
      : null,
  }
}

export function restoreActiveFieldState(root, snapshot) {
  if (!(root instanceof HTMLElement) || !snapshot) return

  requestAnimationFrame(() => {
    let field = null

    if (snapshot.id) {
      field = root.querySelector(`#${CSS.escape(snapshot.id)}`)
    }
    if (!field && snapshot.name) {
      field = root.querySelector(`[name="${CSS.escape(snapshot.name)}"]`)
    }

    if (
      !(field instanceof HTMLInputElement)
      && !(field instanceof HTMLTextAreaElement)
      && !(field instanceof HTMLSelectElement)
    ) {
      return
    }

    field.focus()
    if (
      snapshot.selectionStart !== null
      && snapshot.selectionEnd !== null
      && (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)
    ) {
      field.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd)
    }
  })
}
