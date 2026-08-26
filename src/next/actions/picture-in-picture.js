let activePipWindow = null
let activePipReplacement = null
let pipSessionCounter = 0

function copyDocumentStyles(targetDocument) {
  const base = targetDocument.createElement('base')
  base.href = document.baseURI
  targetDocument.head.append(base)

  // Preserve Vite's emitted stylesheet links and their load order. Reading
  // cssRules misses linked/imported stylesheets and can fail on protected sheets.
  const pendingLoads = []
  document.head.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    const clone = node.cloneNode(true)
    if (clone instanceof HTMLLinkElement && clone.href) {
      pendingLoads.push(new Promise((resolve) => {
        clone.addEventListener('load', resolve, {once: true})
        clone.addEventListener('error', resolve, {once: true})
      }))
    }
    targetDocument.head.append(clone)
  })
  return Promise.all(pendingLoads)
}

function applyPipDocumentChrome(pipDocument) {
  pipDocument.documentElement.className = document.documentElement.className
  pipDocument.body.className = document.body.className
  pipDocument.body.setAttribute('data-picture-in-picture', '')
  pipDocument.body.style.cssText = 'margin:0; min-width:0; min-height:100vh; overflow:hidden;'
  pipDocument.body.innerHTML = '<div data-pip-loading aria-live="polite">Loading…</div>'

  const style = pipDocument.createElement('style')
  style.textContent = `
    [data-pip-loading] {
      display: grid;
      min-height: 100vh;
      place-items: center;
      color: var(--st-color-text, #fff);
      background: var(--st-app-background-color, #171717);
      font: 500 13px/1.2 system-ui, sans-serif;
    }
    [data-pip-content][data-floating-window] {
      position: static !important;
      inset: auto !important;
      width: 100% !important;
      min-width: 0 !important;
      max-width: none !important;
      height: 100vh !important;
      max-height: none !important;
      box-sizing: border-box;
    }
    [data-pip-content] [data-window-actions],
    [data-pip-content] [data-window-resize-handle],
    [data-pip-trigger] {
      display: none !important;
    }
    [data-pip-content][data-module-card] {
      width: 100% !important;
      height: 100vh !important;
      min-height: 0 !important;
      box-sizing: border-box;
    }
    [data-pip-content][data-module-card] [data-module-card-body] {
      min-height: 0 !important;
    }
  `
  pipDocument.head.append(style)
}

function markPipBridgeNodes(root) {
  const sessionId = `pip-${++pipSessionCounter}`
  root.querySelectorAll('[data-click], [data-action], [data-tab-action]').forEach((element, index) => {
    if (!element.hasAttribute('data-pip-action-id')) {
      element.setAttribute('data-pip-action-id', `${sessionId}-action-${index}`)
    }
  })
  root.querySelectorAll('[data-yai-tabs]').forEach((element, index) => {
    if (!element.hasAttribute('data-pip-scope-id')) {
      element.setAttribute('data-pip-scope-id', `${sessionId}-scope-${index}`)
    }
  })
}

function syncPipContent(pipDocument, replacement) {
  const pipContent = pipDocument.querySelector('[data-pip-content]')
  if (!pipContent) return

  const scrollPositions = [...pipContent.querySelectorAll('.st-module-feed-list, .st-module-feed-list-inner')]
    .map((element) => ({top: element.scrollTop, left: element.scrollLeft}))

  markPipBridgeNodes(replacement)
  const nextPipContent = replacement.cloneNode(true)
  nextPipContent.removeAttribute('data-module-in-pip')
  nextPipContent.setAttribute('data-pip-content', '')
  pipContent.replaceWith(nextPipContent)

  nextPipContent.querySelectorAll('.st-module-feed-list, .st-module-feed-list-inner').forEach((element, index) => {
    const position = scrollPositions[index]
    if (!position) return
    element.scrollTop = position.top
    element.scrollLeft = position.left
  })
}

export function syncPictureInPicture() {
  if (!activePipWindow || activePipWindow.closed || !activePipReplacement?.isConnected) return
  syncPipContent(activePipWindow.document, activePipReplacement)
}

function bindPipInteractionBridge(pipDocument, replacement) {
  pipDocument.addEventListener('click', (event) => {
    // PiP has its own Window realm, so instanceof Element from the opener is
    // always false here. Use the DOM node type instead.
    const source = event.target?.nodeType === 1 ? event.target : null
    const target = source?.closest?.('[data-click], [data-action], [data-tab-action], a, button, input, select, textarea')
    if (!target) return

    const actionId = target.getAttribute('data-pip-action-id')
    if (!actionId) return
    const replacementTarget = replacement.querySelector(`[data-pip-action-id="${CSS.escape(actionId)}"]`)
    if (!(replacementTarget instanceof HTMLElement)) return

    event.preventDefault()
    replacementTarget.click()
    syncPipContent(pipDocument, replacement)
  }, true)
}

function resolveTarget(trigger) {
  const selector = trigger.dataset.pipTarget || trigger.dataset.target || ''
  if (!selector) return null
  try {
    const target = document.querySelector(selector)
    return target instanceof HTMLElement ? target : null
  } catch {
    return null
  }
}

function getDimension(trigger, key, fallback) {
  const raw = trigger.dataset[`pip${key}`] || trigger.dataset[key.toLowerCase()] || ''
  const value = Number.parseInt(raw, 10)
  return Number.isFinite(value) ? Math.max(240, Math.min(value, 1600)) : fallback
}

export const pictureInPictureActions = {
  async openInPip(trigger) {
    const documentPictureInPicture = window.documentPictureInPicture
    const target = resolveTarget(trigger)
    if (!documentPictureInPicture || !target?.isConnected) return

    if (activePipWindow && !activePipWindow.closed) {
      activePipWindow.focus()
      return
    }

    try {
      const pipWindow = await documentPictureInPicture.requestWindow({
        width: getDimension(trigger, 'Width', 720),
        height: getDimension(trigger, 'Height', 520),
      })
      activePipWindow = pipWindow
      const stylesReady = copyDocumentStyles(pipWindow.document)
      applyPipDocumentChrome(pipWindow.document)
      await stylesReady

      // The clone stays in the Speedtab document as the working replacement.
      // The original can be discarded with the PiP window, so close needs no restore work.
      markPipBridgeNodes(target)
      const replacement = target.cloneNode(true)
      target.replaceWith(replacement)
      activePipReplacement = replacement
      const isNoteWindow = target.matches('[data-floating-window][data-window-type="note"]')
      const isModuleCard = target.matches('[data-module-card]')
      if (isNoteWindow || isModuleCard) replacement.setAttribute('data-module-in-pip', '')
      target.setAttribute('data-pip-content', '')
      pipWindow.document.querySelector('[data-pip-loading]')?.remove()
      const mount = isNoteWindow ? pipWindow.document.createElement('div') : pipWindow.document.body
      if (isNoteWindow) {
        mount.setAttribute('data-floating-windows', '')
        pipWindow.document.body.append(mount)
      }
      mount.append(target)
      bindPipInteractionBridge(pipWindow.document, replacement)

      pipWindow.addEventListener('pagehide', () => {
        replacement.removeAttribute('data-module-in-pip')
        activePipReplacement = null
        activePipWindow = null
      }, {once: true})
    } catch (error) {
      activePipWindow = null
      console.warn('[Speedtab PiP] Unable to open picture-in-picture.', error)
    }
  },
}
