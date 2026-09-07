'use client'

import {
  Ban,
  CalendarCheck2,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Pencil,
  Plus,
  Save,
  Send,
  UserRound
} from 'lucide-react'
import { Fragment } from 'react'
import { ButtonIconText } from '../../components/BookingWidgetUi'
import { StaffPickerField } from '../../components/staff/StaffPickerField'
import { StaffRoleAvatar } from '../../components/staff/StaffRoleAvatar'
import { dateFromInput, normalizeTime, shortDateLabel, staffDateLabel } from '../../lib/staff/dates'
import type { StaffHrModel } from '../../lib/staff/hrModel'
import {
  staffShiftStatuses
} from '../../lib/staff/options'
import { customerName } from '../../lib/staff/profiles'
import type {
  StaffScheduleShift,
  StaffShiftTemplateId
} from '../../lib/staff/types'
import { StaffScheduleViewMode, staffScheduleCopy } from './presentation'

export type ScheduleSectionProps = {
  text: StaffHrModel['shared']['text']
  shiftAttendanceRange: StaffHrModel['schedule']['shiftAttendanceRange']
  attendanceWeekDates: StaffHrModel['schedule']['attendanceWeekDates']
  scheduleCopy: (typeof staffScheduleCopy)["en" | "vi"]
  attendanceWeekStart: StaffHrModel['schedule']['attendanceWeekStart']
  attendanceWeekEnd: StaffHrModel['schedule']['attendanceWeekEnd']
  resetAttendanceRangeToThisWeek: StaffHrModel['schedule']['resetAttendanceRangeToThisWeek']
  setAttendanceRange: StaffHrModel['schedule']['setAttendanceRange']
  scheduleViewMode: StaffScheduleViewMode
  weekScheduleShifts: import("../../lib/staff/types").StaffScheduleShift[]
  scheduledEmployeeIds: Set<string>
  visibleScheduleStaffProfileOptions: StaffHrModel['schedule']['visibleScheduleStaffProfileOptions']
  weekDraftCount: number
  setScheduleViewMode: React.Dispatch<React.SetStateAction<StaffScheduleViewMode>>
  attendanceScheduleScopeOptions: StaffHrModel['schedule']['attendanceScheduleScopeOptions']
  effectiveAttendanceScheduleScope: StaffHrModel['schedule']['effectiveAttendanceScheduleScope']
  setAttendanceScheduleScope: StaffHrModel['schedule']['setAttendanceScheduleScope']
  selectedShiftTemplate: StaffHrModel['schedule']['selectedShiftTemplate']
  applyShiftTemplate: StaffHrModel['schedule']['applyShiftTemplate']
  canManageAttendance: StaffHrModel['access']['canManageAttendance']
  effectiveShiftTemplates: StaffHrModel['schedule']['effectiveShiftTemplates']
  copyPreviousAttendanceWeek: StaffHrModel['schedule']['copyPreviousAttendanceWeek']
  saving: StaffHrModel['shared']['saving']
  publishAttendanceWeek: StaffHrModel['schedule']['publishAttendanceWeek']
  draftShiftCount: StaffHrModel['schedule']['draftShiftCount']
  scheduleGridStyle: { gridTemplateColumns: string; minWidth: string }
  employeeProfileById: StaffHrModel['employees']['employeeProfileById']
  attendanceShiftsByCell: StaffHrModel['schedule']['attendanceShiftsByCell']
  visibleScheduleAttendanceShifts: StaffHrModel['schedule']['visibleScheduleAttendanceShifts']
  draggingShiftId: StaffHrModel['schedule']['draggingShiftId']
  moveShiftToCell: StaffHrModel['schedule']['moveShiftToCell']
  setDraggingShiftId: StaffHrModel['schedule']['setDraggingShiftId']
  startShiftForCell: StaffHrModel['schedule']['startShiftForCell']
  shiftWarningsById: StaffHrModel['schedule']['shiftWarningsById']
  editShift: StaffHrModel['schedule']['editShift']
  scheduleShiftRows: { id: string; label: string; template: import("../../lib/staff/types").StaffShiftTemplate | null; shiftsByDate: Map<string, import("../../lib/staff/types").StaffScheduleShift[]>; subtitle: string }[]
  prepareShiftEditor: (template: import("../../lib/staff/types").StaffShiftTemplate | null, shiftDate: string) => void
  profileById: StaffHrModel['payroll']['profileById']
  staffPayrollCalculations: StaffHrModel['payroll']['staffPayrollCalculations']
  updateShiftStatus: StaffHrModel['schedule']['updateShiftStatus']
  shiftForm: StaffHrModel['schedule']['shiftForm']
  firstScheduleStaffProfileId: StaffHrModel['schedule']['firstScheduleStaffProfileId']
  setShiftForm: StaffHrModel['schedule']['setShiftForm']
  hrLocationOptions: StaffHrModel['settings']['hrLocationOptions']
  saveShift: StaffHrModel['schedule']['saveShift']
}

export default function ScheduleSection({
  text,
  shiftAttendanceRange,
  attendanceWeekDates,
  scheduleCopy,
  attendanceWeekStart,
  attendanceWeekEnd,
  resetAttendanceRangeToThisWeek,
  setAttendanceRange,
  scheduleViewMode,
  weekScheduleShifts,
  scheduledEmployeeIds,
  visibleScheduleStaffProfileOptions,
  weekDraftCount,
  setScheduleViewMode,
  attendanceScheduleScopeOptions,
  effectiveAttendanceScheduleScope,
  setAttendanceScheduleScope,
  selectedShiftTemplate,
  applyShiftTemplate,
  canManageAttendance,
  effectiveShiftTemplates,
  copyPreviousAttendanceWeek,
  saving,
  publishAttendanceWeek,
  draftShiftCount,
  scheduleGridStyle,
  employeeProfileById,
  attendanceShiftsByCell,
  visibleScheduleAttendanceShifts,
  draggingShiftId,
  moveShiftToCell,
  setDraggingShiftId,
  startShiftForCell,
  shiftWarningsById,
  editShift,
  scheduleShiftRows,
  prepareShiftEditor,
  profileById,
  staffPayrollCalculations,
  updateShiftStatus,
  shiftForm,
  firstScheduleStaffProfileId,
  setShiftForm,
  hrLocationOptions,
  saveShift,
}: ScheduleSectionProps) {
  return (
    <div className="staff-hr-schedule-stack">
      <div className="staff-hr-week-controls">
        <div className="staff-hr-week-navigation">
          <button aria-label={text.actions.previousWeek} title={text.actions.previousWeek} type="button" onClick={() => shiftAttendanceRange(-attendanceWeekDates.length)}>
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
          <div className="staff-hr-week-label">
            <span>{scheduleCopy.week}</span>
            <strong>{shortDateLabel(attendanceWeekStart)} – {shortDateLabel(attendanceWeekEnd)}</strong>
          </div>
          <button aria-label={text.actions.nextWeek} title={text.actions.nextWeek} type="button" onClick={() => shiftAttendanceRange(attendanceWeekDates.length)}>
            <ChevronRight aria-hidden="true" size={18} />
          </button>
          <button className="staff-hr-today-button" type="button" onClick={resetAttendanceRangeToThisWeek}>
            <ButtonIconText icon={<CalendarDays aria-hidden="true" size={15} />}>{text.actions.today}</ButtonIconText>
          </button>
        </div>
        <div className="staff-hr-week-date-fields">
          <label>
            <span className="staff-field-label">{text.labels.startDate}</span>
            <StaffPickerField
              ariaLabel={text.labels.startDate}
              placeholder={text.chooseDate}
              type="date"
              value={attendanceWeekStart}
              onChange={(value: string) => setAttendanceRange(value, attendanceWeekEnd)}
            />
          </label>
          <label>
            <span className="staff-field-label">{text.labels.endDate}</span>
            <StaffPickerField
              ariaLabel={text.labels.endDate}
              placeholder={text.chooseDate}
              type="date"
              value={attendanceWeekEnd}
              onChange={(value: string) => setAttendanceRange(attendanceWeekStart, value)}
            />
          </label>
        </div>
      </div>
      <section className="staff-planning-panel staff-hr-planning-panel" aria-label={text.labels.weeklySchedule}>
        <header className="staff-hr-planner-head">
          <div className="staff-planning-title">
            <strong>{text.labels.weeklySchedule}</strong>
            <span>{scheduleViewMode === 'employee' ? scheduleCopy.byEmployeeHelp : scheduleCopy.byShiftHelp}</span>
          </div>
          <div className="staff-schedule-summary" aria-label={text.labels.weeklySchedule}>
            <span><strong>{weekScheduleShifts.length}</strong>{scheduleCopy.scheduledShifts}</span>
            <span><strong>{scheduledEmployeeIds.size}/{visibleScheduleStaffProfileOptions.length}</strong>{scheduleCopy.scheduledEmployees}</span>
            <span><strong>{weekDraftCount}</strong>{scheduleCopy.drafts}</span>
          </div>
        </header>

        <div className="staff-hr-planner-commandbar">
          <div className="staff-schedule-view-toggle" role="group" aria-label={scheduleCopy.viewScheduleBy}>
            <button className={scheduleViewMode === 'employee' ? 'active' : ''} type="button" aria-pressed={scheduleViewMode === 'employee'} onClick={() => setScheduleViewMode('employee')}>
              <UserRound aria-hidden="true" size={16} />
              {scheduleCopy.byEmployee}
            </button>
            <button className={scheduleViewMode === 'shift' ? 'active' : ''} type="button" aria-pressed={scheduleViewMode === 'shift'} onClick={() => setScheduleViewMode('shift')}>
              <CalendarCheck2 aria-hidden="true" size={16} />
              {scheduleCopy.byShift}
            </button>
          </div>
          <div className="staff-planning-scope" role="group" aria-label={text.labels.scheduleScope}>
            {attendanceScheduleScopeOptions.map((scope) => (
              <button
                className={effectiveAttendanceScheduleScope === scope ? 'active' : ''}
                key={scope}
                type="button"
                onClick={() => setAttendanceScheduleScope(scope)}
              >
                {text.scheduleScopes[scope]}
              </button>
            ))}
          </div>
          <label className="staff-hr-shift-template-field">
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

        {!canManageAttendance && <p className="staff-readonly-note">{text.messages.attendanceReadOnly}</p>}

        {visibleScheduleStaffProfileOptions.length > 0 ? (
          <div className="staff-planning-grid-shell">
            <div className={`staff-planning-grid staff-planning-grid-${scheduleViewMode}`} role="grid" aria-label={text.labels.weeklySchedule} style={scheduleGridStyle}>
              <div className="staff-planning-corner" role="columnheader">{scheduleViewMode === 'employee' ? text.labels.staffMember : text.labels.shiftTemplate}</div>
              {attendanceWeekDates.map((dateValue: string) => (
                <div className={`staff-planning-day ${[0, 6].includes(dateFromInput(dateValue).getDay()) ? 'is-weekend' : ''}`} role="columnheader" key={dateValue}>
                  <strong>{shortDateLabel(dateValue)}</strong>
                  <span>{text.reportWeekdays[(dateFromInput(dateValue).getDay() + 6) % 7]}</span>
                </div>
              ))}
              {scheduleViewMode === 'employee' && visibleScheduleStaffProfileOptions.map((staffProfile) => {
                const employee = employeeProfileById.get(staffProfile.id)
                const isInactiveEmployee = employee?.active === false
                return (
                  <Fragment key={staffProfile.id}>
                    <div className={`staff-planning-staff ${isInactiveEmployee ? 'inactive' : ''}`} role="rowheader">
                      <StaffRoleAvatar profile={staffProfile} text={text} />
                      <span>
                        <strong>{customerName(staffProfile, text)}</strong>
                        <small>{employee?.department || text.labels.staffMember}{isInactiveEmployee ? ` · ${text.labels.inactiveEmployee}` : ''}</small>
                      </span>
                    </div>
                    {attendanceWeekDates.map((dateValue: string) => {
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
                            const shift = visibleScheduleAttendanceShifts.find((item) => item.id === draggingShiftId)
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
                              <Plus aria-hidden="true" size={14} />
                              <span>{scheduleCopy.add}</span>
                            </button>
                          )}
                          {cellShifts.map((shift) => {
                            const warnings = shiftWarningsById.get(shift.id) || []
                            return (
                              <button
                                className={`staff-shift-chip ${warnings.length > 0 ? 'has-warning' : ''}`}
                                disabled={!canManageAttendance}
                                draggable={canManageAttendance}
                                key={shift.id}
                                type="button"
                                onClick={() => {
                                  if (canManageAttendance) editShift(shift)
                                }}
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
              {scheduleViewMode === 'shift' && scheduleShiftRows.map((row) => (
                <Fragment key={row.id}>
                  <div className="staff-planning-staff staff-planning-shift-row-head" role="rowheader">
                    <span className="staff-planning-shift-icon"><CalendarCheck2 aria-hidden="true" size={17} /></span>
                    <span>
                      <strong>{row.label}</strong>
                      <small>{row.subtitle}</small>
                    </span>
                  </div>
                  {attendanceWeekDates.map((dateValue: string) => {
                    const cellShifts = row.shiftsByDate.get(dateValue) || []
                    return (
                      <div className="staff-planning-cell staff-planning-shift-cell" key={`${row.id}:${dateValue}`} role="gridcell">
                        {canManageAttendance && row.template && (
                          <button
                            aria-label={`${scheduleCopy.addShift}: ${row.label} ${shortDateLabel(dateValue)}`}
                            className="staff-planning-cell-button"
                            disabled={saving}
                            type="button"
                            onClick={() => prepareShiftEditor(row.template, dateValue)}
                          >
                            <Plus aria-hidden="true" size={14} />
                            <span>{scheduleCopy.add}</span>
                          </button>
                        )}
                        {cellShifts.map((shift) => {
                          const staffProfile = profileById.get(shift.staff_profile_id)
                          const warnings = shiftWarningsById.get(shift.id) || []
                          return (
                            <button
                              className={`staff-shift-chip ${warnings.length > 0 ? 'has-warning' : ''}`}
                              disabled={!canManageAttendance}
                              key={shift.id}
                              type="button"
                              onClick={() => {
                                if (canManageAttendance) editShift(shift)
                              }}
                            >
                              <strong>{staffProfile ? customerName(staffProfile, text) : text.customerFallback}</strong>
                              <small>{row.template ? text.shiftStatuses[shift.status] : `${normalizeTime(shift.start_time)}–${normalizeTime(shift.end_time)}`}</small>
                              {warnings.length > 0 && <em>{warnings[0]}</em>}
                            </button>
                          )
                        })}
                      </div>
                    )
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        ) : (
          <p className="notice">{text.messages.noStaffProfiles}</p>
        )}
      </section>

      <div className="staff-attendance-layout staff-hr-schedule-layout">
        <div className="staff-attendance-list">
          <div className="staff-hr-panel-head">
            <div>
              <h4>{text.labels.shiftList}</h4>
              <p className="staff-helper-text">{text.labels.attendanceSchedule}</p>
            </div>
            <strong>{visibleScheduleAttendanceShifts.length}</strong>
          </div>
          {visibleScheduleAttendanceShifts.map((shift) => {
            const staffProfile = profileById.get(shift.staff_profile_id)
            const warnings = shiftWarningsById.get(shift.id) || []
            const payrollWarnings = staffPayrollCalculations.get(shift.staff_profile_id)?.restWarningCount || 0
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
                  {[...warnings, payrollWarnings > 0 ? `${text.labels.restWarnings}: ${payrollWarnings}` : ''].filter(Boolean).map((warning: string) => <span className="staff-warning-text" key={warning}>{warning}</span>)}
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
          {visibleScheduleAttendanceShifts.length === 0 && <p className="notice">{text.messages.noShifts}</p>}
        </div>

        {canManageAttendance && (
          <fieldset className="staff-readonly-fieldset staff-attendance-form" disabled={!canManageAttendance} id="staff-hr-shift-editor">
            <div className="staff-hr-shift-editor-head">
              <h4>{scheduleCopy.shiftEditor}</h4>
              <p className="staff-helper-text">{scheduleCopy.shiftEditorHelp}</p>
            </div>
            <div className="form-grid compact-form-grid">
              <label>
                {text.labels.staffMember}
                <select value={shiftForm.staff_profile_id || firstScheduleStaffProfileId} onChange={(event) => setShiftForm({ ...shiftForm, staff_profile_id: event.target.value })}>
                  {visibleScheduleStaffProfileOptions.map((item) => <option key={item.id} value={item.id}>{customerName(item, text)}</option>)}
                </select>
              </label>
              <label>
                {text.labels.shiftDate}
                <StaffPickerField ariaLabel={text.labels.shiftDate} placeholder={text.chooseDate} type="date" value={shiftForm.shift_date} onChange={(value: string) => setShiftForm({ ...shiftForm, shift_date: value })} />
              </label>
              <label>
                {text.labels.start}
                <StaffPickerField ariaLabel={text.labels.start} placeholder={text.chooseTime} type="time" value={shiftForm.start_time} onChange={(value: string) => setShiftForm({ ...shiftForm, start_time: value })} />
              </label>
              <label>
                {text.labels.end}
                <StaffPickerField ariaLabel={text.labels.end} placeholder={text.chooseTime} type="time" value={shiftForm.end_time} onChange={(value: string) => setShiftForm({ ...shiftForm, end_time: value })} />
              </label>
              <label>{text.labels.breakMinutes}<input min={0} type="number" value={shiftForm.break_minutes} onChange={(event) => setShiftForm({ ...shiftForm, break_minutes: event.target.value })} /></label>
              <label>{text.labels.location}<select value={shiftForm.location} onChange={(event) => setShiftForm({ ...shiftForm, location: event.target.value })}>{shiftForm.location && !hrLocationOptions.some((option) => option.name === shiftForm.location) && <option value={shiftForm.location}>{shiftForm.location}</option>}{hrLocationOptions.map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}</select></label>
              <label>{text.labels.status}<select value={shiftForm.status} onChange={(event) => setShiftForm({ ...shiftForm, status: event.target.value as StaffScheduleShift['status'] })}>{staffShiftStatuses.map((status) => <option key={status} value={status}>{text.shiftStatuses[status]}</option>)}</select></label>
              <label className="full">{text.labels.notes}<textarea value={shiftForm.notes} onChange={(event) => setShiftForm({ ...shiftForm, notes: event.target.value })} /></label>
            </div>
            <button className="primary" type="button" disabled={saving || !(shiftForm.staff_profile_id || firstScheduleStaffProfileId)} onClick={saveShift}>
              <ButtonIconText icon={<Save aria-hidden="true" size={15} />}>{text.actions.saveShift}</ButtonIconText>
            </button>
          </fieldset>
        )}
      </div>
    </div>
  )
}
