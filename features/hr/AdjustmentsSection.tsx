'use client'

import {
  Check,
  Save,
  X
} from 'lucide-react'
import { ButtonIconText } from '../../components/BookingWidgetUi'
import { StaffPickerField } from '../../components/staff/StaffPickerField'
import { StaffRoleAvatar } from '../../components/staff/StaffRoleAvatar'
import { staffDateLabel } from '../../lib/staff/dates'
import { dongDigits, formatDongInput, formatVnd, parseDong } from '../../lib/staff/formatting'
import type { StaffHrModel } from '../../lib/staff/hrModel'
import { normalizeHrAdjustmentStatus, normalizeHrAdjustmentType } from '../../lib/staff/hrSettings'
import {
  staffHrAdjustmentStatuses,
  staffHrAdjustmentTypes
} from '../../lib/staff/options'
import { customerName } from '../../lib/staff/profiles'

export type AdjustmentsSectionProps = {
  canManageAttendance: StaffHrModel['access']['canManageAttendance']
  hrTab: StaffHrModel['shared']['hrTab']
  text: StaffHrModel['shared']['text']
  hrAdjustmentForm: StaffHrModel['payroll']['hrAdjustmentForm']
  selectedEmployeeStaffId: StaffHrModel['employees']['selectedEmployeeStaffId']
  firstEmployeeStaffProfileId: StaffHrModel['employees']['firstEmployeeStaffProfileId']
  setHrAdjustmentForm: StaffHrModel['payroll']['setHrAdjustmentForm']
  visibleAllStaffProfileOptions: StaffHrModel['employees']['visibleAllStaffProfileOptions']
  saving: StaffHrModel['shared']['saving']
  saveHrAdjustment: StaffHrModel['payroll']['saveHrAdjustment']
  periodHrAdjustments: StaffHrModel['payroll']['periodHrAdjustments']
  profileById: StaffHrModel['payroll']['profileById']
  updateHrAdjustmentStatus: StaffHrModel['payroll']['updateHrAdjustmentStatus']
}

export default function AdjustmentsSection({
  canManageAttendance,
  hrTab,
  text,
  hrAdjustmentForm,
  selectedEmployeeStaffId,
  firstEmployeeStaffProfileId,
  setHrAdjustmentForm,
  visibleAllStaffProfileOptions,
  saving,
  saveHrAdjustment,
  periodHrAdjustments,
  profileById,
  updateHrAdjustmentStatus,
}: AdjustmentsSectionProps) {
  return (
    <div className="staff-attendance-layout">
      <fieldset className="staff-readonly-fieldset staff-attendance-form" disabled={!canManageAttendance}>
        <h4>{hrTab === 'advances' ? text.hrTabs.advances : text.hrTabs.adjustments}</h4>
        <div className="form-grid compact-form-grid">
          <label>{text.labels.staffMember}<select value={hrAdjustmentForm.profile_id || selectedEmployeeStaffId || firstEmployeeStaffProfileId} onChange={(event) => setHrAdjustmentForm({ ...hrAdjustmentForm, profile_id: event.target.value })}>{visibleAllStaffProfileOptions.map((item) => <option key={item.id} value={item.id}>{customerName(item, text)}</option>)}</select></label>
          <label>{text.labels.type}<select value={hrAdjustmentForm.adjustment_type} onChange={(event) => setHrAdjustmentForm({ ...hrAdjustmentForm, adjustment_type: normalizeHrAdjustmentType(event.target.value) })}>{staffHrAdjustmentTypes.filter((type) => hrTab === 'advances' ? ['advance', 'debt', 'debt_repayment'].includes(type) : !['advance', 'debt', 'debt_repayment'].includes(type)).map((type) => <option key={type} value={type}>{text.adjustmentTypes[type]}</option>)}</select></label>
          <label>{text.labels.name}<input value={hrAdjustmentForm.title} onChange={(event) => setHrAdjustmentForm({ ...hrAdjustmentForm, title: event.target.value })} /></label>
          <label>{text.vndAmount}<input inputMode="numeric" value={formatDongInput(hrAdjustmentForm.amount_vnd)} onChange={(event) => setHrAdjustmentForm({ ...hrAdjustmentForm, amount_vnd: dongDigits(event.target.value) })} /></label>
          <label>{text.labels.date}<StaffPickerField ariaLabel={text.labels.date} placeholder={text.chooseDate} type="date" value={hrAdjustmentForm.effective_date} onChange={(value: string) => setHrAdjustmentForm({ ...hrAdjustmentForm, effective_date: value })} /></label>
          <label>{text.labels.status}<select value={hrAdjustmentForm.status} onChange={(event) => setHrAdjustmentForm({ ...hrAdjustmentForm, status: normalizeHrAdjustmentStatus(event.target.value) })}>{staffHrAdjustmentStatuses.map((statusValue) => <option key={statusValue} value={statusValue}>{text.adjustmentStatuses[statusValue]}</option>)}</select></label>
          <label className="full">{text.labels.notes}<textarea value={hrAdjustmentForm.notes} onChange={(event) => setHrAdjustmentForm({ ...hrAdjustmentForm, notes: event.target.value })} /></label>
        </div>
        <button className="primary" type="button" disabled={saving || parseDong(hrAdjustmentForm.amount_vnd) <= 0} onClick={() => saveHrAdjustment(hrTab === 'advances' ? 'advance' : 'adjustment')}>
          <ButtonIconText icon={<Save aria-hidden="true" size={15} />}>{text.actions.saveAdjustment}</ButtonIconText>
        </button>
      </fieldset>
      <div className="staff-attendance-list">
        {periodHrAdjustments.filter((item) => hrTab === 'advances' ? ['advance', 'debt', 'debt_repayment'].includes(item.adjustment_type) : !['advance', 'debt', 'debt_repayment'].includes(item.adjustment_type)).map((adjustment) => {
          const staffProfile = profileById.get(adjustment.profile_id)
          return (
            <article className="staff-attendance-row" key={adjustment.id}>
              <div className="staff-attendance-person">
                {staffProfile && <StaffRoleAvatar profile={staffProfile} text={text} />}
                <div>
                  <strong>{adjustment.title || text.adjustmentTypes[adjustment.adjustment_type]}</strong>
                  <span>{staffProfile ? customerName(staffProfile, text) : text.customerFallback} · {staffDateLabel(adjustment.effective_date)}</span>
                </div>
              </div>
              <div className="staff-attendance-meta">
                <span>{text.adjustmentTypes[adjustment.adjustment_type]}</span>
                <span>{formatVnd(adjustment.amount_vnd)}</span>
                <span>{text.adjustmentStatuses[adjustment.status]}</span>
              </div>
              <div className="staff-row-actions staff-attendance-row-actions">
                {canManageAttendance && adjustment.status === 'pending' && (
                  <button type="button" onClick={() => updateHrAdjustmentStatus(adjustment, 'approved')}>
                    <ButtonIconText icon={<Check aria-hidden="true" size={14} />}>{text.actions.approve}</ButtonIconText>
                  </button>
                )}
                {canManageAttendance && adjustment.status === 'pending' && (
                  <button type="button" onClick={() => updateHrAdjustmentStatus(adjustment, 'rejected')}>
                    <ButtonIconText icon={<X aria-hidden="true" size={14} />}>{text.actions.reject}</ButtonIconText>
                  </button>
                )}
              </div>
            </article>
          )
        })}
        {periodHrAdjustments.length === 0 && <p className="notice">{text.messages.noAdjustments}</p>}
      </div>
    </div>
  )
}
