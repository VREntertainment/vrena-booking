'use client'

import {
  Check,
  CircleCheckBig,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  X
} from 'lucide-react'
import { StaffPickerField } from '../../components/staff/StaffPickerField'
import { dongDigits, formatDongInput, parseDong } from '../../lib/staff/formatting'
import type { StaffHrModel } from '../../lib/staff/hrModel'
import { HrSettingsSection, hrCompletionCopy } from './presentation'

export type SettingsSectionProps = {
  completionText: (typeof hrCompletionCopy)["en" | "vi"]
  text: StaffHrModel['shared']['text']
  settingsSections: { id: HrSettingsSection; icon: React.ForwardRefExoticComponent<Omit<import("lucide-react").LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>> }[]
  settingsSection: HrSettingsSection
  setSettingsSection: React.Dispatch<React.SetStateAction<HrSettingsSection>>
  initializationRows: readonly [{ readonly id: "employees"; readonly complete: boolean; readonly meta: `${number}/${number}`; readonly open: () => void }, { readonly id: "shifts"; readonly complete: boolean; readonly meta: string; readonly open: () => void }, { readonly id: "schedule"; readonly complete: boolean; readonly meta: `${number}/${number}`; readonly open: () => void }, { readonly id: "attendance"; readonly complete: boolean; readonly meta: string; readonly open: () => void }, { readonly id: "salary"; readonly complete: boolean; readonly meta: `${number}/${number}`; readonly open: () => void }, { readonly id: "payroll"; readonly complete: boolean; readonly meta: string; readonly open: () => void }]
  canManageAttendance: StaffHrModel['access']['canManageAttendance']
  setHrTab: StaffHrModel['shared']['setHrTab']
  effectiveShiftTemplates: StaffHrModel['schedule']['effectiveShiftTemplates']
  attendanceSettings: StaffHrModel['schedule']['attendanceSettings']
  setAttendanceSettings: StaffHrModel['schedule']['setAttendanceSettings']
  saving: StaffHrModel['shared']['saving']
  saveAttendanceSettings: StaffHrModel['schedule']['saveAttendanceSettings']
  hrSettings: StaffHrModel['settings']['hrSettings']
  setHrSettings: StaffHrModel['settings']['setHrSettings']
  hrOptionsByType: StaffHrModel['settings']['hrOptionsByType']
  resolvedLanguage: StaffHrModel['shared']['resolvedLanguage']
  syncPayrollDraft: StaffHrModel['settings']['syncPayrollDraft']
  saveHrSettings: StaffHrModel['settings']['saveHrSettings']
  hrSetupOptions: StaffHrModel['settings']['hrSetupOptions']
  selectedHrSetupOptionIds: Record<string, string>
  selectHrSetupOption: (optionType: import("../../lib/staff/types").StaffHrSetupOptionType, optionId: string) => void
  hrSetupForm: StaffHrModel['settings']['hrSetupForm']
  setHrSetupForm: StaffHrModel['settings']['setHrSetupForm']
  modifyHrSetupOption: (optionType: import("../../lib/staff/types").StaffHrSetupOptionType) => Promise<void>
  saveHrSetupOption: StaffHrModel['settings']['saveHrSetupOption']
  cancelHrSetupOptionEdit: (optionType: import("../../lib/staff/types").StaffHrSetupOptionType) => void
  setHrSetupOptionActive: StaffHrModel['settings']['setHrSetupOptionActive']
}

export default function SettingsSection({
  completionText,
  text,
  settingsSections,
  settingsSection,
  setSettingsSection,
  initializationRows,
  canManageAttendance,
  setHrTab,
  effectiveShiftTemplates,
  attendanceSettings,
  setAttendanceSettings,
  saving,
  saveAttendanceSettings,
  hrSettings,
  setHrSettings,
  hrOptionsByType,
  resolvedLanguage,
  syncPayrollDraft,
  saveHrSettings,
  hrSetupOptions,
  selectedHrSetupOptionIds,
  selectHrSetupOption,
  hrSetupForm,
  setHrSetupForm,
  modifyHrSetupOption,
  saveHrSetupOption,
  cancelHrSetupOptionEdit,
  setHrSetupOptionActive,
}: SettingsSectionProps) {
  return (
    <div className="staff-hr-settings-shell">
      <header className="staff-hr-settings-heading">
        <h3>{completionText.settingsTitle}</h3>
        <p>{completionText.settingsIntro}</p>
      </header>
      <div className="staff-hr-settings-workspace">
        <nav className="staff-hr-settings-nav" aria-label={completionText.settingsTitle}>
          <span>{text.hrTabs.settings}</span>
          {settingsSections.map(({ id, icon: Icon }) => (
            <button aria-current={settingsSection === id ? 'page' : undefined} className={settingsSection === id ? 'active' : ''} key={id} type="button" onClick={() => setSettingsSection(id)}>
              <Icon aria-hidden="true" size={18} />
              {completionText.sections[id]}
            </button>
          ))}
        </nav>

        <section className="staff-hr-settings-panel">
          {settingsSection === 'initialization' && (
            <div className="staff-hr-setup-checklist">
              <div className="staff-hr-settings-panel-title">
                <div><h4>{completionText.quickSetup}</h4><p>{completionText.quickSetupHelp}</p></div>
              </div>
              {initializationRows.map((row) => {
                const [title, description] = completionText.setupRows[row.id]
                return (
                  <div className="staff-hr-checklist-row" key={row.id}>
                    <CircleCheckBig aria-hidden="true" className={row.complete ? 'complete' : ''} size={24} />
                    <div><strong>{title}</strong><span>{description} · {row.meta}</span></div>
                    <button type="button" onClick={row.open}>{completionText.open}</button>
                  </div>
                )
              })}
            </div>
          )}

          {settingsSection === 'clocking' && (
            <fieldset className="staff-readonly-fieldset staff-hr-reference-settings" disabled={!canManageAttendance}>
              <div className="staff-hr-settings-panel-title"><div><h4>{completionText.attendanceSetup}</h4><p>{completionText.standardDayHelp}</p></div></div>
              <div className="staff-hr-reference-row">
                <div><strong>{completionText.shiftSetup}</strong><span>{completionText.shiftSetupHelp}</span></div>
                <button type="button" onClick={() => setHrTab('schedule')}>{effectiveShiftTemplates.length} {completionText.shifts}</button>
              </div>
              <div className="staff-hr-reference-group">
                <div className="staff-hr-reference-copy"><strong>{completionText.standardDay}</strong><span>{completionText.standardDayHelp}</span></div>
                <div className="staff-hr-inline-control">
                  <StaffPickerField ariaLabel={completionText.standardDay} mode="duration" placeholder="08:00" type="time" value={`${String(Math.floor(attendanceSettings.standard_daily_minutes / 60)).padStart(2, '0')}:${String(attendanceSettings.standard_daily_minutes % 60).padStart(2, '0')}`} onChange={(value: string) => {
                    const [hours, minutes] = value.split(':').map(Number)
                    setAttendanceSettings({ ...attendanceSettings, standard_daily_minutes: Math.max(0, hours * 60 + minutes) })
                  }} />
                </div>
                <label className="staff-hr-rule-toggle">
                  <input checked={attendanceSettings.half_day_enabled} type="checkbox" onChange={(event) => setAttendanceSettings({ ...attendanceSettings, half_day_enabled: event.target.checked })} />
                  <span>{completionText.halfDay}</span>
                </label>
                <div className="staff-hr-inline-control staff-hr-range-control">
                  <label>{completionText.from}<input min={0} type="number" value={attendanceSettings.half_day_min_minutes} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, half_day_min_minutes: Number(event.target.value) || 0 })} /><small>{completionText.minutes}</small></label>
                  <label>{completionText.to}<input min={0} type="number" value={attendanceSettings.half_day_max_minutes} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, half_day_max_minutes: Number(event.target.value) || 0 })} /><small>{completionText.minutes}</small></label>
                </div>
                <label className="staff-hr-rule-toggle">
                  <input checked={attendanceSettings.count_late_early_on_half_day} type="checkbox" onChange={(event) => setAttendanceSettings({ ...attendanceSettings, count_late_early_on_half_day: event.target.checked })} />
                  <span>{completionText.countHalfDayLate}</span>
                </label>
              </div>
              <div className="staff-hr-reference-group">
                <div className="staff-hr-reference-copy"><strong>{completionText.lateEarly}</strong></div>
                <label className="staff-hr-rule-toggle"><input checked={attendanceSettings.late_arrival_enabled} type="checkbox" onChange={(event) => setAttendanceSettings({ ...attendanceSettings, late_arrival_enabled: event.target.checked })} /><span>{completionText.lateAfter}</span><input min={0} type="number" value={attendanceSettings.late_after_minutes} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, late_after_minutes: Number(event.target.value) || 0 })} /><small>{completionText.minutes}</small></label>
                <label className="staff-hr-rule-toggle"><input checked={attendanceSettings.early_leave_enabled} type="checkbox" onChange={(event) => setAttendanceSettings({ ...attendanceSettings, early_leave_enabled: event.target.checked })} /><span>{completionText.earlyBefore}</span><input min={0} type="number" value={attendanceSettings.early_leave_before_minutes} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, early_leave_before_minutes: Number(event.target.value) || 0 })} /><small>{completionText.minutes}</small></label>
              </div>
              <div className="staff-hr-reference-group">
                <div className="staff-hr-reference-copy"><strong>{completionText.overtime}</strong></div>
                <label className="staff-hr-rule-toggle"><input checked={attendanceSettings.overtime_before_shift_enabled} type="checkbox" onChange={(event) => setAttendanceSettings({ ...attendanceSettings, overtime_before_shift_enabled: event.target.checked })} /><span>{completionText.overtimeBefore}</span><input min={0} type="number" value={attendanceSettings.overtime_before_shift_minutes} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, overtime_before_shift_minutes: Number(event.target.value) || 0 })} /><small>{completionText.minutes}</small></label>
                <label className="staff-hr-rule-toggle"><input checked={attendanceSettings.overtime_after_shift_enabled} type="checkbox" onChange={(event) => setAttendanceSettings({ ...attendanceSettings, overtime_after_shift_enabled: event.target.checked })} /><span>{completionText.overtimeAfter}</span><input min={0} type="number" value={attendanceSettings.overtime_after_shift_minutes} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, overtime_after_shift_minutes: Number(event.target.value) || 0 })} /><small>{completionText.minutes}</small></label>
                <label className="staff-hr-rule-toggle"><input checked={attendanceSettings.single_clock_for_consecutive_shifts} type="checkbox" onChange={(event) => setAttendanceSettings({ ...attendanceSettings, single_clock_for_consecutive_shifts: event.target.checked })} /><span>{completionText.consecutive}</span></label>
              </div>
              <div className="staff-hr-settings-actions"><button className="primary" disabled={saving} type="button" onClick={() => void saveAttendanceSettings()}><Save aria-hidden="true" size={16} />{text.actions.saveRules}</button></div>
            </fieldset>
          )}

          {settingsSection === 'salary' && (
            <fieldset className="staff-readonly-fieldset staff-hr-reference-settings" disabled={!canManageAttendance}>
              <div className="staff-hr-reference-row">
                <div><strong>{completionText.payday}</strong><span>{completionText.paydayHelp}</span></div>
                <label className="staff-hr-payday-select">{completionText.day}<select value={hrSettings.pay_period_start_day} onChange={(event) => setHrSettings({ ...hrSettings, pay_period_start_day: Number(event.target.value) })}>{Array.from({ length: 28 }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{day}</option>)}</select></label>
              </div>
              <label className="staff-hr-reference-row staff-hr-switch-row"><div><strong>{completionText.autoCreate}</strong><span>{completionText.autoCreateHelp}</span></div><input checked={hrSettings.auto_create_payroll_runs} role="switch" type="checkbox" onChange={(event) => setHrSettings({ ...hrSettings, auto_create_payroll_runs: event.target.checked })} /></label>
              <label className="staff-hr-reference-row staff-hr-switch-row"><div><strong>{completionText.autoUpdate}</strong><span>{completionText.autoUpdateHelp}</span></div><input checked={hrSettings.auto_update_payroll_daily} role="switch" type="checkbox" onChange={(event) => setHrSettings({ ...hrSettings, auto_update_payroll_daily: event.target.checked })} /></label>
              {(['payroll_template', 'allowance', 'deduction'] as const).map((optionType) => (
                <button className="staff-hr-reference-row staff-hr-reference-link" key={optionType} type="button" onClick={() => setSettingsSection('categories')}>
                  <div><strong>{text.hrSetupOptionTypes[optionType]}</strong><span>{(hrOptionsByType.get(optionType) || []).map((option) => option.name).slice(0, 3).join(', ') || completionText.noOptions}</span></div>
                  <span>{(hrOptionsByType.get(optionType) || []).length}</span>
                </button>
              ))}
              <label className="staff-hr-reference-row staff-hr-switch-row"><div><strong>{completionText.tax}</strong><span>{completionText.taxHelp}</span></div><input checked={hrSettings.personal_income_tax_enabled} role="switch" type="checkbox" onChange={(event) => setHrSettings({ ...hrSettings, personal_income_tax_enabled: event.target.checked })} /></label>
              <label className="staff-hr-reference-row staff-hr-switch-row"><div><strong>{completionText.insurance}</strong><span>{completionText.insuranceHelp}</span></div><input checked={hrSettings.social_insurance_enabled} role="switch" type="checkbox" onChange={(event) => setHrSettings({ ...hrSettings, social_insurance_enabled: event.target.checked })} /></label>
              <div className="staff-hr-salary-rates">
                <label>{text.labels.lunchAllowance}<input inputMode="numeric" value={formatDongInput(String(hrSettings.lunch_allowance_vnd || ''))} onChange={(event) => setHrSettings({ ...hrSettings, lunch_allowance_vnd: parseDong(dongDigits(event.target.value)) })} /></label>
                <label>{resolvedLanguage === 'vi' ? 'Giảm trừ bản thân' : 'Personal deduction'}<input inputMode="numeric" value={formatDongInput(String(hrSettings.personal_deduction_vnd || ''))} onChange={(event) => setHrSettings({ ...hrSettings, personal_deduction_vnd: parseDong(dongDigits(event.target.value)) })} /></label>
                <label>{resolvedLanguage === 'vi' ? 'Giảm trừ mỗi người phụ thuộc' : 'Deduction per dependent'}<input inputMode="numeric" value={formatDongInput(String(hrSettings.dependent_deduction_vnd || ''))} onChange={(event) => setHrSettings({ ...hrSettings, dependent_deduction_vnd: parseDong(dongDigits(event.target.value)) })} /></label>
                <label>{resolvedLanguage === 'vi' ? 'Khấu trừ ngắn hạn' : 'Short-term withholding'}<input min={0} step="0.1" type="number" value={hrSettings.short_term_pit_rate} onChange={(event) => setHrSettings({ ...hrSettings, short_term_pit_rate: Number(event.target.value) || 0 })} /></label>
              </div>
              <div className="staff-hr-rate-groups">
                <section><header><strong>{resolvedLanguage === 'vi' ? 'Nhân viên đóng' : 'Employee contributions'}</strong><span>{(hrSettings.employee_social_insurance_rate + hrSettings.employee_health_insurance_rate + hrSettings.employee_unemployment_insurance_rate).toFixed(1)}%</span></header><div><label>SI %<input min={0} step="0.1" type="number" value={hrSettings.employee_social_insurance_rate} onChange={(event) => setHrSettings({ ...hrSettings, employee_social_insurance_rate: Number(event.target.value) || 0 })} /></label><label>HI %<input min={0} step="0.1" type="number" value={hrSettings.employee_health_insurance_rate} onChange={(event) => setHrSettings({ ...hrSettings, employee_health_insurance_rate: Number(event.target.value) || 0 })} /></label><label>UI %<input min={0} step="0.1" type="number" value={hrSettings.employee_unemployment_insurance_rate} onChange={(event) => setHrSettings({ ...hrSettings, employee_unemployment_insurance_rate: Number(event.target.value) || 0 })} /></label></div></section>
                <section><header><strong>{resolvedLanguage === 'vi' ? 'Công ty đóng' : 'Employer contributions'}</strong><span>{(hrSettings.employer_social_insurance_rate + hrSettings.employer_health_insurance_rate + hrSettings.employer_unemployment_insurance_rate + hrSettings.employer_trade_union_rate).toFixed(1)}%</span></header><div><label>SI %<input min={0} step="0.1" type="number" value={hrSettings.employer_social_insurance_rate} onChange={(event) => setHrSettings({ ...hrSettings, employer_social_insurance_rate: Number(event.target.value) || 0 })} /></label><label>HI %<input min={0} step="0.1" type="number" value={hrSettings.employer_health_insurance_rate} onChange={(event) => setHrSettings({ ...hrSettings, employer_health_insurance_rate: Number(event.target.value) || 0 })} /></label><label>UI %<input min={0} step="0.1" type="number" value={hrSettings.employer_unemployment_insurance_rate} onChange={(event) => setHrSettings({ ...hrSettings, employer_unemployment_insurance_rate: Number(event.target.value) || 0 })} /></label><label>{resolvedLanguage === 'vi' ? 'Công đoàn %' : 'Union %'}<input min={0} step="0.1" type="number" value={hrSettings.employer_trade_union_rate} onChange={(event) => setHrSettings({ ...hrSettings, employer_trade_union_rate: Number(event.target.value) || 0 })} /></label></div></section>
              </div>
              <div className="staff-hr-pit-brackets">
                <strong>{resolvedLanguage === 'vi' ? 'Biểu thuế lũy tiến tháng' : 'Monthly progressive PIT brackets'}</strong>
                <p>{resolvedLanguage === 'vi' ? 'Mỗi giới hạn là thu nhập tính thuế hàng tháng bằng VND; thuế suất chỉ áp dụng cho phần thu nhập trong bậc đó. Để trống giới hạn của bậc cuối.' : 'Each upper limit is monthly taxable income in VND; its rate applies only to the income inside that bracket. Leave the final upper limit empty.'}</p>
                <div>{hrSettings.pit_brackets.map((bracket, index: number) => {
                  const previousLimit = index > 0 ? hrSettings.pit_brackets[index - 1]?.up_to : null
                  const rangeLabel = bracket.up_to == null
                    ? previousLimit == null
                      ? (resolvedLanguage === 'vi' ? 'Không có giới hạn trên' : 'No upper limit')
                      : (resolvedLanguage === 'vi' ? `Trên ${formatDongInput(String(previousLimit))}` : `Above ${formatDongInput(String(previousLimit))}`)
                    : previousLimit == null
                      ? (resolvedLanguage === 'vi' ? `Đến ${formatDongInput(String(bracket.up_to))}` : `Up to ${formatDongInput(String(bracket.up_to))}`)
                      : (resolvedLanguage === 'vi' ? `Trên ${formatDongInput(String(previousLimit))} đến ${formatDongInput(String(bracket.up_to))}` : `Above ${formatDongInput(String(previousLimit))} up to ${formatDongInput(String(bracket.up_to))}`)

                  return (
                    <section className="staff-hr-pit-bracket-card" key={`pit-bracket-${index}`}>
                      <header>
                        <span>{resolvedLanguage === 'vi' ? `Bậc ${index + 1}` : `Bracket ${index + 1}`}</span>
                        <strong>{rangeLabel}</strong>
                      </header>
                      <div className="staff-hr-pit-bracket-fields">
                        <label>
                          <span>{resolvedLanguage === 'vi' ? 'Giới hạn trên (VND)' : 'Upper limit (VND)'}</span>
                          <input aria-label={`PIT bracket ${index + 1} upper limit`} inputMode="numeric" placeholder={resolvedLanguage === 'vi' ? 'Không giới hạn' : 'No ceiling'} value={bracket.up_to == null ? '' : formatDongInput(String(bracket.up_to))} onChange={(event) => setHrSettings({ ...hrSettings, pit_brackets: hrSettings.pit_brackets.map((item, itemIndex: number) => itemIndex === index ? { ...item, up_to: event.target.value ? parseDong(dongDigits(event.target.value)) : null } : item) })} />
                        </label>
                        <label>
                          <span>{resolvedLanguage === 'vi' ? 'Thuế suất' : 'Tax rate'}</span>
                          <div className="staff-hr-pit-input-with-suffix staff-hr-pit-rate-input">
                            <input aria-label={`PIT bracket ${index + 1} rate`} min={0} step="0.1" type="number" value={bracket.rate} onChange={(event) => setHrSettings({ ...hrSettings, pit_brackets: hrSettings.pit_brackets.map((item, itemIndex: number) => itemIndex === index ? { ...item, rate: Number(event.target.value) || 0 } : item) })} />
                            <small>%</small>
                          </div>
                        </label>
                      </div>
                    </section>
                  )
                })}</div>
              </div>
              <div className="staff-hr-policy-editor">
                <label>{resolvedLanguage === 'vi' ? 'Phiên bản' : 'Policy version'}<input value={hrSettings.policy_version} onChange={(event) => setHrSettings({ ...hrSettings, policy_version: event.target.value })} /></label>
                <label>{resolvedLanguage === 'vi' ? 'Hiệu lực từ' : 'Effective from'}<input type="date" value={hrSettings.effective_from} onChange={(event) => setHrSettings({ ...hrSettings, effective_from: event.target.value })} /></label>
                <label>{resolvedLanguage === 'vi' ? 'Trạng thái' : 'Policy status'}<select value={hrSettings.policy_status} onChange={(event) => setHrSettings({ ...hrSettings, policy_status: event.target.value as 'draft' | 'active' | 'retired' })}><option value="draft">{resolvedLanguage === 'vi' ? 'Bản nháp' : 'Draft'}</option><option value="active">{resolvedLanguage === 'vi' ? 'Đang áp dụng' : 'Active'}</option><option value="retired">{resolvedLanguage === 'vi' ? 'Ngừng áp dụng' : 'Retired'}</option></select></label>
                <label>{resolvedLanguage === 'vi' ? 'Ngày rà soát' : 'Legal review date'}<input type="date" value={hrSettings.legal_reviewed_on || ''} onChange={(event) => setHrSettings({ ...hrSettings, legal_reviewed_on: event.target.value || null })} /></label>
                <label className="full">{resolvedLanguage === 'vi' ? 'Nguồn pháp lý' : 'Legal source URL'}<input type="url" value={hrSettings.legal_source_url || ''} onChange={(event) => setHrSettings({ ...hrSettings, legal_source_url: event.target.value || null })} /></label>
              </div>
              <div className="staff-hr-settings-actions">
                <span>{completionText.lastSync}: {hrSettings.last_auto_payroll_sync_on || completionText.never}</span>
                <button disabled={saving} type="button" onClick={() => void syncPayrollDraft()}><RefreshCw aria-hidden="true" size={16} />{completionText.syncNow}</button>
                <button className="primary" disabled={saving} type="button" onClick={() => void saveHrSettings()}><Save aria-hidden="true" size={16} />{text.actions.saveHrSettings}</button>
              </div>
            </fieldset>
          )}

          {settingsSection === 'work_rest' && (
            <fieldset className="staff-readonly-fieldset staff-hr-reference-settings" disabled={!canManageAttendance}>
              <div className="staff-hr-work-rest-grid">
                <label>{completionText.weekStarts}<select value={attendanceSettings.work_week_start} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, work_week_start: Number(event.target.value) })}>{completionText.days.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
                <label>{completionText.standardWeek}<input min={0} step="0.25" type="number" value={attendanceSettings.standard_weekly_minutes / 60} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, standard_weekly_minutes: Math.round((Number(event.target.value) || 0) * 60) })} /></label>
                <label>{completionText.standardBreak}<input min={0} type="number" value={attendanceSettings.standard_break_minutes} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, standard_break_minutes: Number(event.target.value) || 0 })} /></label>
                <label>{completionText.annualLeave}<input min={0} step="0.5" type="number" value={attendanceSettings.annual_leave_days} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, annual_leave_days: Number(event.target.value) || 0 })} /></label>
                <label>{completionText.monthlyDays}<input min={1} step="0.5" type="number" value={hrSettings.standard_monthly_days} onChange={(event) => setHrSettings({ ...hrSettings, standard_monthly_days: Number(event.target.value) || 26 })} /></label>
                <label>{completionText.monthlyHours}<input min={1} step="0.5" type="number" value={hrSettings.standard_monthly_hours} onChange={(event) => setHrSettings({ ...hrSettings, standard_monthly_hours: Number(event.target.value) || 208 })} /></label>
                <label>{completionText.minimumRest}<input min={0} step="0.25" type="number" value={Number((hrSettings.rest_period_minutes / 60).toFixed(2))} onChange={(event) => setHrSettings({ ...hrSettings, rest_period_minutes: Math.round((Number(event.target.value) || 0) * 60) })} /></label>
                <label>{completionText.overtimeMonth}<input min={0} step="0.25" type="number" value={attendanceSettings.overtime_monthly_cap_minutes / 60} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, overtime_monthly_cap_minutes: Math.round((Number(event.target.value) || 0) * 60) })} /></label>
                <label>{completionText.overtimeYear}<input min={0} step="0.25" type="number" value={attendanceSettings.overtime_yearly_cap_minutes / 60} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, overtime_yearly_cap_minutes: Math.round((Number(event.target.value) || 0) * 60) })} /></label>
                <label>{text.labels.normalOvertimeMultiplier}<input min={0} step="0.05" type="number" value={hrSettings.normal_overtime_multiplier} onChange={(event) => setHrSettings({ ...hrSettings, normal_overtime_multiplier: Number(event.target.value) || 0 })} /></label>
                <label>{resolvedLanguage === 'vi' ? 'Hệ số tăng ca đêm (tự tính)' : 'Night OT multiplier (calculated)'}<input readOnly type="number" value={Number((hrSettings.normal_overtime_multiplier + hrSettings.night_work_bonus_rate / 100 + hrSettings.night_overtime_extra_rate / 100).toFixed(2))} /></label>
                <label>{text.labels.holidayOvertimeMultiplier}<input min={0} step="0.05" type="number" value={hrSettings.holiday_overtime_multiplier} onChange={(event) => setHrSettings({ ...hrSettings, holiday_overtime_multiplier: Number(event.target.value) || 0 })} /></label>
                <label>{resolvedLanguage === 'vi' ? 'Phụ cấp làm đêm %' : 'Night work bonus %'}<input min={0} step="0.1" type="number" value={hrSettings.night_work_bonus_rate} onChange={(event) => setHrSettings({ ...hrSettings, night_work_bonus_rate: Number(event.target.value) || 0 })} /></label>
                <label>{resolvedLanguage === 'vi' ? 'Phụ cấp tăng ca đêm %' : 'Night OT extra %'}<input min={0} step="0.1" type="number" value={hrSettings.night_overtime_extra_rate} onChange={(event) => setHrSettings({ ...hrSettings, night_overtime_extra_rate: Number(event.target.value) || 0 })} /></label>
                <label>{resolvedLanguage === 'vi' ? 'Phép tích lũy / tháng' : 'Leave accrued / month'}<input min={0} step="0.1" type="number" value={hrSettings.leave_accrual_days_per_month} onChange={(event) => setHrSettings({ ...hrSettings, leave_accrual_days_per_month: Number(event.target.value) || 0 })} /></label>
                <label>{resolvedLanguage === 'vi' ? 'Ngày công để đủ điều kiện' : 'Worked days to qualify'}<input min={0} max={31} type="number" value={hrSettings.leave_qualifying_worked_days} onChange={(event) => setHrSettings({ ...hrSettings, leave_qualifying_worked_days: Number(event.target.value) || 0 })} /></label>
                <label>{resolvedLanguage === 'vi' ? 'Ngày chốt nhân viên mới' : 'Join-month cutoff day'}<input min={1} max={31} type="number" value={hrSettings.leave_join_cutoff_day} onChange={(event) => setHrSettings({ ...hrSettings, leave_join_cutoff_day: Number(event.target.value) || 1 })} /></label>
                <label>{resolvedLanguage === 'vi' ? 'Ngày chốt nghỉ việc' : 'Exit-month cutoff day'}<input min={1} max={31} type="number" value={hrSettings.leave_exit_cutoff_day} onChange={(event) => setHrSettings({ ...hrSettings, leave_exit_cutoff_day: Number(event.target.value) || 1 })} /></label>
                <label>{resolvedLanguage === 'vi' ? 'Hạn chuyển phép (tháng)' : 'Carry-forward expiry month'}<input min={1} max={12} type="number" value={hrSettings.leave_carry_forward_month} onChange={(event) => setHrSettings({ ...hrSettings, leave_carry_forward_month: Number(event.target.value) || 1 })} /></label>
                <label>{resolvedLanguage === 'vi' ? 'Hạn chuyển phép (ngày)' : 'Carry-forward expiry day'}<input min={1} max={31} type="number" value={hrSettings.leave_carry_forward_day} onChange={(event) => setHrSettings({ ...hrSettings, leave_carry_forward_day: Number(event.target.value) || 1 })} /></label>
              </div>
              <div className="staff-hr-rest-days"><strong>{completionText.restDays}</strong>{completionText.days.map((day, index) => <label key={day}><input checked={attendanceSettings.weekly_rest_days.includes(index)} type="checkbox" onChange={(event) => setAttendanceSettings({ ...attendanceSettings, weekly_rest_days: event.target.checked ? [...new Set([...attendanceSettings.weekly_rest_days, index])].sort() : attendanceSettings.weekly_rest_days.filter((value: number) => value !== index) })} />{day}</label>)}</div>
              <div className="staff-hr-settings-actions"><button disabled={saving} type="button" onClick={() => void saveAttendanceSettings()}><Save aria-hidden="true" size={16} />{text.actions.saveRules}</button><button className="primary" disabled={saving} type="button" onClick={() => void saveHrSettings()}><Save aria-hidden="true" size={16} />{text.actions.saveHrSettings}</button></div>
            </fieldset>
          )}

          {(settingsSection === 'categories' || settingsSection === 'organization') && (
            <div className="staff-hr-option-settings">
              {(settingsSection === 'categories' ? (['payroll_template', 'allowance', 'deduction'] as const) : (['location', 'department', 'job_title', 'contract_status', 'contract_type', 'employment_type'] as const)).map((optionType) => {
                const options = hrSetupOptions.filter((option) => option.option_type === optionType)
                const selectedId = selectedHrSetupOptionIds[optionType] || ''
                const selectedOption = options.find((option) => option.id === selectedId)
                const modifying = selectedOption
                return (
                  <div className="staff-hr-option-row" key={optionType}>
                    <div>
                      <strong>{text.hrSetupOptionTypes[optionType]}</strong>
                      <p>{resolvedLanguage === 'vi' ? 'Dùng trong hồ sơ nhân viên, bộ lọc lịch, bảng lương và Excel.' : 'Used in employee profiles, schedule filters, payroll, and Excel export.'}</p>
                    </div>
                    <div className="staff-hr-option-editor">
                      <label>
                        <span>{resolvedLanguage === 'vi' ? 'Tùy chọn hiện có' : 'Existing option'}</span>
                        <select value={selectedId} onChange={(event) => selectHrSetupOption(optionType, event.target.value)}>
                          <option value="">{options.length > 0 ? (resolvedLanguage === 'vi' ? 'Tạo tùy chọn mới' : 'Create new option') : completionText.noOptions}</option>
                          {options.map((option) => <option key={option.id} value={option.id}>{option.name}{option.active ? '' : (resolvedLanguage === 'vi' ? ' (đã lưu trữ)' : ' (archived)')}</option>)}
                        </select>
                      </label>
                      <label>
                        <span>{modifying ? (resolvedLanguage === 'vi' ? 'Tên mới' : 'Updated name') : (resolvedLanguage === 'vi' ? 'Tên tùy chọn' : 'Option name')}</span>
                        <input value={hrSetupForm[optionType]} onChange={(event) => setHrSetupForm((current) => ({ ...current, [optionType]: event.target.value }))} />
                      </label>
                      <div className="staff-hr-option-actions">
                        <button disabled={saving || !hrSetupForm[optionType].trim() || !canManageAttendance} type="button" onClick={() => void (modifying ? modifyHrSetupOption(optionType) : saveHrSetupOption(optionType))}>
                          {modifying ? <Pencil aria-hidden="true" size={15} /> : <Plus aria-hidden="true" size={15} />}
                          {modifying ? (resolvedLanguage === 'vi' ? 'Sửa' : 'Modify') : completionText.add}
                        </button>
                        {modifying && <button className="secondary" disabled={saving} type="button" onClick={() => cancelHrSetupOptionEdit(optionType)}>
                          <X aria-hidden="true" size={15} />{resolvedLanguage === 'vi' ? 'Hủy' : 'Cancel'}
                        </button>}
                        {modifying && <button className="secondary" disabled={saving || !canManageAttendance} type="button" onClick={() => void setHrSetupOptionActive(selectedOption.id, !selectedOption.active)}>
                          {selectedOption.active ? <X aria-hidden="true" size={15} /> : <Check aria-hidden="true" size={15} />}
                          {selectedOption.active ? (resolvedLanguage === 'vi' ? 'Lưu trữ' : 'Archive') : (resolvedLanguage === 'vi' ? 'Khôi phục' : 'Restore')}
                        </button>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
