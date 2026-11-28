import type { ReportsActionContext } from './reports.actions'
import { staffConsoleText } from '../../lib/staff/copy'
import { rangeLabel } from '../../lib/staff/dates'
import { accountantExportReports, accountantExportStores } from '../../lib/staff/options'
import { downloadCsv, downloadExcel, staffOrderExportRows, staffReportRows } from '../../lib/staff/reportExports'
import type { StaffAuditLog } from '../../lib/staff/types'

export async function exportExcelReport(context: ReportsActionContext) {
  const { reportStart, reportEnd, text, report, reportOrders, games, reportPaymentsByOrderId } = context

  await downloadExcel(`vrena-daily-report-${reportStart}-${reportEnd}.xlsx`, [
    { title: `${text.tabs.report} ${rangeLabel(reportStart, reportEnd)}`, rows: staffReportRows(report, text) },
    { title: text.labels.orders, rows: staffOrderExportRows(reportOrders, games, reportPaymentsByOrderId, text) },
  ], text)
}

export async function downloadAccountantExport(context: ReportsActionContext) {
  const {
    accountantReportId,
    accountantExportStore,
    accountantExportLanguage,
    fetchAuditLogs,
    report,
    reportOrders,
    games,
    reportPaymentsByOrderId,
    discounts,
    loyaltyRules,
    reportStart,
    reportEnd,
    accountantIncludeAttachments,
    accountantExportFormat,
  } = context

  const reportDefinition = accountantExportReports.find((item) => item.id === accountantReportId) || accountantExportReports[0]
  const storeDefinition = accountantExportStores.find((item) => item.id === accountantExportStore) || accountantExportStores[0]
  const exportText = staffConsoleText[accountantExportLanguage]
  let exportAuditLogs: StaffAuditLog[] = []
  if (reportDefinition.id === 'audit_trail') {
    try {
      exportAuditLogs = await fetchAuditLogs(250)
    } catch (error) {
      throw error
    }
  }
  const exportContext = {
    report,
    orders: reportOrders,
    games,
    paymentsByOrderId: reportPaymentsByOrderId,
    discounts,
    loyaltyRules,
    auditLogs: exportAuditLogs,
    text: exportText,
    reportStart,
    reportEnd,
    storeLabel: storeDefinition.label[accountantExportLanguage],
    language: accountantExportLanguage,
    includeAttachments: accountantIncludeAttachments,
  }
  const reportTitle = reportDefinition.label[accountantExportLanguage]
  const { accountantAttachmentRows, accountantExportInfoRows, buildAccountantExportRows } = await import('../../lib/staffAccountantExportRows')
  const rows = buildAccountantExportRows(reportDefinition.id, exportContext)
  const suffix = `${reportStart}_${reportEnd}`
  if (accountantExportFormat === 'csv') {
    await downloadCsv(`${reportDefinition.fileBase}_${suffix}.csv`, rows, exportText)
    return
  }
  const workbookSections = [
    { title: reportTitle, rows },
    {
      title: accountantExportLanguage === 'vi' ? 'Thông tin xuất file' : 'Export info',
      rows: accountantExportInfoRows(reportTitle, exportContext),
    },
  ]
  if (accountantIncludeAttachments) {
    workbookSections.push({
      title: exportText.labels.attachmentList,
      rows: accountantAttachmentRows(exportContext),
    })
  }
  await downloadExcel(`${reportDefinition.fileBase}_${suffix}.xlsx`, workbookSections, exportText)
}

