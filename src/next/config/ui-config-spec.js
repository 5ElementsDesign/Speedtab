const TAB_BEHAVIOR_VALUES = ['fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'zoom', 'blur', 'flip', 'instant']
const TAB_THEME_VALUES = ['default', 'minimal']
const COLOR_ACCENT_VALUES = ['primary', 'secondary', 'success', 'warning', 'danger', 'dark', 'light']
const VARIANT_VALUES = ['primary', 'secondary', 'success', 'warning', 'danger', 'dark', 'light']
const ALIGN_VALUES = ['left', 'center', 'right']
const LINK_BEHAVIOR_VALUES = ['new-tab', 'same-tab']

const TAB_BEHAVIORS = new Set(TAB_BEHAVIOR_VALUES)
const TAB_THEMES = new Set(TAB_THEME_VALUES)
const COLOR_ACCENTS = new Set(COLOR_ACCENT_VALUES)
const VARIANTS = new Set(VARIANT_VALUES)
const ALIGNS = new Set(ALIGN_VALUES)
const LINK_BEHAVIORS = new Set(LINK_BEHAVIOR_VALUES)

function isIntegerInRange(min, max) {
  return (value) => Number.isInteger(value) && value >= min && value <= max
}

function isEnum(allowed) {
  return (value) => typeof value === 'string' && allowed.has(value)
}

function isBoolean(value) {
  return typeof value === 'boolean'
}

function isCssColor(value) {
  if (typeof value !== 'string') return false
  if (!value.trim()) return true
  return typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
    ? CSS.supports('color', value)
    : true
}

export const UI_CONFIG_SPEC = {
  shell: {
    app: {
      behavior: {
        'shell-theme': {
          valueType: 'enum',
          allowedValues: TAB_THEME_VALUES,
          validate: isEnum(TAB_THEMES),
          defaultValue: 'default',
          target: 'shell-root',
          applyAs: {type: 'attribute', name: 'data-theme'},
        },
        'shell-color-accent': {
          valueType: 'enum',
          allowedValues: COLOR_ACCENT_VALUES,
          validate: isEnum(COLOR_ACCENTS),
          defaultValue: 'light',
          target: 'shell-root',
          applyAs: {type: 'attribute', name: 'data-color-accent'},
        },
        'shell-variant': {
          valueType: 'enum',
          allowedValues: VARIANT_VALUES,
          validate: isEnum(VARIANTS),
          defaultValue: null,
          target: 'shell-root',
          applyAs: {type: 'attribute', name: 'data-variant'},
        },
        'shell-tabs-align': {
          valueType: 'enum',
          allowedValues: ALIGN_VALUES,
          validate: isEnum(ALIGNS),
          defaultValue: null,
          target: 'controller',
          applyAs: {type: 'attribute', name: 'data-align'},
        },
        'shell-tabs-grow': {
          valueType: 'boolean',
          validate: isBoolean,
          defaultValue: false,
          target: 'controller',
          applyAs: {type: 'attribute', name: 'data-grow', trueValue: ''},
        },
        'shell-behavior': {
          valueType: 'enum',
          allowedValues: TAB_BEHAVIOR_VALUES,
          validate: isEnum(TAB_BEHAVIORS),
          defaultValue: 'zoom',
          target: 'shell-root',
          applyAs: {type: 'attribute', name: 'data-behavior'},
        },
        'shell-swipe': {
          valueType: 'boolean',
          validate: isBoolean,
          defaultValue: true,
          target: 'shell-root',
          applyAs: {type: 'attribute', name: 'data-swipe', trueValue: 'slyde'},
        },
        'shell-reduced-motion': {
          valueType: 'boolean',
          validate: isBoolean,
          defaultValue: false,
          target: 'shell-root',
          applyAs: {type: 'attribute', name: 'data-prefers-reduced-motion', trueValue: ''},
        },
        'shell-no-box-shadow': {
          valueType: 'boolean',
          validate: isBoolean,
          defaultValue: true,
          target: 'shell-root',
          applyAs: {type: 'attribute', name: 'data-prefers-nav-no-box-shadow', trueValue: ''},
        },
      },
      layout: {
        'shell-max-width': {
          valueType: 'integer',
          min: 800,
          max: 3840,
          validate: isIntegerInRange(800, 3840),
          defaultValue: null,
          target: 'document-root',
          applyAs: {type: 'css-variable', name: '--st-page-grid-max-width', serialize: (v) => `${v}px`},
        },
        'shell-header-height-px': {
          valueType: 'integer',
          min: 30,
          max: 100,
          validate: isIntegerInRange(30, 100),
          defaultValue: null,
          target: 'shell-root',
          applyAs: {type: 'css-variable', name: '--st-app-header-height', serialize: (v) => `${v}px`},
        },
        'shell-module-gap-px': {
          valueType: 'integer',
          min: 0,
          max: 120,
          validate: isIntegerInRange(0, 120),
          defaultValue: null,
          target: 'shell-root',
          applyAs: {
            type: 'css-variables',
            variables: [
              {name: '--st-page-grid-row-gap', serialize: (v) => `${v}px`},
              {name: '--st-page-grid-col-gap', serialize: (v) => `${v}px`},
            ],
          },
        },
        'shell-module-content-gap-px': {
          valueType: 'integer',
          min: 0,
          max: 64,
          validate: isIntegerInRange(0, 64),
          defaultValue: null,
          target: 'shell-root',
          applyAs: {
            type: 'css-variable',
            name: '--st-module-content-gap',
            serialize: (v) => `${v}px`,
          },
        },
      },
      appearance: {
        '--st-ws-shell-header-text-color': {
          valueType: 'color', validate: isCssColor, defaultValue: '',
          target: 'shell-root', applyAs: {type: 'css-variable', name: '--st-ws-shell-header-text-color'},
        },
        '--st-ws-module-background-color': {
          valueType: 'color', validate: isCssColor, defaultValue: '',
          target: 'shell-root', applyAs: {type: 'css-variable', name: '--st-ws-module-background-color'},
        },
        '--st-ws-shell-header-background-color': {
          valueType: 'color', validate: isCssColor, defaultValue: '',
          target: 'shell-root', applyAs: {type: 'css-variable', name: '--st-ws-shell-header-background-color'},
        },
        '--st-ws-shell-nav-background-color': {
          valueType: 'color', validate: isCssColor, defaultValue: '',
          target: 'shell-root', applyAs: {type: 'css-variable', name: '--st-ws-shell-nav-background-color'},
        },
        '--st-ws-shell-nav-text-color': {
          valueType: 'color', validate: isCssColor, defaultValue: '',
          target: 'shell-root', applyAs: {type: 'css-variable', name: '--st-ws-shell-nav-text-color'},
        },
        '--st-ws-shell-nav-active-background-color': {
          valueType: 'color', validate: isCssColor, defaultValue: '',
          target: 'shell-root', applyAs: {type: 'css-variable', name: '--st-ws-shell-nav-active-background-color'},
        },
        '--st-ws-shell-nav-active-text-color': {
          valueType: 'color', validate: isCssColor, defaultValue: '',
          target: 'shell-root', applyAs: {type: 'css-variable', name: '--st-ws-shell-nav-active-text-color'},
        },
        '--st-module-bookmark-preview-background-color': {
          valueType: 'color', validate: isCssColor, defaultValue: '',
          target: 'shell-root', applyAs: {type: 'css-variable', name: '--st-module-bookmark-preview-background-color'},
        },
        '--st-module-bookmark-preview-text-color': {
          valueType: 'color', validate: isCssColor, defaultValue: '',
          target: 'shell-root', applyAs: {type: 'css-variable', name: '--st-module-bookmark-preview-text-color'},
        },
        '--st-notes-preview-content-bg': {
          valueType: 'color', validate: isCssColor, defaultValue: '',
          target: 'document-root', group: 'notePreview',
          applyAs: {type: 'css-variable', name: '--st-notes-preview-content-bg'},
        },
        '--st-notes-preview-content-color': {
          valueType: 'color', validate: isCssColor, defaultValue: '',
          target: 'document-root', group: 'notePreview',
          applyAs: {type: 'css-variable', name: '--st-notes-preview-content-color'},
        },
        '--st-notes-preview-content-font-scale': {
          valueType: 'integer',
          min: 80,
          max: 200,
          validate: isIntegerInRange(80, 200),
          defaultValue: null,
          target: 'document-root',
          group: 'notePreview',
          applyAs: {type: 'css-variable', name: '--st-notes-preview-content-font-scale', serialize: (v) => String(v / 100)},
        },
        '--st-notes-open-content-bg': {
          valueType: 'color', validate: isCssColor, defaultValue: '',
          target: 'document-root', group: 'noteOpen',
          applyAs: {type: 'css-variable', name: '--st-notes-open-content-bg'},
        },
        '--st-notes-open-content-color': {
          valueType: 'color', validate: isCssColor, defaultValue: '',
          target: 'document-root', group: 'noteOpen',
          applyAs: {type: 'css-variable', name: '--st-notes-open-content-color'},
        },
        '--st-notes-open-link-color': {
          valueType: 'color', validate: isCssColor, defaultValue: '',
          target: 'document-root', group: 'noteOpen',
          applyAs: {type: 'css-variable', name: '--st-notes-open-link-color'},
        },
        '--st-notes-open-content-font-scale': {
          valueType: 'integer',
          min: 80,
          max: 200,
          validate: isIntegerInRange(80, 200),
          defaultValue: null,
          target: 'document-root',
          group: 'noteOpen',
          applyAs: {type: 'css-variable', name: '--st-notes-open-content-font-scale', serialize: (v) => String(v / 100)},
        },
        '--st-ws-module-shadow-color': {
          valueType: 'color', validate: isCssColor, defaultValue: '',
          target: 'shell-root', applyAs: {type: 'css-variable', name: '--st-ws-module-shadow-color'},
        },
      },
    },
  },
  module: {
    tabs: {
      behavior: {
        'module-tabs-color-accent': {
          valueType: 'enum',
          allowedValues: COLOR_ACCENT_VALUES,
          validate: isEnum(COLOR_ACCENTS),
          defaultValue: 'secondary',
          target: 'tabs-root',
          applyAs: {type: 'attribute', name: 'data-color-accent'},
        },
        'module-tabs-variant': {
          valueType: 'enum',
          allowedValues: VARIANT_VALUES,
          validate: isEnum(VARIANTS),
          defaultValue: null,
          target: 'tabs-root',
          applyAs: {type: 'attribute', name: 'data-variant'},
        },
        'module-tabs-align': {
          valueType: 'enum',
          allowedValues: ALIGN_VALUES,
          validate: isEnum(ALIGNS),
          defaultValue: null,
          target: 'controller',
          applyAs: {type: 'attribute', name: 'data-align'},
        },
        'module-tabs-grow': {
          valueType: 'boolean',
          validate: isBoolean,
          defaultValue: false,
          target: 'controller',
          applyAs: {type: 'attribute', name: 'data-grow', trueValue: ''},
        },
        'module-tabs-behavior': {
          valueType: 'enum',
          allowedValues: TAB_BEHAVIOR_VALUES,
          validate: isEnum(TAB_BEHAVIORS),
          defaultValue: 'zoom',
          target: 'tabs-root',
          applyAs: {type: 'attribute', name: 'data-behavior'},
        },
        'module-tabs-swipe-enabled': {
          valueType: 'boolean',
          validate: isBoolean,
          defaultValue: true,
          target: 'tabs-root',
          applyAs: {type: 'attribute', name: 'data-swipe', trueValue: 'slyde'},
        },
        'module-hide-header': {
          valueType: 'boolean',
          validate: isBoolean,
          defaultValue: false,
          target: 'module-root',
          applyAs: {type: 'attribute', name: 'data-hide-header', trueValue: ''},
        },
        'module-tabs-quicklinks': {
          valueType: 'boolean',
          validate: isBoolean,
          defaultValue: false,
          target: 'tabs-root',
          applyAs: {type: 'attribute', name: 'data-bookmarks-quicklinks', trueValue: ''},
        },
        'module-tabs-force-favicon': {
          valueType: 'boolean',
          validate: isBoolean,
          defaultValue: false,
          target: 'tabs-root',
          applyAs: {type: 'attribute', name: 'data-bookmarks-force-favicon', trueValue: ''},
        },
        'module-tabs-show-title-below': {
          valueType: 'boolean',
          validate: isBoolean,
          defaultValue: false,
          target: 'tabs-root',
          applyAs: {type: 'attribute', name: 'data-bookmarks-show-title-below', trueValue: ''},
        },
        'module-tabs-show-add-tile': {
          valueType: 'boolean',
          validate: isBoolean,
          defaultValue: true,
          target: 'tabs-root',
          applyAs: {type: 'attribute', name: 'data-bookmarks-inline-add-tile', trueValue: ''},
        },
      },
      layout: {
        'module-column-span': {
          valueType: 'integer',
          min: 1,
          max: 12,
          validate: isIntegerInRange(1, 12),
          defaultValue: 12,
          target: 'grid-col',
          applyAs: {
            type: 'css-variable',
            name: '--st-grid-col-span',
            serialize: (value) => String(value),
          },
        },
        'module-min-height-px': {
          valueType: 'integer',
          min: 60,
          max: 1200,
          validate: isIntegerInRange(60, 1200),
          defaultValue: null,
          target: 'module-root',
          applyAs: {
            type: 'css-variable',
            name: '--st-module-min-height',
            serialize: (value) => `${value}px`,
          },
        },
      },
    },
    notes: {
      behavior: {
        'module-tabs-color-accent': {
          valueType: 'enum',
          allowedValues: COLOR_ACCENT_VALUES,
          validate: isEnum(COLOR_ACCENTS),
          defaultValue: 'secondary',
          target: 'tabs-root',
          applyAs: {type: 'attribute', name: 'data-color-accent'},
        },
        'module-tabs-variant': {
          valueType: 'enum',
          allowedValues: VARIANT_VALUES,
          validate: isEnum(VARIANTS),
          defaultValue: null,
          target: 'tabs-root',
          applyAs: {type: 'attribute', name: 'data-variant'},
        },
        'module-tabs-align': {
          valueType: 'enum',
          allowedValues: ALIGN_VALUES,
          validate: isEnum(ALIGNS),
          defaultValue: null,
          target: 'controller',
          applyAs: {type: 'attribute', name: 'data-align'},
        },
        'module-tabs-grow': {
          valueType: 'boolean',
          validate: isBoolean,
          defaultValue: false,
          target: 'controller',
          applyAs: {type: 'attribute', name: 'data-grow', trueValue: ''},
        },
        'module-tabs-behavior': {
          valueType: 'enum',
          allowedValues: TAB_BEHAVIOR_VALUES,
          validate: isEnum(TAB_BEHAVIORS),
          defaultValue: 'zoom',
          target: 'tabs-root',
          applyAs: {type: 'attribute', name: 'data-behavior'},
        },
        'module-tabs-swipe-enabled': {
          valueType: 'boolean',
          validate: isBoolean,
          defaultValue: true,
          target: 'tabs-root',
          applyAs: {type: 'attribute', name: 'data-swipe', trueValue: 'slyde'},
        },
        'module-hide-header': {
          valueType: 'boolean',
          validate: isBoolean,
          defaultValue: false,
          target: 'module-root',
          applyAs: {type: 'attribute', name: 'data-hide-header', trueValue: ''},
        },
        'module-tabs-show-add-tile': {
          valueType: 'boolean',
          validate: isBoolean,
          defaultValue: true,
          target: 'tabs-root',
          applyAs: {type: 'attribute', name: 'data-bookmarks-inline-add-tile', trueValue: ''},
        },
      },
      layout: {
        'module-column-span': {
          valueType: 'integer',
          min: 1,
          max: 12,
          validate: isIntegerInRange(1, 12),
          defaultValue: 12,
          target: 'grid-col',
          applyAs: {
            type: 'css-variable',
            name: '--st-grid-col-span',
            serialize: (value) => String(value),
          },
        },
        'module-min-height-px': {
          valueType: 'integer',
          min: 60,
          max: 1200,
          validate: isIntegerInRange(60, 1200),
          defaultValue: null,
          target: 'module-root',
          applyAs: {
            type: 'css-variable',
            name: '--st-module-min-height',
            serialize: (value) => `${value}px`,
          },
        },
      },
    },
    feeds: {
      behavior: {
        'module-tabs-color-accent': {
          valueType: 'enum',
          allowedValues: COLOR_ACCENT_VALUES,
          validate: isEnum(COLOR_ACCENTS),
          defaultValue: 'secondary',
          target: 'tabs-root',
          applyAs: {type: 'attribute', name: 'data-color-accent'},
        },
        'module-tabs-variant': {
          valueType: 'enum',
          allowedValues: VARIANT_VALUES,
          validate: isEnum(VARIANTS),
          defaultValue: null,
          target: 'tabs-root',
          applyAs: {type: 'attribute', name: 'data-variant'},
        },
        'module-tabs-align': {
          valueType: 'enum',
          allowedValues: ALIGN_VALUES,
          validate: isEnum(ALIGNS),
          defaultValue: null,
          target: 'controller',
          applyAs: {type: 'attribute', name: 'data-align'},
        },
        'module-tabs-grow': {
          valueType: 'boolean',
          validate: isBoolean,
          defaultValue: false,
          target: 'controller',
          applyAs: {type: 'attribute', name: 'data-grow', trueValue: ''},
        },
        'module-hide-header': {
          valueType: 'boolean',
          validate: isBoolean,
          defaultValue: false,
          target: 'module-root',
          applyAs: {type: 'attribute', name: 'data-hide-header', trueValue: ''},
        },
      },
      layout: {
        'module-column-span': {
          valueType: 'integer',
          min: 1,
          max: 12,
          validate: isIntegerInRange(1, 12),
          defaultValue: 12,
          target: 'grid-col',
          applyAs: {
            type: 'css-variable',
            name: '--st-grid-col-span',
            serialize: (value) => String(value),
          },
        },
        'module-min-height-px': {
          valueType: 'integer',
          min: 60,
          max: 1200,
          validate: isIntegerInRange(60, 1200),
          defaultValue: null,
          target: 'module-root',
          applyAs: {
            type: 'css-variable',
            name: '--st-module-min-height',
            serialize: (value) => `${value}px`,
          },
        },
      },
    },
  },
}

export function getUiConfigSpec(entityType, entitySubtype) {
  const spec = UI_CONFIG_SPEC[entityType]?.[entitySubtype] ?? {}
  return {
    behavior: spec.behavior ?? {},
    layout: spec.layout ?? {},
    appearance: spec.appearance ?? {},
  }
}
