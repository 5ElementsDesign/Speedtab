type HighlightJs = typeof import('highlight.js/lib/common')

let highlighterPromise: Promise<HighlightJs['default']> | null = null

async function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = import('highlight.js/lib/common').then(mod => mod.default)
  }
  return highlighterPromise
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Highlight a code string and return safe HTML.
 *  - If `language` is a known hljs alias, use it explicitly.
 *  - Otherwise fall back to `highlightAuto` (limited to common languages from
 *    `lib/common`, which keeps the bundle small).
 *
 * The output is HTML produced by hljs itself; it contains only <span class>
 * wrappers and is safe to render with v-html.
 */
export async function highlightCode(code: string, language?: string | null): Promise<string> {
  const hljs = await getHighlighter()
  if (language && hljs.getLanguage(language)) {
    return hljs.highlight(code, { language, ignoreIllegals: true }).value
  }
  return hljs.highlightAuto(code).value
}

/** List of language aliases that ship with `lib/common` (used by the form). */
export const COMMON_LANGUAGES = [
  'plaintext',
  'bash', 'shell',
  'javascript', 'typescript', 'json',
  'html', 'xml', 'css', 'scss',
  'python', 'go', 'rust', 'java', 'php', 'ruby',
  'sql', 'yaml', 'markdown', 'dockerfile',
] as const

export type CommonLanguage = typeof COMMON_LANGUAGES[number]
