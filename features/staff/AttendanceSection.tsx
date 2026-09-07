'use client'

import {
  Ban,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Pencil,
  Save,
  Send,
  X
} from 'lucide-react'
import { Fragment } from 'react'
import { StaffPickerField } from '../../components/staff/StaffPickerField'
import { StaffRoleAvatar } from '../../components/staff/StaffRoleAvatar'
import type { StaffConsoleCopy } from '../../lib/staff/copy'
import {
  dateFromInput,
  durationTimeValue,
  hoursLabel,
  minutesBetween,
  normalizeTime,
  parseMinutesTime,
  shortDateLabel,
  staffDateLabel,
  timeValueFromIso
} from '../../lib/staff/dates'
import {
  staffAttendanceStatuses,
  staffLeaveTypes,
  staffShiftStatuses
} from '../../lib/staff/options'
import {
  customerName
} from '../../lib/staff/profiles'
import type {
  StaffAttendanceStatus,
  StaffLeaveType,
  StaffShiftStatus,
  StaffShiftTemplateId
} from '../../lib/staff/types'
import { ButtonIconText } from './shared'

export type AttendanceSectionProps = {
  shiftAttendanceRange: (dayOffset: number) => void
  attendanceWeekDates: string[]
  text: StaffConsoleCopy
  attendanceWeekStart: string
  setAttendanceRange: (start: string, end: string) => void
  attendanceWeekEnd: string
  resetAttendanceRangeToThisWeek: () => void
  canEditAttendance: boolean
  attendanceSummary: { scheduledMinutes: number; workedMinutes: number; regularMinutes: number; overtimeMinutes: number; nightMinutes: number; holidayMinutes: number; leaveHours: number }
  visibleAttendanceTabs: import("../../lib/staff/types").StaffAttendanceTab[]
  currentAttendanceTab: import("../../lib/staff/types").StaffAttendanceTab
  setAttendanceTab: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffAttendanceTab>>
  visibleStaffProfileOptions: import("../../lib/staff/types").StaffProfile[]
  selectedShiftTemplate: import("../../lib/staff/types").StaffShiftTemplateId
  applyShiftTemplate: (templateId: import("../../lib/staff/types").StaffShiftTemplateId) => void
  canManageAttendance: boolean
  effectiveShiftTemplates: import("../../lib/staff/types").StaffShiftTemplate[]
  copyPreviousAttendanceWeek: () => Promise<void>
  saving: boolean
  publishAttendanceWeek: () => Promise<void>
  draftShiftCount: number
  attendanceGridStyle: { gridTemplateColumns: string; minWidth: string }
  employeeProfileById: Map<string, import("../../lib/staff/types").StaffEmployeeProfile>
  attendanceShiftsByCell: Map<string, import("../../lib/staff/types").StaffScheduleShift[]>
  visibleAttendanceShifts: import("../../lib/staff/types").StaffScheduleShift[]
  draggingShiftId: string
  moveShiftToCell: (shift: import("../../lib/staff/types").StaffScheduleShift, staffProfileId: string, shiftDate: string) => Promise<void>
  setDraggingShiftId: React.Dispatch<React.SetStateAction<string>>
  startShiftForCell: (staffProfileId: string, shiftDate: string) => Promise<void>
  shiftWarningsById: Map<string, string[]>
  editShift: (shift: import("../../lib/staff/types").StaffScheduleShift) => void
  profileById: Map<string, import("../../lib/staff/types").StaffProfile>
  updateShiftStatus: (shift: import("../../lib/staff/types").StaffScheduleShift, status: import("../../lib/staff/types").StaffShiftStatus) => Promise<void>
  shiftForm: { id: string; staff_profile_id: string; location: string; shift_role: string; shift_date: string; start_time: string; end_time: string; break_minutes: string; status: import("../../lib/staff/types").StaffShiftStatus; notes: string }
  firstStaffProfileId: string
  setShiftForm: React.Dispatch<React.SetStateAction<{ id: string; staff_profile_id: string; location: string; shift_role: string; shift_date: string; start_time: string; end_time: string; break_minutes: string; status: import("../../lib/staff/types").StaffShiftStatus; notes: string }>>
  saveShift: () => Promise<void>
  visibleAttendanceLogs: import("../../lib/staff/types").StaffAttendanceLog[]
  editAttendanceLog: (log: import("../../lib/staff/types").StaffAttendanceLog) => void
  attendanceLogForm: { id: string; staff_profile_id: string; shift_id: string; work_date: string; clock_in_time: string; clock_out_time: string; break_minutes: string; status: import("../../lib/staff/types").StaffAttendanceStatus; regular_minutes: string; overtime_minutes: string; night_minutes: string; holiday_minutes: string; manager_note: string }
  setAttendanceLogForm: React.Dispatch<React.SetStateAction<{ id: string; staff_profile_id: string; shift_id: string; work_date: string; clock_in_time: string; clock_out_time: string; break_minutes: string; status: import("../../lib/staff/types").StaffAttendanceStatus; regular_minutes: string; overtime_minutes: string; night_minutes: string; holiday_minutes: string; manager_note: string }>>
  saveAttendanceLog: () => Promise<void>
  visibleLeaveRequests: import("../../lib/staff/types").StaffLeaveRequest[]
  editLeaveRequest: (request: import("../../lib/staff/types").StaffLeaveRequest) => void
  updateLeaveStatus: (request: import("../../lib/staff/types").StaffLeaveRequest, status: import("../../lib/staff/types").StaffLeaveStatus) => Promise<void>
  leaveForm: { id: string; staff_profile_id: string; leave_type: import("../../lib/staff/types").StaffLeaveType; start_date: string; end_date: string; hours: string; reason: string }
  setLeaveForm: React.Dispatch<React.SetStateAction<{ id: string; staff_profile_id: string; leave_type: import("../../lib/staff/types").StaffLeaveType; start_date: string; end_date: string; hours: string; reason: string }>>
  submitLeaveRequest: () => Promise<void>
  attendanceSettings: import("../../lib/staff/types").StaffAttendanceSettings
  setAttendanceSettings: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffAttendanceSettings>>
  updateAttendanceShiftTemplate: (templateId: import("../../lib/staff/types").StaffShiftTemplateId, patch: Partial<Omit<import("../../lib/staff/types").StaffShiftTemplate, "id">>) => void
  saveAttendanceSettings: () => Promise<void>
}

export default function AttendanceSection({
  shiftAttendanceRange,
  attendanceWeekDates,
  text,
  attendanceWeekStart,
  setAttendanceRange,
  attendanceWeekEnd,
  resetAttendanceRangeToThisWeek,
  canEditAttendance,
  attendanceSummary,
  visibleAttendanceTabs,
  currentAttendanceTab,
  setAttendanceTab,
  visibleStaffProfileOptions,
  selectedShiftTemplate,
  applyShiftTemplate,
  canManageAttendance,
  effectiveShiftTemplates,
  copyPreviousAttendanceWeek,
  saving,
  publishAttendanceWeek,
  draftShiftCount,
  attendanceGridStyle,
  employeeProfileById,
  attendanceShiftsByCell,
  visibleAttendanceShifts,
  draggingShiftId,
  moveShiftToCell,
  setDraggingShiftId,
  startShiftForCell,
  shiftWarningsById,
  editShift,
  profileById,
  updateShiftStatus,
  shiftForm,
  firstStaffProfileId,
  setShiftForm,
  saveShift,
  visibleAttendanceLogs,
  editAttendanceLog,
  attendanceLogForm,
  setAttendanceLogForm,
  saveAttendanceLog,
  visibleLeaveRequests,
  editLeaveRequest,
  updateLeaveStatus,
  leaveForm,
  setLeaveForm,
  submitLeaveRequest,
  attendanceSettings,
  setAttendanceSettings,
  updateAttendanceShiftTemplate,
  saveAttendanceSettings,
}: AttendanceSectionProps) {
  return (
    <div className="staff-card staff-card-wide staff-attendance-card">
      <div className="staff-card-heading">
        <div className="staff-operations-actions staff-attendance-actions">
          <button type="button" onClick={() => shiftAttendanceRange(-attendanceWeekDates.length)}>
            <ButtonIconText icon={<ChevronLeft aria-hidden="true" size={14} />}>{text.actions.previousWeek}</ButtonIconText>
          </button>
          <label>
            <span className="staff-field-label">{text.labels.startDate}</span>
            <StaffPickerField
              ariaLabel={text.labels.startDate}
              placeholder={text.chooseDate}
              type="date"
              value={attendanceWeekStart}
              onChange={(value) => setAttendanceRange(value, attendanceWeekEnd)}
            />
          </label>
          <label>
            <span className="staff-field-label">{text.labels.endDate}</span>
            <StaffPickerField
              ariaLabel={text.labels.endDate}
              placeholder={text.chooseDate}
              type="date"
              value={attendanceWeekEnd}
              onChange={(value) => setAttendanceRange(attendanceWeekStart, value)}
            />
          </label>
          <button type="button" onClick={resetAttendanceRangeToThisWeek}>
            <ButtonIconText icon={<CalendarDays aria-hidden="true" size={14} />}>{text.actions.today}</ButtonIconText>
          </button>
          <button type="button" onClick={() => shiftAttendanceRange(attendanceWeekDates.length)}>
            <ButtonIconText icon={<ChevronRight aria-hidden="true" size={14} />}>{text.actions.nextWeek}</ButtonIconText>
          </button>
        </div>
      </div>

      <p className="staff-attendance-range">{staffDateLabel(attendanceWeekStart)} - {staffDateLabel(attendanceWeekEnd)}</p>
      {!canEditAttendance && <p className="staff-readonly-note">{text.messages.attendanceReadOnly}</p>}

      <div className="staff-summary-grid staff-attendance-summary">
        <div><span>{text.labels.scheduledHours}</span><strong>{hoursLabel(attendanceSummary.scheduledMinutes)}</strong></div>
        <div><span>{text.labels.workedHours}</span><strong>{hoursLabel(attendanceSummary.workedMinutes)}</strong></div>
        <div><span>{text.labels.regularHours}</span><strong>{hoursLabel(attendanceSummary.regularMinutes)}</strong></div>
        <div><span>{text.labels.overtimeHours}</span><strong>{hoursLabel(attendanceSummary.overtimeMinutes)}</strong></div>
        <div><span>{text.labels.nightHours}</span><strong>{hoursLabel(attendanceSummary.nightMinutes)}</strong></div>
        <div><span>{text.labels.leaveHours}</span><strong>{attendanceSummary.leaveHours}h</strong></div>
      </div>

      <div className="staff-commerce-switcher staff-attendance-tabs" role="tablist" aria-label={text.tabs.attendance}>
        {visibleAttendanceTabs.map((item) => (
          <button
            aria-selected={currentAttendanceTab === item}
            className={currentAttendanceTab === item ? 'active' : ''}
            key={item}
            role="tab"
            type="button"
            onClick={() => setAttendanceTab(item)}
          >
            {text.attendanceTabs[item]}
          </button>
        ))}
      </div>

      {visibleStaffProfileOptions.length === 0 ? (
        <p className="notice">{text.messages.noStaffProfiles}</p>
      ) : (
        <>
          {currentAttendanceTab === 'schedule' && (
            <>
              <section className="staff-planning-panel" aria-label={text.labels.weeklySchedule}>
                <div className="staff-planning-toolbar">
                  <div className="staff-planning-title">
                    <strong>{text.labels.weeklySchedule}</strong>
                    <span>{text.messages.planningGridHelp}</span>
                  </div>
                  <label>
                    {text.labels.shiftTemplate}
                    <select value={selectedShiftTemplate} onChange={(event) => applyShiftTemplate(event.target.value as StaffShiftTemplateId)} disabled={!canManageAttendance}>
                      {effectiveShiftTemplates.map((template) => <option key={template.id} value={template.id}>{text.shiftTemplates[template.id]}</option>)}
                    </select>
                  </label>
                  {canManageAttendance && (
                    <div className="staff-planning-actions">
                      <button type="button" onClick={copyPreviousAttendanceWeek} disabled={saving}>
                        <ButtonIconText icon={<Copy aria-hidden="true" size={14} />}>{text.actions.copyPreviousWeek}</ButtonIconText>
                      </button>
                      <button type="button" onClick={publishAttendanceWeek} disabled={saving || draftShiftCount === 0}>
                        <ButtonIconText icon={<Send aria-hidden="true" size={14} />}>
                          {text.actions.publishWeek}{draftShiftCount > 0 ? ` (${draftShiftCount})` : ''}
                        </ButtonIconText>
                      </button>
                    </div>
                  )}
                </div>

                <div className="staff-planning-grid-shell">
                  <div className="staff-planning-grid" role="grid" aria-label={text.labels.weeklySchedule} style={attendanceGridStyle}>
                    <div className="staff-planning-corner" role="columnheader">{text.labels.staffMember}</div>
                    {attendanceWeekDates.map((dateValue) => (
                      <div className="staff-planning-day" role="columnheader" key={dateValue}>
                        <strong>{shortDateLabel(dateValue)}</strong>
                        <span>{text.reportWeekdays[(dateFromInput(dateValue).getDay() + 6) % 7]}</span>
                      </div>
                    ))}
                    {visibleStaffProfileOptions.map((staffProfile) => {
                      const employee = employeeProfileById.get(staffProfile.id)
                      const isInactiveEmployee = employee?.active === false
                      return (
                        <Fragment key={staffProfile.id}>
                          <div className={`staff-planning-staff ${isInactiveEmployee ? 'inactive' : ''}`} role="rowheader">
                            <StaffRoleAvatar profile={staffProfile} text={text} />
                            <span>
                              <strong>{customerName(staffProfile, text)}</strong>
                              {isInactiveEmployee && <small>{text.labels.inactiveEmployee}</small>}
                            </span>
                          </div>
                          {attendanceWeekDates.map((dateValue) => {
                            const cellShifts = attendanceShiftsByCell.get(`${staffProfile.id}:${dateValue}`) || []
                            return (
                              <div
                                className="staff-planning-cell"
                                key={`${staffProfile.id}:${dateValue}`}
                                role="gridcell"
                                onDragOver={(event) => {
                                  if (!canManageAttendance || isInactiveEmployee) return
                                  event.preventDefault()
                                }}
                                onDrop={(event) => {
                                  event.preventDefault()
                                  if (isInactiveEmployee) return
                                  const shift = visibleAttendanceShifts.find((item) => item.id === draggingShiftId)
                                  if (shift) void moveShiftToCell(shift, staffProfile.id, dateValue)
                                  setDraggingShiftId('')
                                }}
                              >
                                {canManageAttendance && (
                                  <button
                                    aria-label={`${text.aria.draftShift}: ${customerName(staffProfile, text)} ${shortDateLabel(dateValue)}`}
                                    className="staff-planning-cell-button"
                                    disabled={saving || isInactiveEmployee}
                                    type="button"
                                    onClick={() => void startShiftForCell(staffProfile.id, dateValue)}
                                  >
                                    +
                                  </button>
                                )}
                                {cellShifts.map((shift) => {
                                  const warnings = shiftWarningsById.get(shift.id) || []
                                  return (
                                    <button
                                      className={`staff-shift-chip ${warnings.length > 0 ? 'has-warning' : ''}`}
                                      draggable={canManageAttendance}
                                      key={shift.id}
                                      type="button"
                                      onClick={() => editShift(shift)}
                                      onDragStart={() => setDraggingShiftId(shift.id)}
                                      onDragEnd={() => setDraggingShiftId('')}
                                    >
                                      <span>{normalizeTime(shift.start_time)}-{normalizeTime(shift.end_time)}</span>
                                      <small>{text.shiftStatuses[shift.status]}</small>
                                      {warnings.length > 0 && <em>{warnings[0]}</em>}
                                    </button>
                                  )
                                })}
                              </div>
                            )
                          })}
                        </Fragment>
                      )
                    })}
                  </div>
                </div>
              </section>

              <div className="staff-attendance-layout">
                <div className="staff-attendance-list">
                  <h4>{text.labels.shiftList}</h4>
                  {visibleAttendanceShifts.map((shift) => {
                    const staffProfile = profileById.get(shift.staff_profile_id)
                    const warnings = shiftWarningsById.get(shift.id) || []
                    return (
                      <article className="staff-attendance-row" key={shift.id}>
                        <div className="staff-attendance-person">
                          {staffProfile && <StaffRoleAvatar profile={staffProfile} text={text} />}
                          <div>
                            <strong>{staffProfile ? customerName(staffProfile, text) : text.customerFallback}</strong>
                            <span>{staffDateLabel(shift.shift_date)} · {normalizeTime(shift.start_time)}-{normalizeTime(shift.end_time)}</span>
                          </div>
                        </div>
                        <div className="staff-attendance-meta">
                          <span>{shift.location}</span>
                          <span>{text.shiftStatuses[shift.status]}</span>
                          <span>{text.labels.breakMinutes}: {shift.break_minutes}</span>
                          {warnings.map((warning) => <span className="staff-warning-text" key={warning}>{warning}</span>)}
                        </div>
                        {canManageAttendance && (
                          <div className="staff-row-actions staff-attendance-row-actions">
                            <button type="button" onClick={() => editShift(shift)}>
                              <ButtonIconText icon={<Pencil aria-hidden="true" size={14} />}>{text.actions.edit}</ButtonIconText>
                            </button>
                            {shift.status === 'draft' && (
                              <button type="button" onClick={() => updateShiftStatus(shift, 'published')}>
                                <ButtonIconText icon={<Send aria-hidden="true" size={14} />}>{text.actions.publish}</ButtonIconText>
                              </button>
                            )}
                            {shift.status !== 'completed' && (
                              <button type="button" onClick={() => updateShiftStatus(shift, 'completed')}>
                                <ButtonIconText icon={<Check aria-hidden="true" size={14} />}>{text.actions.done}</ButtonIconText>
                              </button>
                            )}
                            {shift.status !== 'cancelled' && (
                              <button type="button" onClick={() => updateShiftStatus(shift, 'cancelled')}>
                                <ButtonIconText icon={<Ban aria-hidden="true" size={14} />}>{text.actions.cancelShift}</ButtonIconText>
                              </button>
                            )}
                          </div>
                        )}
                      </article>
                    )
                  })}
                  {visibleAttendanceShifts.length === 0 && <p className="notice">{text.messages.noShifts}</p>}
                </div>

                <fieldset className="staff-readonly-fieldset staff-attendance-form" disabled={!canManageAttendance}>
                  <h4>{text.labels.weeklySchedule}</h4>
                  <div className="form-grid compact-form-grid">
                    <label>
                      {text.labels.staffMember}
                      <select value={shiftForm.staff_profile_id || firstStaffProfileId} onChange={(event) => setShiftForm({ ...shiftForm, staff_profile_id: event.target.value })}>
                        {visibleStaffProfileOptions.map((item) => <option key={item.id} value={item.id}>{customerName(item, text)}</option>)}
                      </select>
                    </label>
                    <label>
                      {text.labels.shiftDate}
                      <StaffPickerField ariaLabel={text.labels.shiftDate} placeholder={text.chooseDate} type="date" value={shiftForm.shift_date} onChange={(value) => setShiftForm({ ...shiftForm, shift_date: value })} />
                    </label>
                    <label>
                      {text.labels.start}
                      <StaffPickerField ariaLabel={text.labels.start} placeholder={text.chooseTime} type="time" value={shiftForm.start_time} onChange={(value) => setShiftForm({ ...shiftForm, start_time: value })} />
                    </label>
                    <label>
                      {text.labels.end}
                      <StaffPickerField ariaLabel={text.labels.end} placeholder={text.chooseTime} type="time" value={shiftForm.end_time} onChange={(value) => setShiftForm({ ...shiftForm, end_time: value })} />
                    </label>
                    <label>{text.labels.breakMinutes}<input min={0} type="number" value={shiftForm.break_minutes} onChange={(event) => setShiftForm({ ...shiftForm, break_minutes: event.target.value })} /></label>
                    <label>{text.labels.location}<input value={shiftForm.location} onChange={(event) => setShiftForm({ ...shiftForm, location: event.target.value })} /></label>
                    <label>{text.labels.status}<select value={shiftForm.status} onChange={(event) => setShiftForm({ ...shiftForm, status: event.target.value as StaffShiftStatus })}>{staffShiftStatuses.map((status) => <option key={status} value={status}>{text.shiftStatuses[status]}</option>)}</select></label>
                    <label className="full">{text.labels.notes}<textarea value={shiftForm.notes} onChange={(event) => setShiftForm({ ...shiftForm, notes: event.target.value })} /></label>
                  </div>
                  <button className="primary" type="button" disabled={saving || !(shiftForm.staff_profile_id || firstStaffProfileId)} onClick={saveShift}>
                    <ButtonIconText icon={<Save aria-hidden="true" size={15} />}>{text.actions.saveShift}</ButtonIconText>
                  </button>
                </fieldset>
              </div>
            </>
          )}

          {currentAttendanceTab === 'clock' && (
            <div className="staff-attendance-layout">
              <div className="staff-attendance-list">
                {visibleAttendanceLogs.map((log) => {
                  const staffProfile = profileById.get(log.staff_profile_id)
                  return (
                    <article className="staff-attendance-row" key={log.id}>
                      <div className="staff-attendance-person">
                        {staffProfile && <StaffRoleAvatar profile={staffProfile} text={text} />}
                        <div>
                          <strong>{staffProfile ? customerName(staffProfile, text) : text.customerFallback}</strong>
                          <span>{staffDateLabel(log.work_date)} · {timeValueFromIso(log.clock_in_at) || '--:--'}-{timeValueFromIso(log.clock_out_at) || '--:--'}</span>
                        </div>
                      </div>
                      <div className="staff-attendance-meta">
                        <span>{text.attendanceStatuses[log.status]}</span>
                        <span>{text.labels.workedHours}: {hoursLabel(minutesBetween(log.clock_in_at, log.clock_out_at, log.break_minutes))}</span>
                        <span>{text.labels.overtimeHours}: {hoursLabel(log.overtime_minutes)}</span>
                        <span>{text.labels.nightHours}: {hoursLabel(log.night_minutes)}</span>
                      </div>
                      {canEditAttendance && (
                        <div className="staff-row-actions staff-attendance-row-actions">
                          <button type="button" onClick={() => editAttendanceLog(log)}>
                            <ButtonIconText icon={<Pencil aria-hidden="true" size={14} />}>{text.actions.edit}</ButtonIconText>
                          </button>
                        </div>
                      )}
                    </article>
                  )
                })}
                {visibleAttendanceLogs.length === 0 && <p className="notice">{text.messages.noAttendanceLogs}</p>}
              </div>

              <fieldset className="staff-readonly-fieldset staff-attendance-form" disabled={!canEditAttendance}>
                <h4>{text.attendanceTabs.clock}</h4>
                <div className="form-grid compact-form-grid">
                  <label>
                    {text.labels.staffMember}
                    <select value={attendanceLogForm.staff_profile_id || firstStaffProfileId} onChange={(event) => setAttendanceLogForm({ ...attendanceLogForm, staff_profile_id: event.target.value })}>
                      {visibleStaffProfileOptions.map((item) => <option key={item.id} value={item.id}>{customerName(item, text)}</option>)}
                    </select>
                  </label>
                  <label>
                    {text.labels.shiftList}
                    <select value={attendanceLogForm.shift_id} onChange={(event) => setAttendanceLogForm({ ...attendanceLogForm, shift_id: event.target.value })}>
                      <option value="">{text.any}</option>
                      {visibleAttendanceShifts
                        .filter((shift) => !(attendanceLogForm.staff_profile_id || firstStaffProfileId) || shift.staff_profile_id === (attendanceLogForm.staff_profile_id || firstStaffProfileId))
                        .map((shift) => <option key={shift.id} value={shift.id}>{staffDateLabel(shift.shift_date)} · {normalizeTime(shift.start_time)}-{normalizeTime(shift.end_time)}</option>)}
                    </select>
                  </label>
                  <label>
                    {text.labels.attendanceDate}
                    <StaffPickerField ariaLabel={text.aria.attendanceDate} placeholder={text.chooseDate} type="date" value={attendanceLogForm.work_date} onChange={(value) => setAttendanceLogForm({ ...attendanceLogForm, work_date: value })} />
                  </label>
                  <label>
                    {text.labels.start}
                    <StaffPickerField ariaLabel={text.aria.clockIn} placeholder={text.chooseTime} type="time" value={attendanceLogForm.clock_in_time} onChange={(value) => setAttendanceLogForm({ ...attendanceLogForm, clock_in_time: value })} />
                  </label>
                  <label>
                    {text.labels.end}
                    <StaffPickerField ariaLabel={text.aria.clockOut} placeholder={text.chooseTime} type="time" value={attendanceLogForm.clock_out_time} onChange={(value) => setAttendanceLogForm({ ...attendanceLogForm, clock_out_time: value })} />
                  </label>
                  <label>{text.labels.breakMinutes}<input min={0} type="number" value={attendanceLogForm.break_minutes} onChange={(event) => setAttendanceLogForm({ ...attendanceLogForm, break_minutes: event.target.value })} /></label>
                  <label>{text.labels.status}<select value={attendanceLogForm.status} onChange={(event) => setAttendanceLogForm({ ...attendanceLogForm, status: event.target.value as StaffAttendanceStatus })}>{staffAttendanceStatuses.map((status) => <option key={status} value={status}>{text.attendanceStatuses[status]}</option>)}</select></label>
                  <label>{text.labels.regularHours}<input min={0} step="0.25" type="number" value={attendanceLogForm.regular_minutes} onChange={(event) => setAttendanceLogForm({ ...attendanceLogForm, regular_minutes: event.target.value })} /></label>
                  <label>{text.labels.overtimeHours}<input min={0} step="0.25" type="number" value={attendanceLogForm.overtime_minutes} onChange={(event) => setAttendanceLogForm({ ...attendanceLogForm, overtime_minutes: event.target.value })} /></label>
                  <label>{text.labels.nightHours}<input min={0} step="0.25" type="number" value={attendanceLogForm.night_minutes} onChange={(event) => setAttendanceLogForm({ ...attendanceLogForm, night_minutes: event.target.value })} /></label>
                  <label>{text.labels.holidayHours}<input min={0} step="0.25" type="number" value={attendanceLogForm.holiday_minutes} onChange={(event) => setAttendanceLogForm({ ...attendanceLogForm, holiday_minutes: event.target.value })} /></label>
                  <label className="full">{text.labels.managerNote}<textarea value={attendanceLogForm.manager_note} onChange={(event) => setAttendanceLogForm({ ...attendanceLogForm, manager_note: event.target.value })} /></label>
                </div>
                <button className="primary" type="button" disabled={saving || !(attendanceLogForm.staff_profile_id || firstStaffProfileId)} onClick={saveAttendanceLog}>
                  <ButtonIconText icon={<Save aria-hidden="true" size={15} />}>{text.actions.saveAttendance}</ButtonIconText>
                </button>
              </fieldset>
            </div>
          )}

          {currentAttendanceTab === 'timesheet' && (
            <div className="staff-table-wrap">
              <table className="staff-table staff-attendance-table">
                <thead>
                  <tr>
                    <th>{text.labels.staffMember}</th>
                    <th>{text.labels.date}</th>
                    <th>{text.labels.status}</th>
                    <th>{text.labels.workedHours}</th>
                    <th>{text.labels.regularHours}</th>
                    <th>{text.labels.overtimeHours}</th>
                    <th>{text.labels.nightHours}</th>
                    <th>{text.labels.holidayHours}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAttendanceLogs.map((log) => {
                    const staffProfile = profileById.get(log.staff_profile_id)
                    return (
                      <tr key={log.id}>
                        <td>{staffProfile ? customerName(staffProfile, text) : text.customerFallback}</td>
                        <td>{staffDateLabel(log.work_date)}</td>
                        <td>{text.attendanceStatuses[log.status]}</td>
                        <td>{hoursLabel(minutesBetween(log.clock_in_at, log.clock_out_at, log.break_minutes))}</td>
                        <td>{hoursLabel(log.regular_minutes)}</td>
                        <td>{hoursLabel(log.overtime_minutes)}</td>
                        <td>{hoursLabel(log.night_minutes)}</td>
                        <td>{hoursLabel(log.holiday_minutes)}</td>
                      </tr>
                    )
                  })}
                  {visibleAttendanceLogs.length === 0 && (
                    <tr>
                      <td colSpan={8}>{text.messages.noAttendanceLogs}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {currentAttendanceTab === 'leave' && (
            <div className="staff-attendance-layout">
              <div className="staff-attendance-list">
                {visibleLeaveRequests.map((leave) => {
                  const staffProfile = profileById.get(leave.staff_profile_id)
                  return (
                    <article className="staff-attendance-row" key={leave.id}>
                      <div className="staff-attendance-person">
                        {staffProfile && <StaffRoleAvatar profile={staffProfile} text={text} />}
                        <div>
                          <strong>{staffProfile ? customerName(staffProfile, text) : text.customerFallback}</strong>
                          <span>{staffDateLabel(leave.start_date)} - {staffDateLabel(leave.end_date)}</span>
                        </div>
                      </div>
                      <div className="staff-attendance-meta">
                        <span>{text.leaveTypes[leave.leave_type]}</span>
                        <span>{leave.hours}h</span>
                        <span>{text.leaveStatuses[leave.status]}</span>
                        {leave.reason && <span>{leave.reason}</span>}
                      </div>
                      <div className="staff-row-actions staff-attendance-row-actions">
                        {canEditAttendance && (
                          <button type="button" onClick={() => editLeaveRequest(leave)}>
                            <ButtonIconText icon={<Pencil aria-hidden="true" size={14} />}>{text.actions.edit}</ButtonIconText>
                          </button>
                        )}
                        {canManageAttendance && leave.status === 'requested' && (
                          <button type="button" onClick={() => updateLeaveStatus(leave, 'approved')}>
                            <ButtonIconText icon={<Check aria-hidden="true" size={14} />}>{text.actions.approve}</ButtonIconText>
                          </button>
                        )}
                        {canManageAttendance && leave.status === 'requested' && (
                          <button type="button" onClick={() => updateLeaveStatus(leave, 'rejected')}>
                            <ButtonIconText icon={<X aria-hidden="true" size={14} />}>{text.actions.reject}</ButtonIconText>
                          </button>
                        )}
                        {canEditAttendance && leave.status !== 'cancelled' && (
                          <button type="button" onClick={() => updateLeaveStatus(leave, 'cancelled')}>
                            <ButtonIconText icon={<Ban aria-hidden="true" size={14} />}>{text.actions.cancel}</ButtonIconText>
                          </button>
                        )}
                      </div>
                    </article>
                  )
                })}
                {visibleLeaveRequests.length === 0 && <p className="notice">{text.messages.noLeaveRequests}</p>}
              </div>

              <fieldset className="staff-readonly-fieldset staff-attendance-form" disabled={!canEditAttendance}>
                <h4>{text.attendanceTabs.leave}</h4>
                <div className="form-grid compact-form-grid">
                  <label>
                    {text.labels.staffMember}
                    <select value={leaveForm.staff_profile_id || firstStaffProfileId} onChange={(event) => setLeaveForm({ ...leaveForm, staff_profile_id: event.target.value })}>
                      {visibleStaffProfileOptions.map((item) => <option key={item.id} value={item.id}>{customerName(item, text)}</option>)}
                    </select>
                  </label>
                  <label>{text.labels.leaveType}<select value={leaveForm.leave_type} onChange={(event) => setLeaveForm({ ...leaveForm, leave_type: event.target.value as StaffLeaveType })}>{staffLeaveTypes.map((type) => <option key={type} value={type}>{text.leaveTypes[type]}</option>)}</select></label>
                  <label>
                    {text.labels.startDate}
                    <StaffPickerField ariaLabel={text.aria.leaveStart} placeholder={text.chooseDate} type="date" value={leaveForm.start_date} onChange={(value) => setLeaveForm({ ...leaveForm, start_date: value })} />
                  </label>
                  <label>
                    {text.labels.endDate}
                    <StaffPickerField ariaLabel={text.aria.leaveEnd} placeholder={text.chooseDate} type="date" value={leaveForm.end_date} onChange={(value) => setLeaveForm({ ...leaveForm, end_date: value })} />
                  </label>
                  <label>{text.labels.hours}<input min={0} step="0.5" type="number" value={leaveForm.hours} onChange={(event) => setLeaveForm({ ...leaveForm, hours: event.target.value })} /></label>
                  <label className="full">{text.labels.deleteReason}<textarea value={leaveForm.reason} onChange={(event) => setLeaveForm({ ...leaveForm, reason: event.target.value })} /></label>
                </div>
                <button className="primary" type="button" disabled={saving || !(leaveForm.staff_profile_id || firstStaffProfileId)} onClick={submitLeaveRequest}>{text.actions.submitLeave}</button>
              </fieldset>
            </div>
          )}

          {currentAttendanceTab === 'settings' && (
            <fieldset className="staff-readonly-fieldset staff-attendance-form staff-attendance-settings" disabled={!canManageAttendance}>
              <h4>{text.attendanceTabs.settings}</h4>
              <div className="form-grid compact-form-grid">
                <label>{text.labels.location}<input value={attendanceSettings.location} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, location: event.target.value })} /></label>
                <div className="staff-duration-field">
                  <span className="staff-label-line">
                    <span>{text.labels.standardDay}</span>
                    <small>{text.labels.standardDayHelp}</small>
                  </span>
                  <StaffPickerField
                    ariaLabel={text.labels.standardDay}
                    mode="duration"
                    placeholder="08:00"
                    type="time"
                    value={durationTimeValue(attendanceSettings.standard_daily_minutes)}
                    onChange={(value) => setAttendanceSettings({ ...attendanceSettings, standard_daily_minutes: parseMinutesTime(value) })}
                  />
                  <span className="staff-duration-presets" aria-label={text.labels.standardDayPresets}>
                    {['07:15', '08:00', '08:30'].map((preset) => (
                      <button
                        className={durationTimeValue(attendanceSettings.standard_daily_minutes) === preset ? 'active' : ''}
                        key={preset}
                        type="button"
                        onClick={() => setAttendanceSettings({ ...attendanceSettings, standard_daily_minutes: parseMinutesTime(preset) })}
                      >
                        {preset}
                      </button>
                    ))}
                  </span>
                </div>
                <label>{text.labels.standardWeek}<input min={0} step="0.25" type="number" value={attendanceSettings.standard_weekly_minutes / 60} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, standard_weekly_minutes: Math.round((Number(event.target.value) || 0) * 60) })} /></label>
                <label>{text.labels.standardBreakMinutes}<input min={0} step="1" type="number" value={attendanceSettings.standard_break_minutes} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, standard_break_minutes: Math.max(0, Math.round(Number(event.target.value) || 0)) })} /></label>
                <label>{text.labels.overtimeMonthlyCap}<input min={0} step="0.25" type="number" value={attendanceSettings.overtime_monthly_cap_minutes / 60} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, overtime_monthly_cap_minutes: Math.round((Number(event.target.value) || 0) * 60) })} /></label>
                <label>{text.labels.overtimeYearlyCap}<input min={0} step="0.25" type="number" value={attendanceSettings.overtime_yearly_cap_minutes / 60} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, overtime_yearly_cap_minutes: Math.round((Number(event.target.value) || 0) * 60) })} /></label>
                <label>
                  {text.aria.nightStart}
                  <StaffPickerField ariaLabel={text.aria.nightStart} placeholder={text.chooseTime} type="time" value={normalizeTime(attendanceSettings.night_start)} onChange={(value) => setAttendanceSettings({ ...attendanceSettings, night_start: value })} />
                </label>
                <label>
                  {text.aria.nightEnd}
                  <StaffPickerField ariaLabel={text.aria.nightEnd} placeholder={text.chooseTime} type="time" value={normalizeTime(attendanceSettings.night_end)} onChange={(value) => setAttendanceSettings({ ...attendanceSettings, night_end: value })} />
                </label>
                <label>{text.labels.annualLeaveDays}<input min={0} step="0.5" type="number" value={attendanceSettings.annual_leave_days} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, annual_leave_days: Number(event.target.value) || 0 })} /></label>
              </div>
              <div className="staff-standard-shifts">
                <strong>{text.labels.standardShiftTemplates}</strong>
                {effectiveShiftTemplates.map((template) => (
                  <div className="staff-standard-shift-row" key={template.id}>
                    <strong>{text.shiftTemplates[template.id]}</strong>
                    <label>
                      {text.labels.start}
                      <StaffPickerField
                        ariaLabel={`${text.shiftTemplates[template.id]} ${text.labels.start}`}
                        placeholder={text.chooseTime}
                        type="time"
                        value={template.start_time}
                        onChange={(value) => updateAttendanceShiftTemplate(template.id, { start_time: value })}
                      />
                    </label>
                    <label>
                      {text.labels.end}
                      <StaffPickerField
                        ariaLabel={`${text.shiftTemplates[template.id]} ${text.labels.end}`}
                        placeholder={text.chooseTime}
                        type="time"
                        value={template.end_time}
                        onChange={(value) => updateAttendanceShiftTemplate(template.id, { end_time: value })}
                      />
                    </label>
                    <label>{text.labels.breakMinutes}<input min={0} step="1" type="number" value={template.break_minutes} onChange={(event) => updateAttendanceShiftTemplate(template.id, { break_minutes: event.target.value })} /></label>
                  </div>
                ))}
              </div>
              <button className="primary" type="button" disabled={saving} onClick={saveAttendanceSettings}>
                <ButtonIconText icon={<Save aria-hidden="true" size={15} />}>{text.actions.saveRules}</ButtonIconText>
              </button>
            </fieldset>
          )}
        </>
      )}
    </div>
  )
}
