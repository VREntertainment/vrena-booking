import type { SettingsActionContext, createStaffSettingsActions as createActions } from './settings.actions'

type Actions = ReturnType<typeof createActions>

/** HR settings are not needed to open the staff booking form. */
export function createStaffSettingsActions(
  readContext: () => SettingsActionContext,
  loadActions = () => import('./settings.actions'),
): Actions {
  async function run<Result>(action: (actions: Actions) => Promise<Result>, fallback: Result, saving = false): Promise<Result> {
    const context = readContext()
    if (saving) context.setSaving(true)
    try {
      const { createStaffSettingsActions: create } = await loadActions()
      return await action(create(() => context))
    } catch (error) {
      context.setStatus(error instanceof Error ? error.message : context.text.messages.reportDownloadFailed)
      return fallback
    } finally {
      if (saving) context.setSaving(false)
    }
  }

  return {
    loadHrData: (...args) => run(actions => actions.loadHrData(...args), undefined),
    saveHrSettings: () => run(actions => actions.saveHrSettings(), undefined, true),
    saveHrSetupOption: (...args) => run(actions => actions.saveHrSetupOption(...args), undefined, true),
    updateHrSetupOption: (...args) => run(actions => actions.updateHrSetupOption(...args), false, true),
    setHrSetupOptionActive: (...args) => run(actions => actions.setHrSetupOptionActive(...args), undefined, true),
  }
}
