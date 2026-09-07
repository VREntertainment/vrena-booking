'use client'

import {
  CalendarCheck2,
  Search
} from 'lucide-react'
import { StaffPickerField } from '../../components/staff/StaffPickerField'
import { hoursLabel, staffDateLabel } from '../../lib/staff/dates'
import type { StaffHrModel } from '../../lib/staff/hrModel'
import { emptyStaffPayrollCalculation, isPaidLeaveForEmployee, leaveHoursInsidePeriod } from '../../lib/staff/payroll'
import { customerName } from '../../lib/staff/profiles'
import { StaffPeriodRangePicker, hrCompletionCopy, leaveDateRangeTitle } from './presentation'

export type TimesheetSectionProps = {
  text: StaffHrModel['shared']['text']
  payrollPeriodEnd: StaffHrModel['payroll']['payrollPeriodEnd']
  updatePayrollPeriodEnd: (value: string) => void
  updatePayrollPeriodStart: (value: string) => void
  payrollPeriodStart: StaffHrModel['payroll']['payrollPeriodStart']
  completionText: (typeof hrCompletionCopy)["en" | "vi"]
  timesheetSearch: string
  setTimesheetSearch: React.Dispatch<React.SetStateAction<string>>
  isOwnerOrAdmin: StaffHrModel['access']['isOwnerOrAdmin']
  saving: StaffHrModel['shared']['saving']
  periodAttendanceLogs: import("../../lib/staff/types").StaffAttendanceLog[]
  pendingAttendanceCount: number
  approveAttendancePeriod: StaffHrModel['schedule']['approveAttendancePeriod']
  timesheetProfiles: import("../../lib/staff/types").StaffProfile[]
  staffPayrollCalculations: StaffHrModel['payroll']['staffPayrollCalculations']
  employeeProfileById: StaffHrModel['employees']['employeeProfileById']
  leaveRequests: StaffHrModel['payroll']['leaveRequests']
}

export default function TimesheetSection({
  text,
  payrollPeriodEnd,
  updatePayrollPeriodEnd,
  updatePayrollPeriodStart,
  payrollPeriodStart,
  completionText,
  timesheetSearch,
  setTimesheetSearch,
  isOwnerOrAdmin,
  saving,
  periodAttendanceLogs,
  pendingAttendanceCount,
  approveAttendancePeriod,
  timesheetProfiles,
  staffPayrollCalculations,
  employeeProfileById,
  leaveRequests,
}: TimesheetSectionProps) {
  return (
    <div className="staff-hr-table-panel">
      <div className="staff-hr-panel-head staff-hr-timesheet-toolbar">
        <div className="staff-hr-timesheet-title">
          <h4>{text.hrTabs.timesheet}</h4>
          <StaffPeriodRangePicker
            end={payrollPeriodEnd}
            endLabel={text.labels.periodEnd}
            onEndChange={updatePayrollPeriodEnd}
            onStartChange={updatePayrollPeriodStart}
            PickerField={StaffPickerField}
            start={payrollPeriodStart}
            startLabel={text.labels.periodStart}
          />
        </div>
        <label className="staff-hr-timesheet-search">
          <Search aria-hidden="true" size={17} />
          <input aria-label={completionText.searchEmployees} placeholder={completionText.searchEmployees} value={timesheetSearch} onChange={(event) => setTimesheetSearch(event.target.value)} />
        </label>
        {isOwnerOrAdmin && (
          <button className="primary staff-hr-approve-attendance" disabled={saving || periodAttendanceLogs.length === 0 || pendingAttendanceCount === 0} type="button" onClick={() => void approveAttendancePeriod()}>
            <CalendarCheck2 aria-hidden="true" size={17} />
            {completionText.approveAttendance}
            {pendingAttendanceCount > 0 && <span>{pendingAttendanceCount}</span>}
          </button>
        )}
      </div>
      <div className="staff-table-wrap">
        <table className="staff-table staff-attendance-table">
          <thead>
            <tr>
              <th>{text.labels.staffMember}</th>
              <th>{completionText.payType}</th>
              <th>{completionText.present}</th>
              <th>{completionText.paidLeave}</th>
              <th>{completionText.unpaidLeave}</th>
              <th>{completionText.lateArrival}</th>
              <th>{completionText.earlyLeave}</th>
              <th>{text.labels.overtimeHours}</th>
              <th>{completionText.approveAttendance}</th>
            </tr>
          </thead>
          <tbody>
            {timesheetProfiles.map((staffProfile) => {
              const calculation = staffPayrollCalculations.get(staffProfile.id) || emptyStaffPayrollCalculation(staffProfile.id)
              const employee = employeeProfileById.get(staffProfile.id)
              const employeeLogs = periodAttendanceLogs.filter((log) => log.staff_profile_id === staffProfile.id)
              const employeeLeaves = leaveRequests.filter((leave) => (
                leave.staff_profile_id === staffProfile.id
                && leave.status === 'approved'
                && leave.end_date >= payrollPeriodStart
                && leave.start_date <= payrollPeriodEnd
              ))
              const paidEmployeeLeaves = employeeLeaves.filter((leave) => isPaidLeaveForEmployee(leave, employee))
              const unpaidEmployeeLeaves = employeeLeaves.filter((leave) => !isPaidLeaveForEmployee(leave, employee))
              const unpaidLeaveMinutes = unpaidEmployeeLeaves.reduce((sum: number, leave) => (
                sum + (leaveHoursInsidePeriod(leave, payrollPeriodStart, payrollPeriodEnd) * 60)
              ), 0)
              const paidLeaveDates = leaveDateRangeTitle(paidEmployeeLeaves, payrollPeriodStart, payrollPeriodEnd, staffDateLabel)
              const unpaidLeaveDates = leaveDateRangeTitle(unpaidEmployeeLeaves, payrollPeriodStart, payrollPeriodEnd, staffDateLabel)
              const presentShifts = employeeLogs.filter((log) => log.clock_in_at && log.clock_out_at).length
              const lateLogs = employeeLogs.filter((log) => Number(log.late_minutes) > 0)
              const earlyLogs = employeeLogs.filter((log) => Number(log.early_leave_minutes) > 0)
              const lateMinutes = lateLogs.reduce((sum: number, log) => sum + Number(log.late_minutes || 0), 0)
              const earlyMinutes = earlyLogs.reduce((sum: number, log) => sum + Number(log.early_leave_minutes || 0), 0)
              const approved = employeeLogs.length > 0 && employeeLogs.every((log) => log.approval_status === 'approved')
              return (
                <tr key={staffProfile.id}>
                  <td>
                    <strong>{customerName(staffProfile, text)}</strong>
                    <small>{employee?.employee_code || employee?.attendance_number || '—'}</small>
                  </td>
                  <td>{Number(employee?.base_salary_vnd) > 0 ? completionText.byMonth : completionText.byHour}</td>
                  <td><strong>{presentShifts} {completionText.shifts}</strong><small>{hoursLabel(calculation.workedMinutes)}</small></td>
                  <td className={`staff-hr-leave-cell ${paidLeaveDates ? 'has-dates' : ''}`} title={paidLeaveDates || undefined}><strong>{paidEmployeeLeaves.length || '—'}</strong><small>{paidEmployeeLeaves.length ? hoursLabel(calculation.paidLeaveHours * 60) : ''}</small></td>
                  <td className={`staff-hr-leave-cell ${unpaidLeaveDates ? 'has-dates' : ''}`} title={unpaidLeaveDates || undefined}><strong>{unpaidEmployeeLeaves.length || '—'}</strong><small>{unpaidEmployeeLeaves.length ? hoursLabel(unpaidLeaveMinutes) : ''}</small></td>
                  <td><strong>{lateLogs.length || '—'}{lateLogs.length ? ` ${completionText.occurrences}` : ''}</strong><small>{lateMinutes ? hoursLabel(lateMinutes) : ''}</small></td>
                  <td><strong>{earlyLogs.length || '—'}{earlyLogs.length ? ` ${completionText.occurrences}` : ''}</strong><small>{earlyMinutes ? hoursLabel(earlyMinutes) : ''}</small></td>
                  <td><strong>{calculation.overtimeMinutes > 0 ? hoursLabel(calculation.overtimeMinutes) : '—'}</strong></td>
                  <td><span className={`staff-hr-approval-state ${approved ? 'approved' : 'pending'}`}>{approved ? completionText.approved : completionText.pending}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {timesheetProfiles.length === 0 && <p className="notice">{completionText.noAttendance}</p>}
    </div>
  )
}
