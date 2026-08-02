export const UI_CONFIG_VERSION = 1

export const UI_CONFIG_DEFAULTS = {
  shell: {
    app: {
      behavior: {
        'shell-theme': 'default',
        'shell-color-accent': 'light',
        'shell-variant': null,
        'shell-tabs-align': null,
        'shell-tabs-grow': false,
        'shell-behavior': 'zoom',
        'shell-swipe': true,
        'shell-reduced-motion': false,
        'shell-no-box-shadow': true,
      },
      layout: {
        'shell-max-width': null,
        'shell-header-height-px': null,
        'shell-module-gap-px': null,
        'shell-module-content-gap-px': null,
        'shell-border-radius-px': null,
      },
      appearance: {
        '--st-ws-shell-header-background-color': '',
        '--st-ws-shell-header-text-color': '',
        '--st-ws-shell-nav-background-color': '',
        '--st-ws-shell-nav-text-color': '',
        '--st-ws-shell-nav-active-background-color': '',
        '--st-ws-shell-nav-active-text-color': '',
        '--st-ws-module-background-color': '',
        '--st-ws-module-shadow-color': '',
        '--st-module-bookmark-preview-background-color': '',
        '--st-module-bookmark-preview-text-color': '',
        '--st-notes-preview-content-bg': '',
        '--st-notes-preview-content-color': '',
        '--st-notes-preview-content-font-scale': null,
        '--st-notes-open-content-bg': '',
        '--st-notes-open-content-color': '',
        '--st-notes-open-link-color': '',
        '--st-notes-open-content-font-scale': null,
      },
    },
  },
  module: {
    tabs: {
      behavior: {
        'module-tabs-color-accent': 'secondary',
        'module-tabs-variant': null,
        'module-tabs-behavior': 'zoom',
        'module-tabs-swipe-enabled': true,
        'module-tabs-grow': false,
        'module-tabs-align': null,
        'module-hide-header': false,
        'module-tabs-show-add-tile': true,
      },
      layout: {
        'module-column-span': 6,
        'module-min-height-px': null,
      },
      appearance: {},
    },
    'speed-dial': {
      behavior: {
        'module-tabs-show-add-tile': true,
      },
      layout: {
        'speed-dial-content-align': 'start',
        'module-min-height-px': null,
        'module-content-gap-px': 10,
        'speed-dial-tile-height-px': 140,
        'speed-dial-fill-height': false,
      },
      appearance: {},
    },
    notes: {
      behavior: {
        'module-tabs-color-accent': 'secondary',
        'module-tabs-variant': null,
        'module-tabs-behavior': 'zoom',
        'module-tabs-swipe-enabled': true,
        'module-tabs-grow': false,
        'module-tabs-align': null,
        'module-hide-header': false,
        'module-tabs-show-add-tile': true,
      },
      layout: {
        'module-column-span': 6,
        'module-min-height-px': null,
      },
      appearance: {},
    },
    feeds: {
      behavior: {
        'module-tabs-color-accent': 'secondary',
        'module-tabs-variant': null,
        'module-tabs-grow': false,
        'module-tabs-align': null,
        'module-hide-header': false,
      },
      layout: {
        'module-column-span': 6,
        'module-min-height-px': null,
      },
      appearance: {},
    },
  },
}

export function getUiConfigDefaults(entityType, entitySubtype) {
  return UI_CONFIG_DEFAULTS[entityType]?.[entitySubtype] ?? {
    behavior: {},
    layout: {},
    appearance: {},
  }
}
