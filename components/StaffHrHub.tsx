'use client'

/* eslint-disable @typescript-eslint/no-explicit-any -- This lazy view receives StaffConsole's private HR model without exporting the whole console type graph. */
import { Ban, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Coins, Copy, Download, FileCheck2, FileSpreadsheet, FileText, Pencil, Plus, ReceiptText, Save, Send, Settings2, UserRound, WalletCards, X } from 'lucide-react'
import { Fragment } from 'react'
import { PhoneNumberInput } from './CountryCodePicker'

type StaffContractStatus = string
type StaffHrHubProps = {
  model: any
}

function hrModuleIcon(tab: string) {
  if (tab === 'employees') return <UserRound aria-hidden="true" size={18} />
  if (tab === 'schedule') return <CalendarDays aria-hidden="true" size={18} />
  if (tab === 'timesheet') return <Clock3 aria-hidden="true" size={18} />
  if (tab === 'payroll') return <ReceiptText aria-hidden="true" size={18} />
  if (tab === 'adjustments') return <Coins aria-hidden="true" size={18} />
  if (tab === 'advances') return <WalletCards aria-hidden="true" size={18} />
  return <Settings2 aria-hidden="true" size={18} />
}

export default function StaffHrHub({ model }: StaffHrHubProps) {
  const {
    ButtonIconText,
    StaffPickerField,
    StaffRoleAvatar,
    approvePayrollRun,
    applyShiftTemplate,
    attendanceGridStyle,
    attendanceScheduleScopeOptions,
    attendanceShiftsByCell,
    attendanceWeekEnd,
    attendanceWeekDates,
    attendanceWeekStart,
    canEditEmployeeProfiles,
    canManageAttendance,
    customerName,
    dateFromInput,
    dongDigits,
    downloadEmployeePayslip,
    draggingShiftId,
    draftShiftCount,
    effectiveAttendanceScheduleScope,
    effectiveShiftTemplates,
    editEmployeeProfile,
    editShift,
    employeeForm,
    employeeFormForProfile,
    employeePayrollSummary,
    employeeProfileById,
    employeeUsesMonthlyGross,
    emptyStaffPayrollCalculation,
    filteredHrStaffProfiles,
    firstEmployeeStaffProfileId,
    firstScheduleStaffProfileId,
    formatDongInput,
    formatVnd,
    formatVndCompact,
    generatePayrollRun,
    handleHrDocumentUpload,
    hoursLabel,
    hrAdjustmentForm,
    hrContractTypeOptions,
    hrDepartmentFilter,
    hrDepartmentOptions,
    hrDocumentUploading,
    hrJobTitleOptions,
    hrLocationOptions,
    hrOptionsByType,
    hrPayrollTotals,
    hrSearch,
    hrSettings,
    hrSetupForm,
    hrStatusFilter,
    hrTab,
    normalizeHrAdjustmentStatus,
    normalizeHrAdjustmentType,
    normalizePayrollPayCycle,
    normalizePayrollStatus,
    normalizeStaffContractStatus,
    normalizeStaffEmploymentType,
    normalizeTime,
    parseDong,
    payrollItems,
    payrollPeriodEnd,
    payrollPeriodStart,
    payrollRunForm,
    payrollRuns,
    periodHrAdjustments,
    profileById,
    rangeLabel,
    roleLabel,
    saveEmployeeProfile,
    saveHrAdjustment,
    saveHrSettings,
    saveHrSetupOption,
    saveShift,
    saving,
    selectedEmployeeDocuments,
    selectedEmployeeOutstandingDebt,
    selectedEmployeeStaffId,
    selectedEmployeeStaffProfile,
    selectedShiftTemplate,
    setAttendanceScheduleScope,
    setDraggingShiftId,
    setAttendanceRange,
    setEmployeeForm,
    setHrAdjustmentForm,
    setHrDepartmentFilter,
    setHrSearch,
    setHrSettings,
    setHrSetupForm,
    setHrStatusFilter,
    setHrTab,
    setPayrollRunForm,
    setShiftForm,
    sharedText,
    shiftForm,
    shortDateLabel,
    shiftAttendanceRange,
    shiftWarningsById,
    staffContractStatuses,
    staffCvTypes,
    staffDateLabel,
    staffEmploymentTypes,
    staffGenderOptions,
    staffHrAdjustmentStatuses,
    staffHrAdjustmentTypes,
    staffHrSetupOptionTypes,
    staffHrTabs,
    staffPayrollCalculations,
    staffPayrollPayCycles,
    staffProfilePhotoTypes,
    staffShiftStatuses,
    staffRoleName,
    startShiftForCell,
    text,
    resetAttendanceRangeToThisWeek,
    updateHrAdjustmentStatus,
    updateShiftStatus,
    visibleAllStaffProfileOptions,
    visibleScheduleAttendanceShifts,
    visibleScheduleStaffProfileOptions,
    visibleStaffProfileOptions,
    copyPreviousAttendanceWeek,
    moveShiftToCell,
    publishAttendanceWeek,
  } = model

  const activeEmployeeCount = visibleAllStaffProfileOptions.filter((staffProfile: any) => (
    employeeProfileById.get(staffProfile.id)?.active !== false
  )).length
  const missingEmployeeDocumentCount = visibleAllStaffProfileOptions.filter((staffProfile: any) => {
    const employee = employeeProfileById.get(staffProfile.id)
    return !employee?.profile_photo_path || !employee?.cv_document_path
  }).length
  const pendingAdjustmentCount = periodHrAdjustments.filter((item: any) => normalizeHrAdjustmentStatus(item.status) === 'pending').length
  const periodAdvanceCount = periodHrAdjustments.filter((item: any) => ['advance', 'debt', 'debt_repayment'].includes(normalizeHrAdjustmentType(item.adjustment_type))).length
  const selectedEmployeeLabel = selectedEmployeeStaffProfile ? customerName(selectedEmployeeStaffProfile, text) : text.customerFallback

  const hrModuleMeta = (tab: string) => {
    if (tab === 'employees') return `${activeEmployeeCount}/${visibleAllStaffProfileOptions.length} ${text.labels.activeEmployee}`
    if (tab === 'schedule') return `${visibleScheduleAttendanceShifts.length} ${text.labels.shiftRole}`
    if (tab === 'timesheet') return `${visibleStaffProfileOptions.length} ${text.hrTabs.employees}`
    if (tab === 'payroll') return `${payrollRuns.length} ${text.labels.payrollRun}`
    if (tab === 'adjustments') return `${pendingAdjustmentCount} ${text.adjustmentStatuses.pending}`
    if (tab === 'advances') return `${periodAdvanceCount} ${text.hrTabs.advances}`
    return `${staffHrSetupOptionTypes.length} ${text.labels.rule}`
  }

  return (
        <div className="staff-hr-console">
          {visibleAllStaffProfileOptions.length === 0 ? (
            <p className="notice">{text.messages.noStaffProfiles}</p>
          ) : (
            <>
              <div className="staff-hr-command">
                <div>
                  <h3>{text.tabs.hr}</h3>
                  <p>{text.messages.hrIntro}</p>
                </div>
                <div className="staff-hr-command-panel" aria-label={text.tabs.hr}>
                  <span>{rangeLabel(payrollPeriodStart, payrollPeriodEnd)}</span>
                  <strong>{selectedEmployeeLabel}</strong>
                </div>
              </div>
              <div className="staff-hr-summary staff-hr-metrics">
                <div><span>{text.hrTabs.employees}</span><strong>{visibleAllStaffProfileOptions.length}</strong><small>{activeEmployeeCount} {text.labels.activeEmployee} · {missingEmployeeDocumentCount} {text.labels.missingDocuments}</small></div>
                <div><span>{text.labels.totalGross}</span><strong>{formatVndCompact(hrPayrollTotals.gross)}</strong></div>
                <div><span>{text.labels.totalNet}</span><strong>{formatVndCompact(hrPayrollTotals.net)}</strong></div>
                <div><span>{text.labels.totalCompanyCost}</span><strong>{formatVndCompact(hrPayrollTotals.companyCost)}</strong></div>
                <div><span>{text.labels.restWarnings}</span><strong>{hrPayrollTotals.restWarnings}</strong></div>
                <div><span>{text.labels.outstandingDebt}</span><strong>{formatVndCompact(Math.max(0, selectedEmployeeOutstandingDebt))}</strong><small>{selectedEmployeeLabel}</small></div>
              </div>
              <div className="staff-hr-main">
                <aside className="staff-hr-module-rail" aria-label={text.tabs.hr}>
                  {staffHrTabs.map((tab: any) => (
                    <button aria-current={hrTab === tab ? 'page' : undefined} className={hrTab === tab ? 'active' : ''} key={tab} type="button" onClick={() => setHrTab(tab)}>
                      <span className="staff-hr-module-icon">{hrModuleIcon(tab)}</span>
                      <span>
                        <strong>{text.hrTabs[tab]}</strong>
                        <small>{hrModuleMeta(tab)}</small>
                      </span>
                    </button>
                  ))}
                </aside>
                <div className="staff-hr-content">

              {hrTab === 'employees' && (
                <div className="staff-attendance-layout staff-employee-layout staff-hr-employee-layout">
                  <div className="staff-attendance-list staff-employee-list staff-hr-roster-panel">
                    <div className="staff-hr-panel-head">
                      <div>
                        <h4>{text.labels.privateEmployeeProfile}</h4>
                        <p className="staff-helper-text">{text.messages.employeeProfileIntro}</p>
                      </div>
                      <strong>{filteredHrStaffProfiles.length}</strong>
                    </div>
                    <div className="staff-hr-filter-grid">
                      <label>{text.labels.searchUsers}<input value={hrSearch} onChange={(event) => setHrSearch(event.target.value)} /></label>
                      <label>
                        {text.labels.contractStatus}
                        <select value={hrStatusFilter} onChange={(event) => setHrStatusFilter(event.target.value as StaffContractStatus | 'all')}>
                          <option value="all">{text.any}</option>
                          {staffContractStatuses.map((statusValue: any) => <option key={statusValue} value={statusValue}>{text.contractStatuses[statusValue]}</option>)}
                        </select>
                      </label>
                      <label>
                        {text.labels.department}
                        <select value={hrDepartmentFilter} onChange={(event) => setHrDepartmentFilter(event.target.value)}>
                          <option value="all">{text.any}</option>
                          {hrDepartmentOptions.map((option: any) => <option key={option.id} value={option.name}>{option.name}</option>)}
                        </select>
                      </label>
                    </div>
                    {filteredHrStaffProfiles.map((staffProfile: any) => {
                      const employee = employeeProfileById.get(staffProfile.id)
                      const isInactiveEmployee = employee?.active === false
                      const isSelected = (employeeForm.profile_id || firstEmployeeStaffProfileId) === staffProfile.id
                      return (
                        <button
                          className={`staff-employee-row ${isSelected ? 'active' : ''} ${isInactiveEmployee ? 'inactive' : ''}`}
                          key={staffProfile.id}
                          type="button"
                          onClick={() => editEmployeeProfile(staffProfile)}
                        >
                          <StaffRoleAvatar profile={staffProfile} text={text} />
                          <span>
                            <strong>{customerName(staffProfile, text)}</strong>
                            <small>
                              {employee?.employee_code || employee?.attendance_number || staffRoleName(roleLabel(staffProfile.role, staffProfile.email), text)} · {employee?.job_title || text.labels.staffMember}
                              {employee?.main_work_location ? ` · ${employee.main_work_location}` : ''}
                              {isInactiveEmployee ? ` · ${text.labels.inactiveEmployee}` : ''}
                            </small>
                          </span>
                          <span className="staff-hr-row-status">{employee?.contract_status ? text.contractStatuses[normalizeStaffContractStatus(employee.contract_status)] : text.noneYet}</span>
                        </button>
                      )
                    })}
                  </div>

                  <fieldset className="staff-readonly-fieldset staff-attendance-form staff-employee-form staff-hr-workspace" disabled={!canEditEmployeeProfiles || !selectedEmployeeStaffProfile}>
                    <div className="staff-hr-workspace-head">
                      <div>
                        <h4>{text.labels.payrollLink}</h4>
                        <span>{selectedEmployeeLabel}</span>
                      </div>
                      <button className="primary" type="button" disabled={saving || !canEditEmployeeProfiles || !selectedEmployeeStaffProfile} onClick={saveEmployeeProfile}>
                        <ButtonIconText icon={<Save aria-hidden="true" size={15} />}>{text.actions.saveEmployeeProfile}</ButtonIconText>
                      </button>
                    </div>
                    {selectedEmployeeStaffProfile && (
                      <div className="staff-employee-selected">
                        <StaffRoleAvatar profile={selectedEmployeeStaffProfile} text={text} />
                        <div>
                          <strong>{customerName(selectedEmployeeStaffProfile, text)}</strong>
                          <span>{selectedEmployeeStaffProfile.email || selectedEmployeeStaffProfile.phone || text.noContact}</span>
                        </div>
                      </div>
                    )}
                    <div className="staff-summary-grid staff-employee-summary staff-hr-pay-summary">
                      <div><span>{text.labels.scheduledHours}</span><strong>{hoursLabel(employeePayrollSummary.scheduledMinutes)}</strong></div>
                      <div><span>{text.labels.workedHours}</span><strong>{hoursLabel(employeePayrollSummary.workedMinutes)}</strong></div>
                      <div><span>{text.labels.grossIncome}</span><strong>{formatVnd(employeePayrollSummary.grossIncome)}</strong></div>
                      <div><span>{text.labels.netIncome}</span><strong>{formatVnd(employeePayrollSummary.netIncome)}</strong></div>
                    </div>
                    <datalist id="staff-hr-department-options">{hrDepartmentOptions.map((option: any) => <option key={option.id} value={option.name} />)}</datalist>
                    <datalist id="staff-hr-location-options">{hrLocationOptions.map((option: any) => <option key={option.id} value={option.name} />)}</datalist>
                    <datalist id="staff-hr-job-title-options">{hrJobTitleOptions.map((option: any) => <option key={option.id} value={option.name} />)}</datalist>
                    <datalist id="staff-hr-contract-type-options">{hrContractTypeOptions.map((option: any) => <option key={option.id} value={option.name} />)}</datalist>
                    <div className="staff-hr-profile-form">
                      <section className="staff-hr-form-section">
                        <h5>{text.labels.privateEmployeeProfile}</h5>
                        <div className="form-grid compact-form-grid">
                          <label>
                            {text.labels.staffMember}
                            <select value={employeeForm.profile_id || firstEmployeeStaffProfileId} onChange={(event) => {
                              const staffProfile = visibleAllStaffProfileOptions.find((item: any) => item.id === event.target.value)
                              if (staffProfile) setEmployeeForm(employeeFormForProfile(staffProfile, employeeProfileById.get(staffProfile.id)))
                            }}>
                              {visibleAllStaffProfileOptions.map((item: any) => <option key={item.id} value={item.id}>{customerName(item, text)}</option>)}
                            </select>
                          </label>
                          <label>{text.labels.employeeCode}<input value={employeeForm.employee_code} onChange={(event) => setEmployeeForm({ ...employeeForm, employee_code: event.target.value })} /></label>
                          <label>{text.labels.attendanceNumber}<input value={employeeForm.attendance_number} onChange={(event) => setEmployeeForm({ ...employeeForm, attendance_number: event.target.value })} /></label>
                          <label>{text.labels.legalName}<input value={employeeForm.legal_name} onChange={(event) => setEmployeeForm({ ...employeeForm, legal_name: event.target.value })} /></label>
                          <label>{text.labels.nationalId}<input value={employeeForm.national_id} onChange={(event) => setEmployeeForm({ ...employeeForm, national_id: event.target.value })} /></label>
                          <label>{text.labels.dateOfBirth}<StaffPickerField ariaLabel={text.labels.dateOfBirth} placeholder={text.chooseDate} type="date" value={employeeForm.date_of_birth} onChange={(value: string) => setEmployeeForm({ ...employeeForm, date_of_birth: value })} /></label>
                          <label>
                            {text.labels.gender}
                            <select value={employeeForm.gender} onChange={(event) => setEmployeeForm({ ...employeeForm, gender: event.target.value })}>
                              <option value="">{text.any}</option>
                              {staffGenderOptions.map((gender: any) => <option key={gender} value={gender}>{text.genderOptions[gender]}</option>)}
                            </select>
                          </label>
                        </div>
                      </section>

                      <section className="staff-hr-form-section">
                        <h5>{text.labels.contractStatus}</h5>
                        <div className="form-grid compact-form-grid">
                          <label>{text.labels.department}<input list="staff-hr-department-options" value={employeeForm.department} onChange={(event) => setEmployeeForm({ ...employeeForm, department: event.target.value })} /></label>
                          <label>{text.labels.jobTitle}<input list="staff-hr-job-title-options" value={employeeForm.job_title} onChange={(event) => setEmployeeForm({ ...employeeForm, job_title: event.target.value })} /></label>
                          <label>{text.labels.mainWorkLocation}<input list="staff-hr-location-options" value={employeeForm.main_work_location} onChange={(event) => setEmployeeForm({ ...employeeForm, main_work_location: event.target.value })} /></label>
                          <label>{text.labels.payrollLocation}<input list="staff-hr-location-options" value={employeeForm.payroll_location} onChange={(event) => setEmployeeForm({ ...employeeForm, payroll_location: event.target.value })} /></label>
                          <label>
                            {text.labels.employmentType}
                            <select value={employeeForm.employment_type} onChange={(event) => setEmployeeForm({ ...employeeForm, employment_type: normalizeStaffEmploymentType(event.target.value) })}>
                              {staffEmploymentTypes.map((item: any) => <option key={item} value={item}>{text.employmentTypes[item]}</option>)}
                            </select>
                          </label>
                          <label>
                            {text.labels.contractStatus}
                            <select value={employeeForm.contract_status} onChange={(event) => setEmployeeForm({ ...employeeForm, contract_status: normalizeStaffContractStatus(event.target.value) })}>
                              {staffContractStatuses.map((statusValue: any) => <option key={statusValue} value={statusValue}>{text.contractStatuses[statusValue]}</option>)}
                            </select>
                          </label>
                          <label>{text.labels.contractType}<input list="staff-hr-contract-type-options" value={employeeForm.contract_type} onChange={(event) => setEmployeeForm({ ...employeeForm, contract_type: event.target.value })} /></label>
                          <label>{text.labels.contractStartDate}<StaffPickerField ariaLabel={text.labels.contractStartDate} placeholder={text.chooseDate} type="date" value={employeeForm.contract_start_date} onChange={(value: string) => setEmployeeForm({ ...employeeForm, contract_start_date: value })} /></label>
                          <label>{text.labels.contractEndDate}<StaffPickerField ariaLabel={text.labels.contractEndDate} placeholder={text.chooseDate} type="date" value={employeeForm.contract_end_date} onChange={(value: string) => setEmployeeForm({ ...employeeForm, contract_end_date: value })} /></label>
                          <label>{text.labels.startDate}<StaffPickerField ariaLabel={text.labels.startDate} placeholder={text.chooseDate} type="date" value={employeeForm.start_date} onChange={(value: string) => setEmployeeForm({ ...employeeForm, start_date: value })} /></label>
                          <label>{text.labels.endDate}<StaffPickerField ariaLabel={text.labels.endDate} placeholder={text.chooseDate} type="date" value={employeeForm.end_date} onChange={(value: string) => setEmployeeForm({ ...employeeForm, end_date: value })} /></label>
                        </div>
                      </section>

                      <section className="staff-hr-form-section">
                        <h5>{text.labels.payrollLink}</h5>
                        <div className="form-grid compact-form-grid">
                          {employeeUsesMonthlyGross ? (
                            <label>{text.labels.monthlyGross}<input inputMode="numeric" value={formatDongInput(employeeForm.base_salary_vnd)} onChange={(event) => setEmployeeForm({ ...employeeForm, base_salary_vnd: dongDigits(event.target.value) })} /></label>
                          ) : (
                            <label>{text.labels.hourlyRate}<input inputMode="numeric" value={formatDongInput(employeeForm.hourly_rate_vnd)} onChange={(event) => setEmployeeForm({ ...employeeForm, hourly_rate_vnd: dongDigits(event.target.value) })} /></label>
                          )}
                          <label>{text.labels.lunchAllowance}<input inputMode="numeric" value={formatDongInput(employeeForm.lunch_allowance_vnd)} onChange={(event) => setEmployeeForm({ ...employeeForm, lunch_allowance_vnd: dongDigits(event.target.value) })} /></label>
                          <label>{text.labels.restPeriodHours}<input min={0} step="0.25" type="number" value={employeeForm.rest_period_hours} onChange={(event) => setEmployeeForm({ ...employeeForm, rest_period_hours: event.target.value })} /></label>
                          <label>{text.labels.normalOvertimeMultiplier}<input min={0} step="0.05" type="number" value={employeeForm.overtime_rate_multiplier} onChange={(event) => setEmployeeForm({ ...employeeForm, overtime_rate_multiplier: event.target.value })} /></label>
                          <label>{text.labels.nightOvertimeMultiplier}<input min={0} step="0.05" type="number" value={employeeForm.night_rate_multiplier} onChange={(event) => setEmployeeForm({ ...employeeForm, night_rate_multiplier: event.target.value })} /></label>
                          <label>{text.labels.holidayOvertimeMultiplier}<input min={0} step="0.05" type="number" value={employeeForm.holiday_rate_multiplier} onChange={(event) => setEmployeeForm({ ...employeeForm, holiday_rate_multiplier: event.target.value })} /></label>
                        </div>
                      </section>

                      <section className="staff-hr-form-section">
                        <h5>{text.labels.bankTransfer}</h5>
                        <div className="form-grid compact-form-grid">
                          <label>{text.labels.employeeContributionRate}<input min={0} step="0.1" type="number" value={employeeForm.employee_contribution_rate} onChange={(event) => setEmployeeForm({ ...employeeForm, employee_contribution_rate: event.target.value })} /></label>
                          <label>{text.labels.employerContributionRate}<input min={0} step="0.1" type="number" value={employeeForm.employer_contribution_rate} onChange={(event) => setEmployeeForm({ ...employeeForm, employer_contribution_rate: event.target.value })} /></label>
                          <label>{text.labels.pitWithholdingRate}<input min={0} step="0.1" type="number" value={employeeForm.pit_withholding_rate} onChange={(event) => setEmployeeForm({ ...employeeForm, pit_withholding_rate: event.target.value })} /></label>
                          <label>{text.labels.dependentsCount}<input min={0} step="1" type="number" value={employeeForm.dependents_count} onChange={(event) => setEmployeeForm({ ...employeeForm, dependents_count: event.target.value })} /></label>
                          <label>{text.labels.bankName}<input value={employeeForm.bank_name} onChange={(event) => setEmployeeForm({ ...employeeForm, bank_name: event.target.value })} /></label>
                          <label>{text.labels.bankAccount}<input value={employeeForm.bank_account_number} onChange={(event) => setEmployeeForm({ ...employeeForm, bank_account_number: event.target.value })} /></label>
                          <label>{text.labels.taxCodeEmployee}<input value={employeeForm.tax_code} onChange={(event) => setEmployeeForm({ ...employeeForm, tax_code: event.target.value })} /></label>
                          <label>{text.labels.socialInsurance}<input value={employeeForm.social_insurance_number} onChange={(event) => setEmployeeForm({ ...employeeForm, social_insurance_number: event.target.value })} /></label>
                        </div>
                      </section>

                      <section className="staff-hr-form-section">
                        <h5>{text.labels.personalPhone}</h5>
                        <div className="form-grid compact-form-grid">
                          <label>{text.labels.personalPhone}<PhoneNumberInput buttonLabel={sharedText.countryCode} className="staff-phone-control" inputLabel={text.labels.personalPhone} onChange={(phone) => setEmployeeForm({ ...employeeForm, personal_phone: phone })} searchPlaceholder={sharedText.searchCountry} value={employeeForm.personal_phone} /></label>
                          <label>{text.labels.personalEmail}<input value={employeeForm.personal_email} onChange={(event) => setEmployeeForm({ ...employeeForm, personal_email: event.target.value })} /></label>
                          <label className="full">{text.labels.address}<input value={employeeForm.address} onChange={(event) => setEmployeeForm({ ...employeeForm, address: event.target.value })} /></label>
                          <label className="full">{text.labels.emergencyContact}<input value={employeeForm.emergency_contact} onChange={(event) => setEmployeeForm({ ...employeeForm, emergency_contact: event.target.value })} /></label>
                          <label className="full">{text.labels.payrollNote}<textarea value={employeeForm.payroll_note} onChange={(event) => setEmployeeForm({ ...employeeForm, payroll_note: event.target.value })} /></label>
                        </div>
                      </section>
                    </div>
                    <div className="staff-hr-document-section">
                      <div className="staff-hr-panel-head compact">
                        <div>
                          <h5>{text.labels.attachmentList}</h5>
                        </div>
                        <strong>{selectedEmployeeDocuments.length}</strong>
                      </div>
                      <div className="staff-hr-document-actions">
                        <label className="staff-file-action">
                          <FileText aria-hidden="true" size={15} />
                          <span>{hrDocumentUploading === 'profile_photo' ? text.loading : text.actions.uploadPhoto}</span>
                          <small>{text.messages.profilePhotoHelp}</small>
                          <input accept={staffProfilePhotoTypes.join(',')} disabled={Boolean(hrDocumentUploading)} type="file" onChange={(event) => void handleHrDocumentUpload(event, 'profile_photo')} />
                        </label>
                        <label className="staff-file-action">
                          <FileCheck2 aria-hidden="true" size={15} />
                          <span>{hrDocumentUploading === 'cv' ? text.loading : text.actions.uploadCv}</span>
                          <small>{text.messages.cvHelp}</small>
                          <input accept={staffCvTypes.join(',')} disabled={Boolean(hrDocumentUploading)} type="file" onChange={(event) => void handleHrDocumentUpload(event, 'cv')} />
                        </label>
                        <div className="staff-hr-document-list">
                          {selectedEmployeeDocuments.length > 0 ? selectedEmployeeDocuments.slice(0, 4).map((document: any) => (
                            <span key={document.id}>{text.hrTabs.employees}: {document.file_name}</span>
                          )) : <span>{text.messages.noHrDocuments}</span>}
                        </div>
                      </div>
                    </div>
                    <label className="staff-checkbox-row staff-employee-active-row">
                      <input type="checkbox" checked={employeeForm.active} onChange={(event) => setEmployeeForm({ ...employeeForm, active: event.target.checked })} />
                      <span>{text.labels.activeEmployee}</span>
                    </label>
                  </fieldset>
                </div>
              )}

              {hrTab === 'schedule' && (
                <div className="staff-hr-schedule-stack">
                  <div className="staff-operations-actions staff-attendance-actions staff-hr-week-controls">
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
                    <button type="button" onClick={resetAttendanceRangeToThisWeek}>
                      <ButtonIconText icon={<CalendarDays aria-hidden="true" size={14} />}>{text.actions.today}</ButtonIconText>
                    </button>
                    <button type="button" onClick={() => shiftAttendanceRange(attendanceWeekDates.length)}>
                      <ButtonIconText icon={<ChevronRight aria-hidden="true" size={14} />}>{text.actions.nextWeek}</ButtonIconText>
                    </button>
                  </div>
                  <section className="staff-planning-panel staff-hr-planning-panel" aria-label={text.labels.weeklySchedule}>
                    <div className="staff-planning-toolbar">
                      <div className="staff-planning-title">
                        <strong>{text.labels.weeklySchedule}</strong>
                        <span>{text.messages.planningGridHelp}</span>
                      </div>
                      <div className="staff-planning-scope" role="group" aria-label={text.labels.scheduleScope}>
                        {attendanceScheduleScopeOptions.map((scope: any) => (
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
                      <label>
                        {text.labels.shiftTemplate}
                        <select value={selectedShiftTemplate} onChange={(event) => applyShiftTemplate(event.target.value)} disabled={!canManageAttendance}>
                          {effectiveShiftTemplates.map((template: any) => <option key={template.id} value={template.id}>{text.shiftTemplates[template.id]}</option>)}
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
                        <div className="staff-planning-grid" role="grid" aria-label={text.labels.weeklySchedule} style={attendanceGridStyle}>
                          <div className="staff-planning-corner" role="columnheader">{text.labels.staffMember}</div>
                          {attendanceWeekDates.map((dateValue: string) => (
                            <div className="staff-planning-day" role="columnheader" key={dateValue}>
                              <strong>{shortDateLabel(dateValue)}</strong>
                              <span>{text.reportWeekdays[(dateFromInput(dateValue).getDay() + 6) % 7]}</span>
                            </div>
                          ))}
                          {visibleScheduleStaffProfileOptions.map((staffProfile: any) => {
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
                                        const shift = visibleScheduleAttendanceShifts.find((item: any) => item.id === draggingShiftId)
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
                                      {cellShifts.map((shift: any) => {
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
                      {visibleScheduleAttendanceShifts.map((shift: any) => {
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
                      <fieldset className="staff-readonly-fieldset staff-attendance-form" disabled={!canManageAttendance}>
                        <h4>{text.labels.weeklySchedule}</h4>
                        <div className="form-grid compact-form-grid">
                          <label>
                            {text.labels.staffMember}
                            <select value={shiftForm.staff_profile_id || firstScheduleStaffProfileId} onChange={(event) => setShiftForm({ ...shiftForm, staff_profile_id: event.target.value })}>
                              {visibleScheduleStaffProfileOptions.map((item: any) => <option key={item.id} value={item.id}>{customerName(item, text)}</option>)}
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
                          <label>{text.labels.location}<input value={shiftForm.location} onChange={(event) => setShiftForm({ ...shiftForm, location: event.target.value })} /></label>
                          <label>{text.labels.status}<select value={shiftForm.status} onChange={(event) => setShiftForm({ ...shiftForm, status: event.target.value })}>{staffShiftStatuses.map((status: any) => <option key={status} value={status}>{text.shiftStatuses[status]}</option>)}</select></label>
                          <label className="full">{text.labels.notes}<textarea value={shiftForm.notes} onChange={(event) => setShiftForm({ ...shiftForm, notes: event.target.value })} /></label>
                        </div>
                        <button className="primary" type="button" disabled={saving || !(shiftForm.staff_profile_id || firstScheduleStaffProfileId)} onClick={saveShift}>
                          <ButtonIconText icon={<Save aria-hidden="true" size={15} />}>{text.actions.saveShift}</ButtonIconText>
                        </button>
                      </fieldset>
                    )}
                  </div>
                </div>
              )}

              {hrTab === 'timesheet' && (
                <div className="staff-hr-table-panel">
                  <div className="staff-hr-panel-head">
                    <div>
                      <h4>{text.hrTabs.timesheet}</h4>
                      <p className="staff-helper-text">{rangeLabel(payrollPeriodStart, payrollPeriodEnd)}</p>
                    </div>
                    <strong>{visibleStaffProfileOptions.length}</strong>
                  </div>
                  <div className="staff-table-wrap">
                    <table className="staff-table staff-attendance-table">
                    <thead>
                      <tr>
                        <th>{text.labels.staffMember}</th>
                        <th>{text.labels.workedHours}</th>
                        <th>{text.labels.regularHours}</th>
                        <th>{text.labels.overtimeHours}</th>
                        <th>{text.labels.nightHours}</th>
                        <th>{text.labels.holidayHours}</th>
                        <th>{text.labels.leaveBalance}</th>
                        <th>{text.labels.grossIncome}</th>
                        <th>{text.labels.netIncome}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleStaffProfileOptions.map((staffProfile: any) => {
                        const calculation = staffPayrollCalculations.get(staffProfile.id) || emptyStaffPayrollCalculation(staffProfile.id)
                        return (
                          <tr key={staffProfile.id}>
                            <td>{customerName(staffProfile, text)}</td>
                            <td>{hoursLabel(calculation.workedMinutes)}</td>
                            <td>{hoursLabel(calculation.regularMinutes)}</td>
                            <td>{hoursLabel(calculation.overtimeMinutes)}</td>
                            <td>{hoursLabel(calculation.nightMinutes)}</td>
                            <td>{hoursLabel(calculation.holidayMinutes)}</td>
                            <td>{Number(calculation.leaveBalanceDays.toFixed(2))} {text.days}</td>
                            <td>{formatVnd(calculation.grossIncome)}</td>
                            <td>{formatVnd(calculation.netIncome)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    </table>
                  </div>
                </div>
              )}

              {hrTab === 'payroll' && (
                <div className="staff-attendance-layout staff-hr-payroll-layout">
                  <fieldset className="staff-readonly-fieldset staff-attendance-form" disabled={!canManageAttendance}>
                    <h4>{text.labels.payrollRun}</h4>
                    <div className="form-grid compact-form-grid">
                      <label>{text.labels.payrollCode}<input value={payrollRunForm.code} onChange={(event) => setPayrollRunForm({ ...payrollRunForm, code: event.target.value })} /></label>
                      <label>{text.labels.payrollName}<input value={payrollRunForm.name} onChange={(event) => setPayrollRunForm({ ...payrollRunForm, name: event.target.value })} /></label>
                      <label>{text.labels.payCycle}<select value={payrollRunForm.pay_cycle} onChange={(event) => setPayrollRunForm({ ...payrollRunForm, pay_cycle: normalizePayrollPayCycle(event.target.value) })}>{staffPayrollPayCycles.map((cycle: any) => <option key={cycle} value={cycle}>{text.payrollPayCycles[cycle]}</option>)}</select></label>
                      <label>{text.labels.periodStart}<StaffPickerField ariaLabel={text.labels.periodStart} placeholder={text.chooseDate} type="date" value={payrollRunForm.period_start} onChange={(value: string) => setPayrollRunForm({ ...payrollRunForm, period_start: value })} /></label>
                      <label>{text.labels.periodEnd}<StaffPickerField ariaLabel={text.labels.periodEnd} placeholder={text.chooseDate} type="date" value={payrollRunForm.period_end} onChange={(value: string) => setPayrollRunForm({ ...payrollRunForm, period_end: value })} /></label>
                      <label className="full">{text.labels.notes}<textarea value={payrollRunForm.notes} onChange={(event) => setPayrollRunForm({ ...payrollRunForm, notes: event.target.value })} /></label>
                    </div>
                    <div className="staff-summary-grid staff-employee-summary staff-hr-pay-summary">
                      <div><span>{text.labels.totalGross}</span><strong>{formatVnd(hrPayrollTotals.gross)}</strong></div>
                      <div><span>{text.labels.totalNet}</span><strong>{formatVnd(hrPayrollTotals.net)}</strong></div>
                      <div><span>{text.labels.totalCompanyCost}</span><strong>{formatVnd(hrPayrollTotals.companyCost)}</strong></div>
                    </div>
                    <button className="primary" type="button" disabled={saving} onClick={generatePayrollRun}>
                      <ButtonIconText icon={<Save aria-hidden="true" size={15} />}>{text.actions.generatePayroll}</ButtonIconText>
                    </button>
                  </fieldset>
                  <div className="staff-attendance-list">
                    <h4>{text.labels.payslipPreview}</h4>
                    <div className="staff-hr-payslip">
                      <strong>{selectedEmployeeStaffProfile ? customerName(selectedEmployeeStaffProfile, text) : text.customerFallback}</strong>
                      <span>{rangeLabel(payrollPeriodStart, payrollPeriodEnd)}</span>
                      <dl>
                        <div><dt>{text.labels.grossIncome}</dt><dd>{formatVnd(employeePayrollSummary.grossIncome)}</dd></div>
                        <div><dt>{text.labels.employeeContributions}</dt><dd>{formatVnd(employeePayrollSummary.employeeContributions)}</dd></div>
                        <div><dt>{text.labels.pitWithheld}</dt><dd>{formatVnd(employeePayrollSummary.pitWithheld)}</dd></div>
                        <div><dt>{text.labels.netIncome}</dt><dd>{formatVnd(employeePayrollSummary.netIncome)}</dd></div>
                        <div><dt>{text.labels.companyCost}</dt><dd>{formatVnd(employeePayrollSummary.companyCost)}</dd></div>
                      </dl>
                      <button type="button" onClick={() => void downloadEmployeePayslip()}>
                        <ButtonIconText icon={<Download aria-hidden="true" size={14} />}>{text.actions.viewPayslip}</ButtonIconText>
                      </button>
                    </div>
                    <h4>{text.hrTabs.payroll}</h4>
                    {payrollRuns.map((run: any) => (
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
                          <span>{payrollItems.filter((item: any) => item.payroll_run_id === run.id).length} {text.hrTabs.employees}</span>
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
              )}

              {(hrTab === 'adjustments' || hrTab === 'advances') && (
                <div className="staff-attendance-layout">
                  <fieldset className="staff-readonly-fieldset staff-attendance-form" disabled={!canManageAttendance}>
                    <h4>{hrTab === 'advances' ? text.hrTabs.advances : text.hrTabs.adjustments}</h4>
                    <div className="form-grid compact-form-grid">
                      <label>{text.labels.staffMember}<select value={hrAdjustmentForm.profile_id || selectedEmployeeStaffId || firstEmployeeStaffProfileId} onChange={(event) => setHrAdjustmentForm({ ...hrAdjustmentForm, profile_id: event.target.value })}>{visibleAllStaffProfileOptions.map((item: any) => <option key={item.id} value={item.id}>{customerName(item, text)}</option>)}</select></label>
                      <label>{text.labels.type}<select value={hrAdjustmentForm.adjustment_type} onChange={(event) => setHrAdjustmentForm({ ...hrAdjustmentForm, adjustment_type: normalizeHrAdjustmentType(event.target.value) })}>{staffHrAdjustmentTypes.filter((type: any) => hrTab === 'advances' ? ['advance', 'debt', 'debt_repayment'].includes(type) : !['advance', 'debt', 'debt_repayment'].includes(type)).map((type: any) => <option key={type} value={type}>{text.adjustmentTypes[type]}</option>)}</select></label>
                      <label>{text.labels.name}<input value={hrAdjustmentForm.title} onChange={(event) => setHrAdjustmentForm({ ...hrAdjustmentForm, title: event.target.value })} /></label>
                      <label>{text.vndAmount}<input inputMode="numeric" value={formatDongInput(hrAdjustmentForm.amount_vnd)} onChange={(event) => setHrAdjustmentForm({ ...hrAdjustmentForm, amount_vnd: dongDigits(event.target.value) })} /></label>
                      <label>{text.labels.date}<StaffPickerField ariaLabel={text.labels.date} placeholder={text.chooseDate} type="date" value={hrAdjustmentForm.effective_date} onChange={(value: string) => setHrAdjustmentForm({ ...hrAdjustmentForm, effective_date: value })} /></label>
                      <label>{text.labels.status}<select value={hrAdjustmentForm.status} onChange={(event) => setHrAdjustmentForm({ ...hrAdjustmentForm, status: normalizeHrAdjustmentStatus(event.target.value) })}>{staffHrAdjustmentStatuses.map((statusValue: any) => <option key={statusValue} value={statusValue}>{text.adjustmentStatuses[statusValue]}</option>)}</select></label>
                      <label className="full">{text.labels.notes}<textarea value={hrAdjustmentForm.notes} onChange={(event) => setHrAdjustmentForm({ ...hrAdjustmentForm, notes: event.target.value })} /></label>
                    </div>
                    <button className="primary" type="button" disabled={saving || parseDong(hrAdjustmentForm.amount_vnd) <= 0} onClick={() => saveHrAdjustment(hrTab === 'advances' ? 'advance' : 'adjustment')}>
                      <ButtonIconText icon={<Save aria-hidden="true" size={15} />}>{text.actions.saveAdjustment}</ButtonIconText>
                    </button>
                  </fieldset>
                  <div className="staff-attendance-list">
                    {periodHrAdjustments.filter((item: any) => hrTab === 'advances' ? ['advance', 'debt', 'debt_repayment'].includes(item.adjustment_type) : !['advance', 'debt', 'debt_repayment'].includes(item.adjustment_type)).map((adjustment: any) => {
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
              )}

              {hrTab === 'settings' && (
                <div className="staff-attendance-layout staff-hr-settings-layout">
                  <fieldset className="staff-readonly-fieldset staff-attendance-form staff-attendance-settings" disabled={!canManageAttendance}>
                    <h4>{text.hrTabs.settings}</h4>
                    <div className="form-grid compact-form-grid">
                      <label>{text.labels.standardMonthlyDays}<input min={1} step="0.5" type="number" value={hrSettings.standard_monthly_days} onChange={(event) => setHrSettings({ ...hrSettings, standard_monthly_days: Number(event.target.value) || 26 })} /></label>
                      <label>{text.labels.standardMonthlyHours}<input min={1} step="0.5" type="number" value={hrSettings.standard_monthly_hours} onChange={(event) => setHrSettings({ ...hrSettings, standard_monthly_hours: Number(event.target.value) || 208 })} /></label>
                      <label>{text.labels.restPeriodHours}<input min={0} step="0.25" type="number" value={Number((hrSettings.rest_period_minutes / 60).toFixed(2))} onChange={(event) => setHrSettings({ ...hrSettings, rest_period_minutes: Math.round((Number(event.target.value) || 0) * 60) })} /></label>
                      <label>{text.labels.normalOvertimeMultiplier}<input min={0} step="0.05" type="number" value={hrSettings.normal_overtime_multiplier} onChange={(event) => setHrSettings({ ...hrSettings, normal_overtime_multiplier: Number(event.target.value) || 0 })} /></label>
                      <label>{text.labels.nightOvertimeMultiplier}<input min={0} step="0.05" type="number" value={hrSettings.night_overtime_multiplier} onChange={(event) => setHrSettings({ ...hrSettings, night_overtime_multiplier: Number(event.target.value) || 0 })} /></label>
                      <label>{text.labels.holidayOvertimeMultiplier}<input min={0} step="0.05" type="number" value={hrSettings.holiday_overtime_multiplier} onChange={(event) => setHrSettings({ ...hrSettings, holiday_overtime_multiplier: Number(event.target.value) || 0 })} /></label>
                      <label>{text.labels.lunchAllowance}<input inputMode="numeric" value={formatDongInput(hrSettings.lunch_allowance_vnd)} onChange={(event) => setHrSettings({ ...hrSettings, lunch_allowance_vnd: parseDong(event.target.value) })} /></label>
                      <label>{text.labels.annualLeaveDays}<input min={0} step="0.5" type="number" value={hrSettings.annual_leave_days} onChange={(event) => setHrSettings({ ...hrSettings, annual_leave_days: Number(event.target.value) || 0 })} /></label>
                      <label>{text.labels.employeeContributionRate}<input min={0} step="0.1" type="number" value={hrSettings.employee_contribution_rate} onChange={(event) => setHrSettings({ ...hrSettings, employee_contribution_rate: Number(event.target.value) || 0 })} /></label>
                      <label>{text.labels.employerContributionRate}<input min={0} step="0.1" type="number" value={hrSettings.employer_contribution_rate} onChange={(event) => setHrSettings({ ...hrSettings, employer_contribution_rate: Number(event.target.value) || 0 })} /></label>
                      <label>{text.labels.pitWithholdingRate}<input min={0} step="0.1" type="number" value={hrSettings.pit_withholding_rate} onChange={(event) => setHrSettings({ ...hrSettings, pit_withholding_rate: Number(event.target.value) || 0 })} /></label>
                      <label className="full">{text.labels.payrollNote}<textarea value={hrSettings.payslip_note || ''} onChange={(event) => setHrSettings({ ...hrSettings, payslip_note: event.target.value })} /></label>
                    </div>
                    <button className="primary" type="button" disabled={saving} onClick={saveHrSettings}>
                      <ButtonIconText icon={<Save aria-hidden="true" size={15} />}>{text.actions.saveHrSettings}</ButtonIconText>
                    </button>
                  </fieldset>
                  <div className="staff-attendance-form">
                    <h4>{text.labels.rule}</h4>
                    {staffHrSetupOptionTypes.map((optionType: any) => (
                      <div className="staff-hr-setup-row" key={optionType}>
                        <label>
                          {text.hrSetupOptionTypes[optionType]}
                          <input value={hrSetupForm[optionType]} onChange={(event) => setHrSetupForm((current: any) => ({ ...current, [optionType]: event.target.value }))} />
                        </label>
                        <button type="button" disabled={saving || !hrSetupForm[optionType].trim() || !canManageAttendance} onClick={() => saveHrSetupOption(optionType)}>
                          <ButtonIconText icon={<Plus aria-hidden="true" size={14} />}>{text.actions.saveSetupOption}</ButtonIconText>
                        </button>
                        <p>{(hrOptionsByType.get(optionType) || []).map((option: any) => option.name).join(' · ') || text.noneYet}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
                </div>
              </div>
            </>
          )}
        </div>

  )
}
