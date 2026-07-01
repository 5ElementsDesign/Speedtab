export const UI_CONFIG_VERSION = 1

export const UI_CONFIG_DEFAULTS = {
  shell: {
    app: {
      behavior: {
        'shell-theme': 'default',
        'shell-color-accent': 'light',
        'shell-variant': null,
        'shell-behavior': 'zoom',
        'shell-swipe': true,
        'shell-nav': 'top',
        'shell-reduced-motion': false,
        'shell-no-box-shadow': true,
      },
      layout: {
        'shell-max-width': null,
        'shell-header-height-px': null,
        'shell-module-gap-px': null,
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
        'module-hide-header': false,
        'module-tabs-show-add-tile': true,
      },
      layout: {
        'module-column-span': 12,
        'module-min-height-px': null,
      },
      appearance: {},
    },
    notes: {
      behavior: {
        'module-tabs-color-accent': 'secondary',
        'module-tabs-variant': null,
        'module-tabs-behavior': 'zoom',
        'module-tabs-swipe-enabled': true,
        'module-hide-header': false,
        'module-tabs-show-add-tile': true,
      },
      layout: {
        'module-column-span': 12,
        'module-min-height-px': null,
      },
      appearance: {},
    },
    feeds: {
      behavior: {
        'module-tabs-color-accent': 'secondary',
        'module-tabs-variant': null,
        'module-hide-header': false,
      },
      layout: {
        'module-column-span': 12,
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
