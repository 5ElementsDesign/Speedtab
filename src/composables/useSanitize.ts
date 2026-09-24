import DOMPurify from 'dompurify'

// ─── Strict allowlist for html notes ──────────────────────────────────────────
// Keep the markup strict, but DO NOT strip the data-* attributes that power
// YAI / YEH / YaiTabs content inside html notes. Scripts, inline event
// handlers, forms, and dangerous protocols still remain forbidden.
//
// Notes may include presentation-only CSS. Inline <style> blocks are useful
// for self-contained note widgets; external stylesheets are deliberately
// limited to Speedtab's own GitHub Pages repository.

const ALLOWED_TAGS = [
  'a', 'p', 'br', 'hr', 'span', 'div', 'style', 'link',
  'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'small', 'sub', 'sup', 'del', 'ins', 'cite', 'time',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hgroup',
  'ul', 'ol', 'li', 'menu',
  'dl', 'dt', 'dd',
  'blockquote', 'pre', 'code', 'kbd', 'samp',
  'picture', 'figure', 'img',
  'details', 'summary',
  'nav', 'aside', 'article', 'section', 'main', 'address', 'header', 'footer',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'button',
  'form', 'label', 'fieldset', 'legend',
  'input', 'select', 'option', 'optgroup', 'datalist', 'textarea',
  'output', 'meter', 'progress', 'data', 'var', 'abbr', 'q',
]

const SPEEDTAB_REPOSITORY_BASE_URL = 'https://5elementsdesign.github.io/Speedtab/'

const ALLOWED_ATTR = [
  'href', 'title', 'target', 'rel',
  'id', 'class',
  'src', 'alt',
  'width', 'height',
  'loading',
  'colspan', 'rowspan',
  'name', 'value', 'type', 'placeholder', 'for', 'list',
  'min', 'max', 'step', 'low', 'high', 'optimum',
  'checked', 'selected', 'disabled', 'readonly', 'required', 'multiple', 'size',
  'rows', 'cols', 'maxlength', 'minlength', 'pattern', 'autocomplete', 'spellcheck',
  'data-url',
]

function isValidDynamicContentUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const url = value.trim()
  if (!url || /\s/.test(url)) return false
  if (/^(?:javascript|vbscript|data|file|jar|livescript|mocha|feed|about):/i.test(url)) return false
  if (/^(?:\/|\.\/|\.\.\/|#|\?)/.test(url)) return true

  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return !url.includes('://')
  }
}

function isSpeedtabRepositoryStyleUrl(value: string | null): boolean {
  if (!value) return false

  try {
    const url = new URL(value)
    return url.href.startsWith(SPEEDTAB_REPOSITORY_BASE_URL)
  } catch {
    return false
  }
}

/**
 * Sanitise untrusted HTML for the `html` note type. Strips:
 *   - executable or embedded content such as <script>, <iframe>, <object>, and <embed>
 *   - all event handlers (onerror, onclick, onload, …)
 *   - javascript: / vbscript: / data: URIs in href and src
 *   - any tag/attribute not in the allowlist above
 *   - external stylesheets unless they are hosted in Speedtab's GitHub Pages repository
 *   - BUT preserves safe data-* attributes so html notes can host YAI / YEH
 *     driven markup like nested tabs.
 *
 * `RETURN_TRUSTED_TYPE: false` keeps the API as a plain string, which is what
 * Vue's `v-html` binding consumes.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR:         true,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    // Keep body-level <style> and <link> markup in a note fragment instead
    // of letting the parser move it into a discarded document head.
    FORCE_BODY:               true,
  }) as unknown as string
}

/**
 * Hook: force `target="_blank"` and `rel="noopener noreferrer"` on every
 * sanitised anchor. Installed once per environment.
 */
let hookInstalled = false
export function installSanitizeHooks(): void {
  if (hookInstalled) return
  if (typeof DOMPurify.addHook !== 'function') return

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName === 'LINK' && node instanceof Element) {
      const rel = node.getAttribute('rel')?.trim().toLowerCase()
      if (rel !== 'stylesheet' || !isSpeedtabRepositoryStyleUrl(node.getAttribute('href'))) {
        node.remove()
        return
      }
    }

    if (node.nodeName === 'A' && node instanceof Element) {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel',    'noopener noreferrer')
    }
  })
  DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName === 'data-flying-config-active') data.keepAttr = false
    if (data.attrName === 'data-url') data.keepAttr = isValidDynamicContentUrl(data.attrValue)
  })
  hookInstalled = true
}

// Auto-install only in DOM-capable contexts.
if (typeof document !== 'undefined') {
  installSanitizeHooks()
}
