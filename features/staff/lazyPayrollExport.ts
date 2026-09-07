import type { PayrollExportActionContext } from './payrollExport.actions'

/** Snapshot the requested period before loading export-only code. */
export function createStaffPayrollExportActions(readContext: () => PayrollExportActionContext) {
  return {
    async downloadPayrollExcel() {
      const context = readContext()
      try {
        const { createStaffPayrollExportActions: createActions } = await import('./payrollExport.actions')
        return await createActions(() => context).downloadPayrollExcel()
      } catch {
        context.setStatus(context.text.messages.reportDownloadFailed)
        return false
      }
    },
  }
}
