import type { PayrollActionContext, createStaffPayrollActions as createActions } from './payroll.actions'

type Actions = ReturnType<typeof createActions>

/** Payroll mutations are needed only after an explicit staff action. */
export function createStaffPayrollActions(
  readContext: () => PayrollActionContext,
  loadActions = () => import('./payroll.actions'),
): Actions {
  async function run(action: (actions: Actions) => Promise<void>) {
    const context = readContext()
    context.setSaving(true)
    try {
      const { createStaffPayrollActions: create } = await loadActions()
      await action(create(() => context))
    } catch (error) {
      context.setStatus(error instanceof Error ? error.message : context.text.messages.reportDownloadFailed)
    } finally {
      context.setSaving(false)
    }
  }

  return {
    syncPayrollDraft: () => run(actions => actions.syncPayrollDraft()),
    saveHrAdjustment: (...args) => run(actions => actions.saveHrAdjustment(...args)),
    updateHrAdjustmentStatus: (...args) => run(actions => actions.updateHrAdjustmentStatus(...args)),
    generatePayrollRun: () => run(actions => actions.generatePayrollRun()),
    approvePayrollRun: (...args) => run(actions => actions.approvePayrollRun(...args)),
    downloadEmployeePayslip: (...args) => run(actions => actions.downloadEmployeePayslip(...args)),
  }
}
