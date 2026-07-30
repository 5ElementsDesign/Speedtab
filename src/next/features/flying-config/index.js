import {loadNoteById, saveNoteData} from '../../data/notes.js'
import {escapeHtml} from '../../utils/html.js'
import {buildNotePayload} from '../modules/note-form.js'

let tabsInstance = null

/**
 * Single integration point for Flying Config.
 * The existing YaiTabs instance remains the event delegation layer.
 */
export function installFlyingConfig(tabs, onEvent) {
  if (!tabs?.hook || typeof onEvent !== 'function') return () => {}
  tabsInstance = tabs

  const eventClick = (context) => {
    const {target, action} = context ?? {}
    if (!target?.matches?.('[data-flying-config-trigger], [data-flying-config-menu], [data-flying-config-target-index], [data-click="saveFlyingConfig"], [data-flying-config-back], [data-flying-config-maximize], [data-flying-config-close], [data-flying-config-remove-markers], [data-flying-config-add], [data-flying-config-delete], [data-flying-config-view-toggle]')) return
    onEvent({target, action, event: context?.event})
  }

  const eventInput = (context) => {
    const {target, action} = context ?? {}
    if (!target?.matches?.('[data-input="filterFlyingConfig"]')) return
    onEvent({target, action, event: context?.event})
  }

  tabs.hook('eventClick', eventClick)
  tabs.hook('eventInput', eventInput)
  return () => {
    tabs.unhook?.('eventClick', eventClick)
    tabs.unhook?.('eventInput', eventInput)
    tabsInstance = null
  }
}

function getDirectTabButtons(container) {
  return [...container.querySelectorAll('[data-open]')]
    .filter((button) => button.closest('[data-yai-tabs]') === container)
}

function getNestedComponents(scope, owner, orderedContainers = []) {
  if (orderedContainers.length) {
    return orderedContainers.filter((container) => (
      container !== owner
      && container.parentElement?.closest('[data-yai-tabs]') === owner
      && scope.contains(container)
    ))
  }
  return [...scope.querySelectorAll('[data-yai-tabs]')]
    .filter((container) => container !== owner && container.parentElement?.closest('[data-yai-tabs]') === owner)
}

function getRootComponents(body) {
  const containers = [...body.querySelectorAll('[data-yai-tabs]')]
  return containers.filter((container) => {
    const parent = container.parentElement?.closest('[data-yai-tabs]')
    return !(parent instanceof HTMLElement) || !body.contains(parent)
  })
}

function resolveTargetPath(noteWindow, path) {
  const body = noteWindow?.nodeName === 'BODY' || noteWindow?.matches?.('[data-note-window-body]')
    ? noteWindow
    : noteWindow?.querySelector?.('[data-note-window-body]')
  if (!(body instanceof HTMLElement)) return null
  const parts = path.split('.').map((part) => Number.parseInt(part, 10))
  if (!parts.length || parts.some((part) => !Number.isInteger(part) || part < 0)) return null

  let container = getRootComponents(body)[parts[0] - 1]
  let button = null
  let panel = null
  for (let index = 1; container && index < parts.length; index += 2) {
    button = getDirectTabButtons(container)[parts[index]]
    if (!button) return null
    panel = container.querySelector(`:scope > [data-content] [data-tab="${CSS.escape(button.dataset.open ?? '')}"]`)
    if (index + 1 >= parts.length) break
    const children = panel ? getNestedComponents(panel, container) : []
    container = children[parts[index + 1]]
  }
  return button && panel ? {button, panel} : null
}

function cleanRuntimeYaiTabsAttributes(scope) {
  if (scope.querySelector('[data-flying-config-active]')) {
    scope.querySelectorAll('[data-flying-config-active]').forEach((element) => {
      element.removeAttribute('data-flying-config-active')
    })
  }
  scope.querySelectorAll('[data-yai-tabs]').forEach((container) => {
    const id = container.getAttribute('id') ?? ''
    if (id.startsWith('yai-tabs-')) container.removeAttribute('id')
    container.removeAttribute('data-nesting')
    container.removeAttribute('data-in-root')
    container.removeAttribute('data-last-active')
    container.classList.remove('tab-active')
    if (!container.classList.length) container.removeAttribute('class')
  })
}

function preserveYaiTabsAttributes(source, edited) {
  const structuralAttributes = [
    'data-yai-tabs', 'data-controller', 'data-content', 'data-tab',
    'data-tab-action', 'data-open', 'data-default',
  ]
  const sourceElements = source.querySelectorAll('[data-yai-tabs], [data-controller], [data-content], [data-tab], [data-tab-action], [data-open]')
  const editedElements = edited.querySelectorAll('[data-yai-tabs], [data-controller], [data-content], [data-tab], [data-tab-action], [data-open]')
  editedElements.forEach((element, index) => {
    const original = sourceElements[index]
    if (!(original instanceof HTMLElement)) return
    structuralAttributes.forEach((attribute) => {
      if (original.hasAttribute(attribute)) element.setAttribute(attribute, original.getAttribute(attribute) ?? '')
      else element.removeAttribute(attribute)
    })
  })
}

function getFlyingConfigContent(layer) {
  const textarea = layer.querySelector('#flying-config-content')
  const visual = layer.querySelector('[data-flying-config-visual-editor]')
  if (visual instanceof HTMLElement && !visual.hidden) return visual.innerHTML
  return textarea instanceof HTMLTextAreaElement ? textarea.value : ''
}

async function saveFlyingConfigTarget(noteWindow, layer) {
  const noteId = Number.parseInt(noteWindow.dataset.noteWindowId ?? '', 10)
  const path = layer.dataset.targetIndex ?? ''
  const labelInput = layer.querySelector('#flying-config-tab-label')
  if (!Number.isInteger(noteId) || !(labelInput instanceof HTMLInputElement)) return false

  const note = await loadNoteById(noteId)
  if (!note || note.type !== 'html') return false

  const sourceDocument = new DOMParser().parseFromString(note.content ?? '', 'text/html')
  const target = resolveTargetPath(sourceDocument.body, path)
  if (!target) return false
  target.button.textContent = labelInput.value
  const editedPanel = sourceDocument.createElement('div')
  editedPanel.innerHTML = getFlyingConfigContent(layer)
  preserveYaiTabsAttributes(target.panel, editedPanel)
  target.panel.innerHTML = editedPanel.innerHTML
  cleanRuntimeYaiTabsAttributes(sourceDocument.body)

  const saved = await persistSourceDocument(noteId, note, sourceDocument)
  if (!saved) return false

  const liveTarget = resolveTargetPath(noteWindow, path)
  if (liveTarget) {
    liveTarget.button.textContent = labelInput.value
    const liveEditedPanel = document.createElement('div')
    liveEditedPanel.innerHTML = getFlyingConfigContent(layer)
    preserveYaiTabsAttributes(liveTarget.panel, liveEditedPanel)
    liveTarget.panel.innerHTML = liveEditedPanel.innerHTML
    tabsInstance?.initializeAllContainers?.(liveTarget.panel, {staticDefaults: true})
  }
  return true
}

async function persistSourceDocument(noteId, note, sourceDocument) {
  let payload
  try {
    payload = await buildNotePayload({
      title: note.title ?? '',
      type: note.type,
      content: sourceDocument.body.innerHTML,
      styleToken: note.style_token,
      language: 'auto',
    }, () => {})
  } catch (error) {
    return false
  }
  if (!payload) return false
  try {
    await saveNoteData(noteId, payload)
  } catch (error) {
    return false
  }
  return true
}

async function loadStoredTarget(noteWindow, path) {
  const noteId = Number.parseInt(noteWindow.dataset.noteWindowId ?? '', 10)
  if (!Number.isInteger(noteId)) return null
  const note = await loadNoteById(noteId)
  if (!note || note.type !== 'html') return null
  const sourceDocument = new DOMParser().parseFromString(note.content ?? '', 'text/html')
  return resolveTargetPath(sourceDocument.body, path)
}

function resolveComponentPath(noteWindow, path) {
  const body = noteWindow?.nodeName === 'BODY' || noteWindow?.matches?.('[data-note-window-body]')
    ? noteWindow
    : noteWindow?.querySelector?.('[data-note-window-body]')
  if (!(body instanceof HTMLElement)) return null
  const parts = path.split('.').map((part) => Number.parseInt(part, 10))
  if (!parts.length || parts.some((part) => !Number.isInteger(part) || part < 0)) return null
  let container = getRootComponents(body)[parts[0] - 1]
  for (let index = 1; container && index < parts.length; index += 2) {
    const button = getDirectTabButtons(container)[parts[index]]
    const panel = button
      ? container.querySelector(`:scope > [data-content] [data-tab="${CSS.escape(button.dataset.open ?? '')}"]`)
      : null
    if (!panel) return null
    const children = getNestedComponents(panel, container)
    container = children[parts[index + 1]]
  }
  return container ?? null
}

async function mutateFlyingConfigTarget(noteWindow, action, path) {
  const noteId = Number.parseInt(noteWindow.dataset.noteWindowId ?? '', 10)
  if (!Number.isInteger(noteId)) return false
  const note = await loadNoteById(noteId)
  if (!note || note.type !== 'html') return false
  const sourceDocument = new DOMParser().parseFromString(note.content ?? '', 'text/html')

  if (action === 'delete-component') {
    const component = resolveComponentPath(sourceDocument.body, path)
    if (!(component instanceof HTMLElement)) return false
    component.remove()
  } else if (action === 'delete') {
    const target = resolveTargetPath(sourceDocument.body, path)
    const component = path.split('.').slice(0, -1).join('.')
    const componentTarget = resolveComponentPath(sourceDocument.body, component)
    if (!target || !(componentTarget instanceof HTMLElement) || getDirectTabButtons(componentTarget).length <= 1) return false
    target.button.remove()
    target.panel.remove()
  } else {
    const componentTarget = resolveComponentPath(sourceDocument.body, path)
    const controller = componentTarget?.querySelector(':scope > [data-controller]')
    const content = componentTarget?.querySelector(':scope > [data-content]')
    if (!(componentTarget instanceof HTMLElement) || !(controller instanceof HTMLElement) || !(content instanceof HTMLElement)) return false
    const open = `flying-${Date.now()}`
    const button = sourceDocument.createElement('button')
    button.type = 'button'
    button.dataset.tabAction = 'open'
    button.dataset.open = open
    button.textContent = 'New Tab'
    const panel = sourceDocument.createElement('div')
    panel.dataset.tab = open
    panel.textContent = ''
    controller.append(button)
    content.append(panel)
  }

  cleanRuntimeYaiTabsAttributes(sourceDocument.body)
  if (!await persistSourceDocument(noteId, note, sourceDocument)) return false
  return action === 'add' ? {open} : {}
}

function renderTargetBreadcrumb(layer, label) {
  const targets = layer.querySelector('[data-flying-config-targets]')
  if (!(targets instanceof HTMLElement)) return
  targets.dataset.flyingConfigCollapsed = ''
  targets.innerHTML = `
    <button type="button" data-btn="light" data-click="openFlyingConfig" data-flying-config-back title="Back"><i data-icon="arrow" aria-hidden="true" class="rotate-top-to-left"></i></button>
    <span data-flying-config-breadcrumb>${escapeHtml(label)}</span>
    <button type="button" class="ml-auto" data-btn="light" data-click="openFlyingConfig" data-flying-config-view-toggle title="Switch visual editor">Visual</button>

    <small class="ml-auto" data-flying-config-save-status aria-live="polite"></small>
    <button type="button" data-btn="danger" data-click="saveFlyingConfig">SAVE</button>
  `
}

function renderTargetEditor(layer, target) {
  const existing = layer.querySelector('[data-flying-config-edit]')
  existing?.remove()
  const editor = document.createElement('div')
  editor.dataset.flyingConfigEdit = ''
  editor.innerHTML = `<label><span class="sr-only">Tab button</span><input id="flying-config-tab-label" name="flying-config-tab-label" type="text" value="${escapeHtml(target.button.textContent?.trim() ?? '')}"></label><label><span class="sr-only">Content</span><textarea id="flying-config-content" name="flying-config-content">${escapeHtml(target.panel.innerHTML)}</textarea></label>`
  const visual = document.createElement('div')
  visual.dataset.flyingConfigVisualEditor = ''
  visual.contentEditable = 'true'
  visual.hidden = true
  visual.setAttribute('aria-label', 'Visual content editor')
  visual.innerHTML = target.panel.innerHTML
  editor.append(visual)
  layer.append(editor)
}

function filterComponentTree(input) {
  const layer = input.closest('[data-flying-config-customize]')
  if (!(layer instanceof HTMLElement)) return
  const query = input.value.trim().toLocaleLowerCase()
  layer.querySelectorAll('[data-flying-config-tab]').forEach((item) => {
    const matches = !query || [...item.querySelectorAll('[data-flying-config-target-index]')]
      .some((button) => button.textContent?.trim().toLocaleLowerCase().includes(query))
    item.toggleAttribute('hidden', !matches)
  })
}

function renderComponentTree(container, path, orderedContainers = [], markActive = false) {
  const buttons = getDirectTabButtons(container)
  return `
    <li data-flying-config-component data-flying-config-path="${escapeHtml(path)}">
      <div data-flying-config-component-label>
        <span>YaiTabs (${escapeHtml(path)})</span>
        <span data-flying-config-component-actions>
          <button type="button" data-click="openFlyingConfig" data-flying-config-add data-flying-config-path="${escapeHtml(path)}" title="Add New Tab"><i data-icon="plus" aria-hidden="true"></i></button>
          <button type="button" data-click="openFlyingConfig" data-flying-config-delete data-flying-config-component-path data-flying-config-path="${escapeHtml(path)}" title="Delete this Component"><i data-icon="trash" aria-hidden="true"></i></button>
        </span>
      </div>
      <ul>
        ${buttons.map((button, index) => {
          const open = button.dataset.open ?? ''
          const label = button.textContent?.trim() || open || `Tab ${index + 1}`
          const isActive = markActive && (button.classList.contains('active') || container.dataset.lastActive === open)
          const panel = container.querySelector(`:scope > [data-content] [data-tab="${CSS.escape(open)}"]`)
          const children = panel ? getNestedComponents(panel, container, orderedContainers) : []
          return `
            <li data-flying-config-tab data-flying-config-tab-path="${escapeHtml(`${path}.${index}`)}">
              <div data-tab-action-wrapper>
                <div data-tab-default><button type="button" data-click="openFlyingConfig" data-flying-config-target-index="${escapeHtml(`${path}.${index}`)}"${isActive ? ' data-flying-config-active' : ''}>${escapeHtml(label)}</button></div>
                <div data-tab-actions><button type="button" data-click="openFlyingConfig" data-flying-config-delete data-flying-config-path="${escapeHtml(`${path}.${index}`)}" title="Delete this Tab"><i data-icon="trash" aria-hidden="true"></i></button></div>
              </div>
              ${children.length ? `<ul>${children.map((child, childIndex) => renderComponentTree(child, `${path}.${index}.${childIndex}`, orderedContainers, markActive)).join('')}</ul>` : ''}
            </li>
          `
        }).join('')}
      </ul>
    </li>
  `
}

function renderComponentTreeList(noteWindow, markActive = false) {
  const body = noteWindow.querySelector('[data-note-window-body]')
  if (!(body instanceof HTMLElement)) return ''
  const containers = [...body.querySelectorAll('[data-yai-tabs]')]
  const rootContainers = getRootComponents(body)
  const orderedContainers = containers
  return rootContainers.map((container, index) => renderComponentTree(container, String(index + 1), orderedContainers, markActive)).join('')
}

export async function openFlyingConfig(target) {
  const noteWindow = target?.closest?.('[data-floating-window][data-note-window-id]')
  if (!(noteWindow instanceof HTMLElement)) return

  if (target.matches('[data-flying-config-maximize]')) {
    noteWindow.classList.toggle('st-maximized-note-open')
    return
  }

  if (target.matches('[data-flying-config-close]')) {
    target.closest('[data-flying-config-customize]')?.remove()
    return
  }

  if (target.matches('[data-flying-config-view-toggle]')) {
    const layer = target.closest('[data-flying-config-customize]')
    const textarea = layer?.querySelector('#flying-config-content')
    const visual = layer?.querySelector('[data-flying-config-visual-editor]')
    if (!(textarea instanceof HTMLTextAreaElement) || !(visual instanceof HTMLElement)) return
    if (visual.hidden) {
      visual.innerHTML = textarea.value
      textarea.hidden = true
      visual.hidden = false
      target.textContent = 'HTML'
      target.title = 'Switch HTML editor'
    } else {
      textarea.value = visual.innerHTML
      visual.hidden = true
      textarea.hidden = false
      target.textContent = 'Visual'
      target.title = 'Switch visual editor'
    }
    return
  }

  if (target.matches('[data-flying-config-remove-markers]')) {
    noteWindow.querySelectorAll('[data-flying-config-active]').forEach((element) => {
      element.removeAttribute('data-flying-config-active')
    })
    return
  }

  if (target.matches('[data-flying-config-add], [data-flying-config-delete]')) {
    const layer = target.closest('[data-flying-config-customize]')
    const targets = layer?.querySelector('[data-flying-config-targets]')
    const componentPath = target.dataset.flyingConfigPath ?? ''
    const isComponentDelete = target.hasAttribute('data-flying-config-component-path')
    const path = componentPath
    if (!(layer instanceof HTMLElement) || !(targets instanceof HTMLElement) || !path) return
    const action = target.matches('[data-flying-config-add]')
      ? 'add'
      : (isComponentDelete ? 'delete-component' : 'delete')
    if (action.startsWith('delete') && !window.confirm(`Delete ${action === 'delete-component' ? 'this component' : 'this tab'}?`)) return
    const result = await mutateFlyingConfigTarget(noteWindow, action, path)
  if (result) {
    if (action === 'delete-component') {
      resolveComponentPath(noteWindow, path)?.remove()
    } else if (action === 'delete') {
      const liveTarget = resolveTargetPath(noteWindow, path)
      liveTarget?.button.remove()
      liveTarget?.panel.remove()
    } else {
      const liveComponent = resolveComponentPath(noteWindow, path)
      const controller = liveComponent?.querySelector(':scope > [data-controller]')
      const content = liveComponent?.querySelector(':scope > [data-content]')
      if (liveComponent instanceof HTMLElement && controller instanceof HTMLElement && content instanceof HTMLElement) {
        const button = document.createElement('button')
        button.type = 'button'
        button.dataset.tabAction = 'open'
        button.dataset.open = result.open
        button.textContent = 'New Tab'
        const panel = document.createElement('div')
        panel.dataset.tab = result.open
        controller.append(button)
        content.append(panel)
        tabsInstance?.initializeAllContainers?.(liveComponent, {staticDefaults: true})
      }
    }
      targets.innerHTML = `<ul>${renderComponentTreeList(noteWindow)}</ul>`
  }
    return
  }

  if (target.matches('[data-click="saveFlyingConfig"]')) {
    const layer = target.closest('[data-flying-config-customize]')
    if (layer instanceof HTMLElement) {
      const saved = await saveFlyingConfigTarget(noteWindow, layer)
      const status = layer.querySelector('[data-flying-config-save-status]')
      if (status instanceof HTMLElement) {
        status.textContent = saved ? 'OK' : 'Error'
        status.dataset.state = saved ? 'success' : 'error'
        setTimeout(() => {
          status.textContent = '';
          status.dataset.state = null;
        }, 1500);
      }
    }
    return
  }

  if (target.matches('[data-flying-config-back]')) {
    const layer = target.closest('[data-flying-config-customize]')
    const targets = layer?.querySelector('[data-flying-config-targets]')
    if (!(layer instanceof HTMLElement) || !(targets instanceof HTMLElement)) return
    delete layer.dataset.targetIndex
    delete targets.dataset.flyingConfigCollapsed
    targets.innerHTML = `<ul>${renderComponentTreeList(noteWindow)}</ul>`
    layer.querySelector('[data-flying-config-edit]')?.remove()
    return
  }

  if (target.matches('[data-flying-config-target-index]')) {
    const layer = target.closest('[data-flying-config-customize]')
    if (!(layer instanceof HTMLElement)) return
    const path = target.dataset.flyingConfigTargetIndex ?? ''
    const resolved = resolveTargetPath(noteWindow, path)
    if (!resolved) return
    const stored = await loadStoredTarget(noteWindow, path)
    if (!stored) return
    layer.dataset.targetIndex = path
    layer.querySelectorAll('[data-flying-config-target-index]').forEach((button) => {
      button.toggleAttribute('aria-pressed', button === target)
    })
    renderTargetBreadcrumb(layer, stored.button.textContent?.trim() || path)
    renderTargetEditor(layer, stored)
    return
  }

  if (target.matches('[data-flying-config-menu="customize"]')) {
    const existing = noteWindow.querySelector('[data-flying-config-customize]')
    if (existing) {
      existing.remove()
      return
    }

    const layer = document.createElement('section')
    layer.dataset.flyingConfigCustomize = ''
    layer.innerHTML = `
      <div data-flying-config-actions>
        <label><span>Filter:</span><input data-input="filterFlyingConfig" name="search-in-yai-tabs" type="search" placeholder="Live filter"></label>
        <div>
          <button type="button" data-btn="light" data-click="openFlyingConfig" data-flying-config-remove-markers>Remove all active markers</button>
          <button type="button" data-btn="light" data-click="openFlyingConfig" data-flying-config-close title="Close Customize"><i data-icon="x" aria-hidden="true"></i></button>
        </div>
      </div>
      <div data-flying-config-targets>
        <ul>${renderComponentTreeList(noteWindow, true)}</ul>
      </div>
    `
    noteWindow.prepend(layer)
    return
  }

  if (target.matches('[data-input="filterFlyingConfig"]')) {
    filterComponentTree(target)
    return
  }

  const noteId = noteWindow.dataset.noteWindowId
  if (noteWindow.hasAttribute('data-flying-config-active')) {
    noteWindow.querySelector('[data-flying-config]')?.remove()
    noteWindow.querySelector('[data-flying-config-customize]')?.remove()
    noteWindow.removeAttribute('data-flying-config-active')
    return
  }

  const bar = document.createElement('nav')
  bar.dataset.noteId = noteId
  bar.setAttribute('data-flying-config', '')
  bar.setAttribute('aria-label', 'Flying Config')
  bar.innerHTML = `
    <button type="button" data-click="openFlyingConfig" data-flying-config-menu="customize">Customize</button>
    <button type="button" class="ml-auto" data-click="openFlyingConfig" data-flying-config-maximize>Maximize</button>
  `
  noteWindow.setAttribute('data-flying-config-active', '')
  noteWindow.prepend(bar)
}
