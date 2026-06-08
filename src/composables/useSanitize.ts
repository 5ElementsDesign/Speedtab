import DOMPurify from 'dompurify'

// ─── Strict allowlist for html notes ──────────────────────────────────────────
// Block-level tags for layout, inline tags for emphasis, lists, code, tables,
// and anchors. Scripts, iframes, forms, event handlers, and javascript:/data:
// URIs are all forbidden by virtue of not being in the allowlist.

const ALLOWED_TAGS = [
  'a', 'p', 'br', 'hr', 'span', 'div',
  'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'small', 'sub', 'sup', 'del', 'ins', 'cite',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hgroup',
  'ul', 'ol', 'li', 'menu',
  'dl', 'dt', 'dd',
  'blockquote', 'pre', 'code', 'kbd', 'samp',
  'picture', 'figure',
  'details', 'summary',
  'nav', 'aside', 'article', 'address',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'textarea',
]

const ALLOWED_ATTR = [
  'href', 'title', 'target', 'rel',
  'class',
  'colspan', 'rowspan',
]

/**
 * Sanitise untrusted HTML for the `html` note type. Strips:
 *   - all <script>, <style>, <iframe>, <object>, <embed>, <form>, <input> tags
 *   - all event handlers (onerror, onclick, onload, …)
 *   - javascript: / vbscript: / data: URIs in href and src
 *   - any tag/attribute not in the allowlist above
 *
 * `RETURN_TRUSTED_TYPE: false` keeps the API as a plain string, which is what
 * Vue's `v-html` binding consumes.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR:         false,
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
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName === 'A' && node instanceof Element) {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel',    'noopener noreferrer')
    }
  })
  hookInstalled = true
}

// Auto-install on first import so callers don't have to remember.
installSanitizeHooks()
