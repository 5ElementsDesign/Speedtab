import DOMPurify from 'dompurify'

// ─── Strict allowlist for html notes ──────────────────────────────────────────
// Keep the markup strict, but DO NOT strip the data-* attributes that power
// YAI / YEH / YaiTabs content inside html notes. Scripts, inline event
// handlers, forms, and dangerous protocols still remain forbidden.

const ALLOWED_TAGS = [
  'a', 'p', 'br', 'hr', 'span', 'div',
  'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'small', 'sub', 'sup', 'del', 'ins', 'cite',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hgroup',
  'ul', 'ol', 'li', 'menu',
  'dl', 'dt', 'dd',
  'blockquote', 'pre', 'code', 'kbd', 'samp',
  'picture', 'figure', 'img',
  'details', 'summary',
  'nav', 'aside', 'article', 'main', 'address', 'header', 'footer',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'button',
  'textarea',
]

const ALLOWED_ATTR = [
  'href', 'title', 'target', 'rel',
  'class',
  'src', 'alt',
  'width', 'height',
  'loading',
  'colspan', 'rowspan',
]

/**
 * Sanitise untrusted HTML for the `html` note type. Strips:
 *   - all <script>, <style>, <iframe>, <object>, <embed>, <form>, <input> tags
 *   - all event handlers (onerror, onclick, onload, …)
 *   - javascript: / vbscript: / data: URIs in href and src
 *   - any tag/attribute not in the allowlist above
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
    if (node.nodeName === 'A' && node instanceof Element) {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel',    'noopener noreferrer')
    }
  })
  hookInstalled = true
}

// Auto-install only in DOM-capable contexts.
if (typeof document !== 'undefined') {
  installSanitizeHooks()
}
