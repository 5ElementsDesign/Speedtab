export function extractLinkNoteUrls(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      if (line === '[hr]' || line.toLowerCase() === '<hr>') return []
      try {
        const url = new URL(line)
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          return [url.toString()]
        }
      } catch {
        // Plain text headings are allowed inside links notes.
      }
      return []
    })
}
