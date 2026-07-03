# Next Speedtab: Local UI Config

Status: task list

Goal:
- introduce one local-only UI config system for `next`
- keep canonical workspace data clean
- enable live editing via sidepanel
- support reusable presets later without redesign

This system is for:
- behavior
- layout
- appearance

This system is not for:
- canonical content
- export/import payload
- remote sync data
- arbitrary user-defined CSS keys

---

## 1. First Principles

Rules:
- local UI config is per device
- local UI config is keyed by `workspace_id` + `entity_sync_id`
- one shared config object shape is used for all supported entities
- only approved keys are allowed
- values must pass validation before being stored
- defaults live in code
- stored config is sparse: only actual overrides are persisted

Recommended shape:

```json
{
  "workspace_id": "...",
  "device_id": "...",
  "entity_type": "module",
  "entity_subtype": "tabs",
  "entity_sync_id": "...",
  "version": 1,
  "preset_id": null,
  "config": {
    "behavior": {},
    "layout": {},
    "appearance": {}
  }
}
```

---

## 2. Required Files

Create:

1. `src/next/config/ui-config-spec.js`
- central spec/definition file
- lists every supported key
- defines:
  - entity scope
  - value type
  - validator
  - min/max or enum
  - target projection

2. `src/next/config/ui-config-defaults.js`
- default profiles by entity type/subtype
- sparse but complete enough for fallback behavior

3. `src/next/data/ui-config.js`
- IndexedDB read/write helpers
- get by entity
- upsert partial config
- maybe preset loading later

4. `src/next/features/customizer/render.js`
- sidepanel markup
- sections:
  - behavior
  - layout
  - appearance

5. `src/next/features/customizer/apply.js`
- takes effective config
- applies:
  - YAI data attributes
  - CSS custom properties
  - local structural attributes if needed

6. `src/next/features/customizer/normalize.js`
- merge defaults + preset + local overrides
- validate and strip unsupported values

Optional later:

7. `src/next/data/ui-config-presets.js`
- reusable local presets

---

## 3. Spec File

The spec file is the core of the system.

Each supported key should define:
- `entityType`
- `entitySubtype`
- `section`
- `target`
- `valueType`
- `allowedValues` or validator
- `defaultValue`
- `applyAs`

Example:

```js
{
  key: 'module-tabs-swipe-enabled',
  entityType: 'module',
  entitySubtype: 'tabs',
  section: 'behavior',
  valueType: 'boolean',
  defaultValue: false,
  applyAs: {
    type: 'attribute',
    name: 'data-swipe',
    trueValue: 'slyde'
  }
}
```

```js
{
  key: '--st-ws-module-content-background-color',
  entityType: 'module',
  entitySubtype: 'tabs',
  section: 'appearance',
  valueType: 'color',
  defaultValue: 'transparent',
  target: 'module-root',
  applyAs: {
    type: 'css-variable'
  }
}
```

Guard rails:
- booleans only where expected
- numbers must be bounded
- lengths must use allowed units
- colors must pass color validation
- enums must match allowed options

---

## 4. First Supported Keys

Start with `module:tabs` only.

### Behavior
- `module-tabs-swipe-enabled`
- `module-tabs-behavior`
- `module-tabs-theme`
- `module-tabs-color-scheme`
- `module-tabs-color-accent`

### Layout
- `module-column-span`
- `module-min-height-px`

### Appearance
- `--st-ws-module-background-color`
- `--st-ws-module-header-background-color`
- `--st-ws-module-content-background-color`

Reason:
- enough to prove the full system
- enough to show visible live changes
- enough to test YAI attribute projection
- small enough to keep implementation sane

---

## 5. Storage Plan

Use one local-only table for now.

Recommended table:
- `next_ui_config`

Each row belongs to one entity.

Important:
- do not duplicate every possible key
- only store changed values
- merge with defaults at runtime
- `appearance` lives inside `config`, not as a sibling root field

Later:
- add `next_ui_config_presets`
- allow `preset_id`
- allow local overrides on top of a preset

But presets are not phase one.

---

## 6. Live Editing Plan

Do not use modal dialogs for editing.

Use one sidepanel:
- persistent while open
- edits current target
- updates live

Flow:
1. user clicks `Customize` on module shell
2. active target is set
3. sidepanel opens
4. effective config is loaded
5. form fields are populated
6. on change:
   - validate value
   - persist sparse override
   - apply change to live DOM immediately

No reload.
No rerender of the whole page.

---

## 7. DOM Projection Rules

### YAI-controlled behavior

Behavior keys should map to `data-*` attributes on the module root.

Examples:
- `module-tabs-swipe-enabled` -> `data-swipe="slyde"` or remove attribute
- `module-tabs-behavior` -> `data-behavior="fade"`
- `module-tabs-theme` -> `data-theme="default"`
- `module-tabs-color-scheme` -> `data-color-scheme="dark"`
- `module-tabs-color-accent` -> `data-color-accent="warning"`

### Layout and appearance

These should map to CSS custom properties on the correct structural target.

Examples:
- `module-min-height-px` -> module root
- `--st-ws-module-background-color` -> module root
- `module-column-span` -> grid column wrapper

Prefer direct variable names for appearance where possible.

Important:
- not every key applies to the module root
- the spec must define the target per key
- for the current grid system, `module-column-span` applies to the nearest `[data-grid-col]`
- this is intentional for phase one and avoids grid restructuring

---

## 8. Validation Rules

Start with a tiny validator set:

- `boolean`
- `integer`
- `enum`
- `length-px`
- `color`

Examples:
- `module-column-span`
  - integer
  - min `1`
  - max `12`
  - target: nearest `[data-grid-col]`

- `module-min-height-px`
  - integer
  - min `120`
  - max `1200`
  - target: module root

- `module-tabs-behavior`
  - enum:
    - `fade`
    - `slide-up`
    - `slide-down`
    - `slide-left`
    - `slide-right`
    - `zoom`
    - `blur`
    - `flip`
    - `instant`

- `color`
  - must pass browser-supported color validation

---

## 9. Implementation Order

### Phase 1
- create spec file
- create defaults file
- create local table helper
- create config merge helper

### Phase 2
- add `Customize` trigger to module shell
- add sidepanel primitive
- add current-target state

### Phase 3
- implement `module:tabs` behavior keys
- apply them live to DOM

### Phase 4
- implement `module-column-span`
- implement `module-min-height-px`
- reflect them into the correct grid/module targets

### Phase 5
- implement first appearance properties
- live CSS variable projection

### Phase 6
- add presets if still useful after first real use

---

## 10. Definition of Done for First Cut

This phase is done when:
- one module can be selected for customization
- one sidepanel opens and edits that module
- values persist locally
- `module:tabs` behavior options update live
- layout options update live
- first appearance colors update live
- unsupported values are rejected
- canonical data remains untouched

---

## 11. Explicit Non-Goals

Not part of first cut:
- page customizer
- feeds customizer
- notes customizer
- full preset library
- export/import support
- remote sync support
- arbitrary CSS property input
- generic full-app state framework

This is intentionally a small, real, working first slice.
