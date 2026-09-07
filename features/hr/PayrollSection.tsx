'use client'

import {
  Check,
  CircleCheckBig,
  Download,
  FileCheck2,
  FileSpreadsheet,
  RefreshCw,
  Save
} from 'lucide-react'
import { ButtonIconText } from '../../components/BookingWidgetUi'
import { StaffPickerField } from '../../components/staff/StaffPickerField'
import { StaffCostReport } from '../../components/StaffCostAssignments'
import { rangeLabel, staffDateLabel } from '../../lib/staff/dates'
import { formatVnd } from '../../lib/staff/formatting'
import type { StaffHrModel } from '../../lib/staff/hrModel'
import { normalizePayrollPayCycle, normalizePayrollStatus } from '../../lib/staff/hrSettings'
import {
  staffPayrollPayCycles
} from '../../lib/staff/options'
import { customerName } from '../../lib/staff/profiles'
import { StaffPeriodRangePicker, accountantWorkspaceCopy, payslipSelectorCopy } from './presentation'

export type PayrollSectionProps = {
  accountantCopy: (typeof accountantWorkspaceCopy)["en" | "vi"]
  payrollPeriodEnd: StaffHrModel['payroll']['payrollPeriodEnd']
  text: StaffHrModel['shared']['text']
  updatePayrollPeriodEnd: (value: string) => void
  updatePayrollPeriodStart: (value: string) => void
  payrollPeriodStart: StaffHrModel['payroll']['payrollPeriodStart']
  accountantDownloadPending: boolean
  saving: StaffHrModel['shared']['saving']
  startAccountantDownload: () => Promise<void>
  incompleteEmployeeCount: number
  setHrTab: StaffHrModel['shared']['setHrTab']
  pendingAttendanceCount: number
  missingBankCount: number
  accountantIssueCount: number
  costReportRows: import("../../components/StaffCostAssignments").StaffCostReportRow[]
  resolvedLanguage: StaffHrModel['shared']['resolvedLanguage']
  canManageAttendance: StaffHrModel['access']['canManageAttendance']
  payrollRunForm: StaffHrModel['payroll']['payrollRunForm']
  setPayrollRunForm: StaffHrModel['payroll']['setPayrollRunForm']
  hrPayrollTotals: StaffHrModel['payroll']['hrPayrollTotals']
  generatePayrollRun: StaffHrModel['payroll']['generatePayrollRun']
  downloadPayrollExcel: StaffHrModel['payroll']['downloadPayrollExcel']
  filteredPayslipProfiles: import("../../lib/staff/types").StaffProfile[]
  payslipCopy: (typeof payslipSelectorCopy)["en" | "vi"]
  payslipDepartmentFilter: string
  setPayslipDepartmentFilter: React.Dispatch<React.SetStateAction<string>>
  payslipDepartments: string[]
  payslipLocationFilter: string
  setPayslipLocationFilter: React.Dispatch<React.SetStateAction<string>>
  payslipLocations: string[]
  effectivePayslipEmployeeId: string
  setPayslipSelectedEmployeeId: React.Dispatch<React.SetStateAction<string>>
  employeeProfileById: StaffHrModel['employees']['employeeProfileById']
  payslipEmployeeProfile: import("../../lib/staff/types").StaffProfile | null
  payslipEmployeeName: string
  payslipEmployee: import("../../lib/staff/types").StaffEmployeeProfile | null | undefined
  payslipEmployeeSummary: import("../../lib/staff/types").StaffPayrollCalculation
  downloadEmployeePayslip: StaffHrModel['payroll']['downloadEmployeePayslip']
  payrollRuns: StaffHrModel['payroll']['payrollRuns']
  payrollItems: StaffHrModel['payroll']['payrollItems']
  approvePayrollRun: StaffHrModel['payroll']['approvePayrollRun']
}

export default function PayrollSection({
  accountantCopy,
  payrollPeriodEnd,
  text,
  updatePayrollPeriodEnd,
  updatePayrollPeriodStart,
  payrollPeriodStart,
  accountantDownloadPending,
  saving,
  startAccountantDownload,
  incompleteEmployeeCount,
  setHrTab,
  pendingAttendanceCount,
  missingBankCount,
  accountantIssueCount,
  costReportRows,
  resolvedLanguage,
  canManageAttendance,
  payrollRunForm,
  setPayrollRunForm,
  hrPayrollTotals,
  generatePayrollRun,
  downloadPayrollExcel,
  filteredPayslipProfiles,
  payslipCopy,
  payslipDepartmentFilter,
  setPayslipDepartmentFilter,
  payslipDepartments,
  payslipLocationFilter,
  setPayslipLocationFilter,
  payslipLocations,
  effectivePayslipEmployeeId,
  setPayslipSelectedEmployeeId,
  employeeProfileById,
  payslipEmployeeProfile,
  payslipEmployeeName,
  payslipEmployee,
  payslipEmployeeSummary,
  downloadEmployeePayslip,
  payrollRuns,
  payrollItems,
  approvePayrollRun,
}: PayrollSectionProps) {
  return (
    <>
      <section className="staff-hr-accountant-workspace">
        <header className="staff-hr-accountant-head">
          <div>
            <span className="staff-hr-accountant-eyebrow"><FileCheck2 aria-hidden="true" size={16} />{accountantCopy.readiness}</span>
            <h3>{accountantCopy.title}</h3>
            <p>{accountantCopy.subtitle}</p>
          </div>
          <div className="staff-hr-accountant-period">
            <StaffPeriodRangePicker
              end={payrollPeriodEnd}
              endLabel={text.labels.periodEnd}
              onEndChange={updatePayrollPeriodEnd}
              onStartChange={updatePayrollPeriodStart}
              PickerField={StaffPickerField}
              start={payrollPeriodStart}
              startLabel={text.labels.periodStart}
            />
            <div className="staff-hr-accountant-download-action">
              <button
                aria-describedby={accountantDownloadPending ? 'staff-accountant-download-wait' : undefined}
                className="primary"
                type="button"
                disabled={saving || accountantDownloadPending}
                onClick={() => void startAccountantDownload()}
              >
                {accountantDownloadPending
                  ? <RefreshCw aria-hidden="true" className="staff-spin" size={17} />
                  : <Download aria-hidden="true" size={17} />}
                {accountantDownloadPending ? accountantCopy.downloading : accountantCopy.download}
              </button>
              {accountantDownloadPending ? (
                <p className="staff-hr-accountant-download-wait" id="staff-accountant-download-wait" role="status">
                  {accountantCopy.downloadWait}
                </p>
              ) : null}
            </div>
          </div>
        </header>
        <div className="staff-hr-accountant-steps">
          {([
            ['employees', incompleteEmployeeCount, () => setHrTab('employees')],
            ['attendance', pendingAttendanceCount, () => setHrTab('timesheet')],
            ['policy', 0, () => setHrTab('settings')],
            ['reconcile', missingBankCount, () => setHrTab(missingBankCount ? 'employees' : 'payroll')],
          ] as const).map(([step, issueCount, open], index) => (
            <button className={issueCount > 0 ? 'needs-review' : 'is-ready'} key={step} type="button" onClick={open}>
              <span className="staff-hr-accountant-step-number">{index + 1}</span>
              <span><strong>{accountantCopy.steps[step][0]}</strong><small>{accountantCopy.steps[step][1]}</small></span>
              <em>{issueCount > 0 ? `${issueCount} ${accountantCopy.review}` : accountantCopy.ready}</em>
            </button>
          ))}
        </div>
        <div className="staff-hr-accountant-grid">
          <div className="staff-hr-accountant-readiness">
            <h4>{accountantCopy.readiness}</h4>
            {([
              [accountantCopy.checks.employees, incompleteEmployeeCount, accountantCopy.issueLabels.employees],
              [accountantCopy.checks.contracts, incompleteEmployeeCount, accountantCopy.issueLabels.employees],
              [accountantCopy.checks.attendance, pendingAttendanceCount, accountantCopy.issueLabels.attendance],
              [accountantCopy.checks.bank, missingBankCount, accountantCopy.issueLabels.bank],
              [accountantCopy.checks.payroll, accountantIssueCount, accountantCopy.review],
            ] as const).map(([label, issueCount, issueLabel]) => (
              <div className={issueCount > 0 ? 'needs-review' : 'is-ready'} key={label}>
                <CircleCheckBig aria-hidden="true" size={19} />
                <span><strong>{label}</strong><small>{issueCount > 0 ? `${issueCount} ${issueLabel}` : accountantCopy.ready}</small></span>
                <em>{issueCount > 0 ? accountantCopy.review : 'OK'}</em>
              </div>
            ))}
            <p className="staff-hr-accountant-formula-note"><FileSpreadsheet aria-hidden="true" size={17} />{accountantCopy.formulaNote}</p>
          </div>
          <aside className="staff-hr-accountant-policy">
            <h4>{accountantCopy.policyTitle}</h4>
            <div>{accountantCopy.policies.map((policy) => <span key={policy}>{policy}</span>)}</div>
          </aside>
          <aside className="staff-hr-accountant-includes">
            <h4>{accountantCopy.includesTitle}</h4>
            <div>{accountantCopy.includes.map((item) => <span key={item}><Check aria-hidden="true" size={14} />{item}</span>)}</div>
          </aside>
        </div>
      </section>
      <StaffCostReport rows={costReportRows} language={resolvedLanguage} start={payrollPeriodStart} end={payrollPeriodEnd} />
      <div className="staff-attendance-layout staff-hr-payroll-layout">
        <fieldset className="staff-readonly-fieldset staff-attendance-form" disabled={!canManageAttendance}>
          <h4>{text.labels.payrollRun}</h4>
          <div className="form-grid compact-form-grid">
            <label>{text.labels.payrollCode}<input value={payrollRunForm.code} onChange={(event) => setPayrollRunForm({ ...payrollRunForm, code: event.target.value })} /></label>
            <label>{text.labels.payrollName}<input value={payrollRunForm.name} onChange={(event) => setPayrollRunForm({ ...payrollRunForm, name: event.target.value })} /></label>
            <label>{text.labels.payCycle}<select value={payrollRunForm.pay_cycle} onChange={(event) => setPayrollRunForm({ ...payrollRunForm, pay_cycle: normalizePayrollPayCycle(event.target.value) })}>{staffPayrollPayCycles.map((cycle) => <option key={cycle} value={cycle}>{text.payrollPayCycles[cycle]}</option>)}</select></label>
            <label>{text.labels.periodStart}<StaffPickerField ariaLabel={text.labels.periodStart} placeholder={text.chooseDate} type="date" value={payrollRunForm.period_start} onChange={(value: string) => setPayrollRunForm({ ...payrollRunForm, period_start: value })} /></label>
            <label>{text.labels.periodEnd}<StaffPickerField ariaLabel={text.labels.periodEnd} placeholder={text.chooseDate} type="date" value={payrollRunForm.period_end} onChange={(value: string) => setPayrollRunForm({ ...payrollRunForm, period_end: value })} /></label>
            <label className="full">{text.labels.notes}<textarea value={payrollRunForm.notes} onChange={(event) => setPayrollRunForm({ ...payrollRunForm, notes: event.target.value })} /></label>
          </div>
          <div className="staff-summary-grid staff-employee-summary staff-hr-pay-summary">
            <div><span>{text.labels.totalGross}</span><strong>{formatVnd(hrPayrollTotals.gross)}</strong></div>
            <div><span>{text.labels.totalNet}</span><strong>{formatVnd(hrPayrollTotals.net)}</strong></div>
            <div><span>{text.labels.totalCompanyCost}</span><strong>{formatVnd(hrPayrollTotals.companyCost)}</strong></div>
          </div>
          <div className="staff-row-actions staff-hr-payroll-actions">
            <button className="primary" type="button" disabled={saving} onClick={generatePayrollRun}>
              <ButtonIconText icon={<Save aria-hidden="true" size={15} />}>{text.actions.generatePayroll}</ButtonIconText>
            </button>
            <button type="button" disabled={saving} onClick={() => void downloadPayrollExcel()}>
              <ButtonIconText icon={<FileSpreadsheet aria-hidden="true" size={15} />}>{text.actions.downloadPayrollExcel}</ButtonIconText>
            </button>
          </div>
        </fieldset>
        <div className="staff-attendance-list">
          <div className="staff-hr-payslip-heading">
            <h4>{text.labels.payslipPreview}</h4>
            <span>{filteredPayslipProfiles.length} {filteredPayslipProfiles.length === 1 ? payslipCopy.result : payslipCopy.results}</span>
          </div>
          <div className="staff-hr-payslip-selector">
            <label>{payslipCopy.group}<select value={payslipDepartmentFilter} onChange={(event) => setPayslipDepartmentFilter(event.target.value)}><option value="all">{payslipCopy.allGroups}</option>{payslipDepartments.map((department) => <option key={department} value={department}>{department}</option>)}</select></label>
            <label>{payslipCopy.location}<select value={payslipLocationFilter} onChange={(event) => setPayslipLocationFilter(event.target.value)}><option value="all">{payslipCopy.allLocations}</option>{payslipLocations.map((location) => <option key={location} value={location}>{location}</option>)}</select></label>
            <label className="staff-hr-payslip-employee-select">{payslipCopy.employee}<select disabled={filteredPayslipProfiles.length === 0} value={effectivePayslipEmployeeId} onChange={(event) => setPayslipSelectedEmployeeId(event.target.value)}>{filteredPayslipProfiles.map((staffProfile) => { const employee = employeeProfileById.get(staffProfile.id); return <option key={staffProfile.id} value={staffProfile.id}>{employee?.legal_name || customerName(staffProfile, text)}{employee?.employee_code ? ` · ${employee.employee_code}` : ''}</option> })}</select></label>
          </div>
          {payslipEmployeeProfile ? (
            <div className="staff-hr-payslip">
              <div className="staff-hr-payslip-person">
                <div><strong>{payslipEmployeeName}</strong><span>{[payslipEmployee?.department, payslipEmployee?.main_work_location].filter(Boolean).join(' · ')}</span></div>
                <span>{rangeLabel(payrollPeriodStart, payrollPeriodEnd)}</span>
              </div>
              <dl>
                <div><dt>{text.labels.paidLeave}</dt><dd>{Number(payslipEmployeeSummary.paidLeaveDays.toFixed(2))} {text.days}</dd></div>
                <div><dt>{text.labels.mealAllowance}</dt><dd>{formatVnd(payslipEmployeeSummary.mealAllowance)}</dd></div>
                <div><dt>{text.labels.overtimePay}</dt><dd>{formatVnd(payslipEmployeeSummary.overtimePay)}</dd></div>
                <div><dt>{text.labels.grossIncome}</dt><dd>{formatVnd(payslipEmployeeSummary.grossIncome)}</dd></div>
                <div><dt>{text.labels.employeeContributions}</dt><dd>{formatVnd(payslipEmployeeSummary.employeeContributions)}</dd></div>
                <div><dt>{text.labels.pitWithheld}</dt><dd>{formatVnd(payslipEmployeeSummary.pitWithheld)}</dd></div>
                <div><dt>{text.labels.netIncome}</dt><dd>{formatVnd(payslipEmployeeSummary.netIncome)}</dd></div>
                <div><dt>{text.labels.companyCost}</dt><dd>{formatVnd(payslipEmployeeSummary.companyCost)}</dd></div>
              </dl>
              <button type="button" onClick={() => void downloadEmployeePayslip(effectivePayslipEmployeeId)}>
                <ButtonIconText icon={<Download aria-hidden="true" size={14} />}>{text.actions.viewPayslip}</ButtonIconText>
              </button>
            </div>
          ) : <p className="notice">{payslipCopy.noEmployees}</p>}
          <h4>{text.hrTabs.payroll}</h4>
          {payrollRuns.map((run) => (
            <article className="staff-attendance-row" key={run.id}>
              <div className="staff-attendance-person">
                <FileSpreadsheet aria-hidden="true" size={20} />
                <div>
                  <strong>{run.name}</strong>
                  <span>{run.code} · {staffDateLabel(run.period_start)} - {staffDateLabel(run.period_end)}</span>
                </div>
              </div>
              <div className="staff-attendance-meta">
                <span>{text.payrollStatuses[normalizePayrollStatus(run.status)]}</span>
                <span>{formatVnd(run.total_net_vnd)}</span>
                <span>{payrollItems.filter((item) => item.payroll_run_id === run.id).length} {text.hrTabs.employees}</span>
              </div>
              <div className="staff-row-actions staff-attendance-row-actions">
                {canManageAttendance && run.status !== 'approved' && (
                  <button type="button" onClick={() => approvePayrollRun(run)}>
                    <ButtonIconText icon={<Check aria-hidden="true" size={14} />}>{text.actions.approvePayroll}</ButtonIconText>
                  </button>
                )}
              </div>
            </article>
          ))}
          {payrollRuns.length === 0 && <p className="notice">{text.messages.noPayrollRuns}</p>}
        </div>
      </div>
    </>
  )
}
