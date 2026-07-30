# Speedtab `next` — Style Guide & Principles

This folder is the vanilla-JS rebuild of Speedtab on top of YaiTabs / YaiCore / YEH,
replacing the old Vue + Tailwind implementation. No framework, no build-step magic,
no component lifecycle to manage. These are the rules that got us this far —
follow them so the folder stays as clean as it is today.

## Core principles

1. **One root, one mount.** `[data-yai-tabs]` on `#app` is the entire UI. We register a
   handful of delegated listeners once; everything inside is plain HTML that "just works"
   no matter how deep it's nested or how it got there (innerHTML, copy-paste, AJAX —
   doesn't matter).
2. **No lifecycle management.** Components are functions, not objects with mount/unmount.
   Re-rendering a region means replacing its `innerHTML`; delegated listeners on the
   container keep working because they were never attached to the replaced nodes.
3. **Render = pure functions returning HTML strings.** No virtual DOM, no diffing. A
   render function takes plain data in, returns a template string out. See
   `features/pages/render.js`.
4. **Escape everything that isn't a literal.** Any value that could plausibly come from
   IndexedDB or a user (titles, slugs, labels, hrefs, attribute values) goes through
   `escapeHtml()` before it touches a template string. See `utils/html.js`. This is not
   optional, even for "trusted" internal data — do it on principle, every time.
5. **Keep the folder empty until there's real content.** Don't pre-create feature/primitive
   folders "for later." A folder with nothing but a README is dead weight — delete it.
   Add a file when you're about to put working code in it, not before.
6. **Don't build one giant handler.** A single class with every `data-click` action as a
   method becomes unscannable fast. Split by domain (`actions/settings.js`,
   `actions/pages.js`, ...) and compose with spread. See "Adding a new action domain" below.

## YaiJS danger rule

Treat this project as **live DOM**, not as React/Vue with a virtual diff.

- A "re-render" here is real `innerHTML` / `replaceWith` DOM replacement.
- Replacing markup means real layout work, real image/fetch churn, real scroll/focus loss.
- If a thing already exists in the DOM, prefer **surgical mutation** over re-rendering the region.
- Only re-render a larger region when the structure itself genuinely changed and targeted mutation
  would be more complex or less safe.

Practical rule:

- **Good:** toggle attributes, replace one row, insert one body, update one text node, append one item.
- **Bad:** rebuild a whole list/module/panel because one item opened, one badge changed, or one title updated.

If you catch yourself thinking "in React I would just re-render this subtree", stop. That instinct is
wrong for Speedtab Next unless there is a very specific reason.

## Critical path marker

Some render entry points are deliberately marked with ALL-CAPS warnings in code.

- If you see a marker saying a path is **CRITICAL** or **DO NOT USE FOR STATE-ONLY UPDATES**,
  treat that as a hard repo rule, not a suggestion.
- On those paths, use shared DOM patch helpers from `utils/dom-patch.js` first.
- If you still think a rerender is needed, the code should explain exactly why the structure changed.

## Directory map

| Folder | Holds |
|---|---|
| `app/` | Composition root (`bootstrap.js`) and generic interaction infra (`handler.js`) |
| `actions/` | Domain action maps — the functions behind `data-click="actionName"` |
| `data/` | DB queries + hash/URL helpers, one file per record type (e.g. `pages.js`) |
| `features/<name>/` | Render functions for a feature area (e.g. `features/pages/render.js`) |
| `components/` | Reusable UI primitives that are *both* markup builders and behavior (e.g. `dropdown.js`, `modal.js`) |
| `utils/` | Small, pure, cross-cutting helpers with no DOM/app knowledge (`html.js`, `i18n.js`) |
| `styles/` | `next.css` (tokens + resets + layout) and `components.css` (component rules), wired by `@import` |

If a new concern doesn't fit one of these, that's a sign to ask "does this really need
its own home yet?" before creating one.

## Two event-dispatch paths — know which one to use

This is the single most important non-obvious thing in this codebase. There are **two
separate dispatch mechanisms**, and mixing them up silently breaks click handlers:

- **App actions** (business logic: open a modal, delete a module, ...) use
  `data-click="actionName"` markup anywhere inside `[data-yai-tabs]`. YaiCore
  auto-recognizes `data-click` as *its own* actionable attribute and intercepts those
  clicks before they'd ever reach an outer delegated listener. So actions are dispatched
  through YaiTabs' own hook system, in `bootstrap.js`:

  ```js
  tabs.hook('eventClick', ({target, action, event}) => {
    if (!action) return
    const fn = appActions[action]
    if (typeof fn === 'function') fn(target, event)
  })
  ```

  Never attach a generic `#app` click listener and expect it to see `data-click` events —
  it won't. Always go through `tabs.hook('eventClick', ...)`.

- **Generic UI behavior** (dropdown open/close, outside-click, Escape, resize/scroll
  repositioning, modal backdrop/close-button/Escape) is not app logic and doesn't use
  `data-click` at all — it keys off structural attributes (`data-dropdown-trigger`,
  `data-dropdown`, `data-modal-backdrop`, `data-modal-close`) and lives in YEH, via
  `app/handler.js`. This is infra, not actions, and stays generic across every dropdown
  or modal instance. Note `handler.js` delegates from `body`, not `#app` — the modal
  root mounts as a sibling of `#app` on `document.body` (see Components below), so
  `#app`-scoped delegation would miss it.

When adding new interactive markup, ask: is this "do something with app data" (→
`data-click` + `actions/`) or "make this UI element behave" (→ structural attribute +
`handler.js`)?

## Adding a new action domain

One file per domain, one object literal, spread into the composition point:

```js
// actions/pages.js
export const pageActions = {
  renamePage(target, event) {
    // ...
  },
}
```

```js
// app/bootstrap.js
import {pageActions} from '../actions/pages.js'

const appActions = {
  ...settingsActions,
  ...pageActions,
}
```

Markup anywhere triggers it: `<button data-click="renamePage">Rename</button>`.

## Components: render + behavior together, in one file

A component owns both its markup builder and its state-mutation functions — that's
the closest vanilla equivalent to a Vue SFC, without the framework. `components/dropdown.js`
is the reference:

- `buildDropdown(config)` — pure function, returns an HTML string from a data config:

  ```js
  buildDropdown({
    trigger: '<i data-icon="cog" aria-hidden="true"></i>',
    ariaLabel: 'Settings',
    triggerClass: 'st-app-header-action',
    items: [
      {label: 'App settings', action: 'openSettings'},
      {label: 'Import / Export', action: 'openImportExport', dividerTop: true, dividerBottom: true},
      {label: 'About', action: 'openAbout'},
      {label: 'Docs', href: '/docs'},                              // renders an <a>
      {label: 'Delete', action: 'deleteModule', attributes: {'data-id': moduleId}},
    ],
  })
  ```

  Each item is `{label, action, href, divider Top/Bottom, attributes}` — `href` renders
  an `<a>`, otherwise a `<button data-click="action">`. `attributes` is an arbitrary
  object of extra attributes merged onto that element. Because it's a plain function
  taking data, it can be called any number of times for a variable number of dropdowns
  (e.g. one per module card).

- `openDropdown` / `closeDropdown` / `toggle` / `closeAll` / `positionPanel` — state
  mutation only, no listeners of their own. They're driven by `app/handler.js`.

- Inactive/closed panels get `inert` set/removed alongside the open state, for
  accessibility (no focus/interaction while hidden).

`components/modal.js` follows the same render+behavior split, with one difference: a
modal's content is decided by whichever action opens it (settings vs. about vs. ...), so
there's nothing to embed in a page's static render output. Instead:

- `buildModal({title, content})` — pure function, returns the panel markup (same trust
  model as `buildDropdown`: `title` is escaped text, `content` is raw HTML the caller
  composed, e.g. another render function's output).
- `openModal({title, content})` / `closeModal()` — lazily creates a single modal root
  and appends it to `document.body` (sibling of `#app`, not inside it) the first time
  it's opened, the equivalent of Vue's `Teleport to="body"` without Teleport. This
  matters because `bootstrap.js` replaces `#app`'s entire `innerHTML` on every
  full re-render — a modal living inside `#app` would get wiped out from under itself.
- Open/closed state toggles `data-modal-open` + `inert`, same pattern as the dropdown.
- Call it from an action: `actions/settings.js`'s `openSettings` calls
  `openModal({title: 'App settings', content: '...'})`.

Icons follow the same "centralize, don't inline" rule — see `styles/components/icons.css`
(`data-icon="cog"`, `data-icon="chevron"`). Add new icons in `styles/components/icons.css`, not inline in a render file.

## Routing

YaiTabs has built-in hash routing — don't hand-roll one:

- `data-ref-path="pages"` on the root + `data-history-mode="push"` (so page switches are
  back/forward-able) wires YaiTabs to read/write `#pages=<slug>`.
- On load, read the initial slug yourself before the first render —
  `data/pages.js`'s `getHashPageSlug()` reads `location.hash` so the active page survives
  a reload (reload on page 3 stays on page 3).

## Styling

- `styles/next.css` — CSS custom properties (tokens/theming), resets, page/layout rules.
  `@import "./components.css";` sits at the very top (required position for `@import`).
  Vite inlines it at build time, so it's still one stylesheet shipped, one `<link>` tag
  in the HTML.
- `styles/components.css` — component-scoped rules (e.g. `[data-dropdown] {...}`,
  `[data-modal] {...}`). Drop new component CSS in here, keyed off the same
  data-attributes the JS uses.
- Variables stay in `next.css` so theming is controlled from one place; the rules that
  consume them live in `components.css`.
- No Tailwind, no scoped/CSS-in-JS — plain CSS, custom properties for variation,
  data-attributes for state (`[data-dropdown-open]`, `[aria-expanded="true"]`, etc).

### Motion rules

- Motion must be **shared and geometry-stable**. Prefer a small reusable token set in
  `styles/next.css` (`--st-motion-*`) over per-component `transition: all`.
- Allowed by default on interactive surfaces: `opacity`, `filter`, `background-color`,
  `border-color`, `box-shadow`, `color`.
- Do **not** use `transform` in `next/` styles for hover/focus/open/close behavior.
  If something visually changes size, position, or hit-area under the pointer, it's a bug.
- If a change alters visual behavior in a noticeable way, call it out explicitly in the
  status update. Do not slip motion changes in silently.

## Shared utilities

Anything pure, DOM-free, and used by 2+ files belongs in `utils/`, not duplicated locally.
Right now: `utils/html.js` (`escapeHtml`, `buildAttributes`). If you're about to copy a
helper function into a second file, move it to `utils/` instead.

## Internationalization

`utils/i18n.js` reads the same `src/locales/en.ts` / `de.ts` files the legacy Vue app
uses — one shared source of translated strings for both apps. It does not use
`vue-i18n` (that's a Vue plugin); it's a ~30-line dot-path lookup against the same
plain object literals.

- `await initI18n()` — call once, before the first render (`bootstrap.js` does this).
  Reads `ui_language` from `db.app_settings` (same key/shape the legacy app writes),
  falls back to `navigator.language`, then dynamically imports **one** locale file —
  `en.ts` or `de.ts`, never both. This mirrors `src/i18n.ts`'s existing lazy-per-locale
  loading; a German browser never fetches the English strings bundle.
- `t('common.settings')` / `t('app.searchResults', {count, query})` — dot-path lookup
  into the loaded locale object, with `{named}` placeholder interpolation (same syntax
  the locale files already use, since they were written for vue-i18n). Returns the key
  itself if nothing matches, so a typo'd key is visible instead of silently blank.
- Only use `t()` for strings that already exist in `locales/en.ts`/`de.ts` under a key
  that genuinely means the same thing. Don't invent new keys in those files from
  `next/` without thinking it through first — they're shared with the live, published
  Vue app, so edits there have blast radius beyond this folder.

### Example Workspace Content

The example workspace no longer uses a separate i18n namespace. UI translations
stay in the normal locale files, and example workspace content lives entirely in
`examples/<locale>/workspace-*/`.

English acts as the canonical base. Locale-specific example workspace files are
treated as partial overrides and merged on top of English at seed time, so a
new locale only needs to translate the parts it actually wants to override.
