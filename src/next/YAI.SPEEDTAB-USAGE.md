# Notes: YAI Usage For Speedtab

Status: working notes

Goal:
- document the simplest safe way to use YAI/YEH in Speedtab
- avoid overusing the library too early
- keep the integration understandable while we rebuild the app shell

These notes are based on:
- [src/lib/yai/yai-core.d.ts](/home/enginypsilon/bin/ai/speedtab/src/lib/yai/yai-core.d.ts:1)
- [src/lib/yai/yai-tabs.d.ts](/home/enginypsilon/bin/ai/speedtab/src/lib/yai/yai-tabs.d.ts:1)
- [src/lib/yai/yeh.d.ts](/home/enginypsilon/bin/ai/speedtab/src/lib/yai/yeh.d.ts:1)
- [src/lib/yai/yai-tabs-swipe.d.ts](/home/enginypsilon/bin/ai/speedtab/src/lib/yai/yai-tabs-swipe.d.ts:1)
- [src/lib/yai/yai-local-bundle.js](/home/enginypsilon/bin/ai/speedtab/src/lib/yai/yai-local-bundle.js:1)

---

## 1. What `create the real root shell in app code` means

It does **not** mean “make another demo page.”

It means:
- take the current real app mount
- replace the current top-level runtime structure with a YAI-rooted shell
- feed it with real DB page data
- keep modules/content mostly stubbed at first

In practice, the first real shell should contain:
- `#app` YAI root
- real header
- real page navigation buttons
- real page panels
- a settings trigger
- placeholder page content inside the active page panel

It does **not** yet require:
- module migration
- notes migration
- feeds migration
- full customizer

So “root shell” means:
- the real app frame
- not the playground

---

## 2. The simplest safe YAI setup for Speedtab

Speedtab should start with exactly one main `YaiTabs` instance at the app root.

Recommended first config shape:

```js
const tabs = new YaiTabs({
  autoAccessibility: true,
  autoDisambiguate: false,
  lazyNestedComponents: true,
  autoFocusNested: false,
  autoFocus: false,
  closable: false,
  events: {
    enableStats: true,
    enableHandlerValidation: true,
    setListener: {
      window: [{ type: 'hashchange', debounce: 60 }],
      '#app': ['click', 'keydown', 'input', 'change', 'submit'],
      '[data-yai-tabs]': ['click', 'keydown'],
    },
  },
})
```

Why this is the right starting subset:
- enough for page navigation
- enough for delegated actions
- enough for forms/settings
- no unnecessary complexity yet

Do **not** enable more event types until a real surface needs them.

---

## 3. How event handling actually works here

Important observation from [src/lib/yai/yai-core.js](/home/enginypsilon/bin/ai/speedtab/src/lib/yai/yai-core.js:216):

- configured events auto-generate actionable attributes
- for `click`, YAI recognizes `data-click`
- for `input`, it recognizes `data-input`
- for `change`, it recognizes `data-change`
- for `submit`, it recognizes `data-submit`

And YAI also auto-generates instance hooks:
- `eventClick`
- `eventKeydown`
- `eventInput`
- `eventChange`
- `eventSubmit`
- `eventHashchange`

So the simplest working pattern in Speedtab is:

```html
<button data-click="openSettings">Settings</button>
```

```js
tabs.hook('eventClick', ({ event, target, container, action }) => {
  if (action === 'openSettings') {
    // handle it
  }
})
```

Where:
- `action` comes from `target.dataset.click`
- `target` is the actionable element
- `container` is the matched listener container

This means:
- we do not need lots of Vue `@click`
- we do not need listener lifecycle management for normal UI actions
- we can delegate from the root safely

---

## 4. Safest event policy for the refactor

Start with only these delegated events at the app root:

- `click`
- `keydown`
- `input`
- `change`
- `submit`
- `hashchange`

Only add later if a real surface needs them:
- `mousedown`
- `mousemove`
- `mouseup`
- `touchstart`
- `touchmove`
- `touchend`

Reason:
- the root shell and settings do not need swipe yet
- module migration can add swipe later in a controlled way
- fewer event types make debugging much easier

---

## 5. Safest hook policy for Speedtab

Use hooks in 3 groups only at first:

### A. App-level event hooks
- `eventClick`
- `eventKeydown`
- `eventInput`
- `eventChange`
- `eventSubmit`
- `eventHashchange`

These are the main integration hooks.

### B. Loading/transition hooks
Only when needed later:
- `contentLoading`
- `contentLoaded`
- `contentReady`
- `afterLoad`
- `routeLoading`
- `routeLoaded`

Do not depend on these before the shell is stable.

### C. Swipe hooks
Only for module migration or explicit swipe surfaces:
- `swipeStart`
- `swipeMove`
- `swipeEnd`
- `beforeSwitch`
- `afterSwitch`

Do not use swipe hooks in the first shell/page-nav milestone.

---

## 6. Recommended root integration pattern

Use one explicit dispatcher instead of spreading behavior across many hooks.

Example pattern:

```js
tabs.hook('eventClick', ({ event, target, container, action }) => {
  if (!action) return

  if (action === 'openSettings') return openSettings(event, target, container)
  if (action === 'toggleHelpers') return toggleHelpers(event, target, container)
  if (action === 'copyUrl') return copyUrl(event, target, container)
})
```

Why:
- easy to audit
- easy to refactor
- avoids “magic” action routing too early
- keeps Speedtab behavior explicit

Later, this can be replaced with a handler registry if needed.

---

## 7. What to avoid early

Avoid these in the first milestones:

- full dynamic remote content loading through YAI
- trying to use every built-in hook
- enabling too many custom attributes
- putting module internals under the root event model immediately
- mixing app shell migration and swipe-heavy nested module migration
- hiding real behavior behind too much automatic method lookup

Reason:
- the app shell should be simple and inspectable first
- once page nav + settings are stable, deeper usage becomes safer

---

## 8. How nested components should be used

Nested YAI components are one of the main reasons to do this refactor.

But the safest adoption order is:

1. root app shell
2. page tabs
3. settings panel
4. module shell
5. module collection tabs
6. module internals

This keeps nested complexity proportional to how much of the app is already stable.

So yes:
- nested components are a core strength
- but we should earn them layer by layer

---

## 9. Accessibility notes

The generated HTML from the playground already shows the right structure:
- `role="tablist"`
- `role="tab"`
- `role="tabpanel"`
- `aria-selected`
- `aria-controls`
- `aria-labelledby`
- `tabindex`
- `aria-hidden`
- `inert`

That means Speedtab should lean on the generated YAI tab semantics instead of rebuilding them manually.

One simple app-shell cleanup:

Instead of:

```html
<h1>⚡ Speedtab</h1>
```

Prefer:

```html
<h1><span aria-hidden="true">⚡</span> Speedtab</h1>
```

This keeps the heading meaningful for audits and assistive tech.

---

## 10. Practical first milestone

The safest first real milestone is:

1. root YAI app shell in Vue
2. real DB-backed page nav
3. delegated header actions
4. settings trigger stub
5. no module migration yet

If this works, then the YAI integration is real.

If this does **not** work cleanly, then we should not proceed deeper.

---

## 11. Current recommendation

Use YAI in Speedtab like this first:

- one main `YaiTabs` instance
- one explicit event dispatcher
- one small set of root events
- no swipe in the first real milestone
- nested YAI only after page nav and settings are stable

That is the simplest secure path with the least room for accidental framework chaos.
