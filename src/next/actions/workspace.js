import {getCachedAppSettings, saveAppSetting} from '../data/app-settings.js'
import {applyDocumentTheme, normalizeDocumentTheme} from '../utils/document-theme.js'
import {getLocale, t} from '../utils/i18n.js'
import {applyWorkspaceBackground, removeBgSet} from '../utils/workspace-background.js'

function isBackgroundActive(settings = getCachedAppSettings()) {
  return settings.background_properties !== 'none'
}

function renderBackgroundToggleButtonLabel() {
  const label = isBackgroundActive()
    ? t('customizer.removeBackgroundShort')
    : t('customizer.speedtabBackgroundShort')
  return {
    label,
    html: `<i data-icon="image" aria-hidden="true"></i> ${label}`,
  }
}

function syncEmptyStateThemeButtons() {
  const root = document.querySelector('.st-app-empty-theme-actions')
  if (!(root instanceof HTMLElement)) return

  const isLight = document.documentElement.classList.contains('light')
  root.querySelectorAll('[data-click="setEmptyStateThemePreset"]').forEach((button) => {
    if (!(button instanceof HTMLElement)) return
    const isActive = button.dataset.themeValue === (isLight ? 'light' : 'dark')
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false')
  })

  const backgroundButton = root.querySelector('[data-click="toggleEmptyStateBackground"]')
  if (backgroundButton instanceof HTMLElement) {
    const nextButtonState = renderBackgroundToggleButtonLabel()
    backgroundButton.innerHTML = nextButtonState.html
    const label = nextButtonState.label
    backgroundButton.setAttribute('title', label)
    backgroundButton.setAttribute('aria-label', label)
    backgroundButton.setAttribute('aria-pressed', isBackgroundActive() ? 'true' : 'false')
  }
}

export const workspaceActions = {
  async setEmptyStateThemePreset(target) {
    const nextTheme = normalizeDocumentTheme(target?.dataset?.themeValue || 'dark')
    await saveAppSetting('ui_theme', nextTheme)
    await saveAppSetting('background_properties', 'none')
    await saveAppSetting('background_asset_id', null)
    applyDocumentTheme(nextTheme)
    removeBgSet()
    syncEmptyStateThemeButtons()
  },

  async toggleEmptyStateBackground() {
    if (isBackgroundActive()) {
      await saveAppSetting('background_properties', 'none')
      await saveAppSetting('background_asset_id', null)
      removeBgSet()
    } else {
      await saveAppSetting('background_properties', null)
      await saveAppSetting('background_asset_id', null)
      await applyWorkspaceBackground()
    }

    syncEmptyStateThemeButtons()
  },

  async loadExampleWorkspace(target) {
    const {canSeedExampleWorkspace, seedExampleWorkspace} = await import('../features/example-workspace/seed.js')
    if (!(await canSeedExampleWorkspace())) return

    const button = target instanceof HTMLButtonElement ? target : null
    const card = button?.closest('.st-app-empty-card') ?? null
    const actionWrap = card?.querySelector?.('.st-app-empty-actions') ?? null
    const newPageButton = actionWrap?.querySelector?.('[data-empty-add-page]') ?? null
    const originalLabel = button?.textContent ?? ''

    if (button) {
      button.disabled = true
      button.setAttribute('aria-busy', 'true')
      button.textContent = t('app.quickStartLoading')
    }
    if (newPageButton instanceof HTMLButtonElement) {
      newPageButton.disabled = true
      newPageButton.setAttribute('aria-busy', 'true')
    }

    try {
      await seedExampleWorkspace(undefined, {
        locale: getLocale(),
      })
      const {renderNextRoot} = await import('../app/bootstrap.js')
      await renderNextRoot()
    } catch (error) {
      if (button) {
        button.disabled = false
        button.removeAttribute('aria-busy')
        button.textContent = originalLabel
      }
      if (newPageButton instanceof HTMLButtonElement) {
        newPageButton.disabled = false
        newPageButton.removeAttribute('aria-busy')
      }
      console.error(t('app.statuses.exampleWorkspaceFailed', {
        message: error instanceof Error ? error.message : String(error),
      }))
    }
  },
}
