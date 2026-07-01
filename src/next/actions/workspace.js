import {t} from '../utils/i18n.js'

export const workspaceActions = {
  async loadExampleWorkspace(target) {
    const {canSeedExampleWorkspace, seedExampleWorkspace} = await import('../features/example-workspace/seed.js')
    if (!(await canSeedExampleWorkspace())) return

    const button = target instanceof HTMLButtonElement ? target : null
    const newPageButton = button?.closest('.st-app-empty-actions')?.querySelector?.('[data-empty-add-page]') ?? null
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
      await seedExampleWorkspace()
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
