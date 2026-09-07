'use client'

import { employeeHomeLocation } from '@/lib/staffCostAllocation'
import type { StaffEmployeeRecordEmploymentType } from '@/lib/staffEmployeeRecord'
import {
  ChevronDown,
  CircleCheckBig,
  ExternalLink,
  KeyRound,
  Pencil,
  RefreshCw,
  Save,
  Send,
  Smartphone,
  UserPlus,
  X
} from 'lucide-react'
import { ButtonIconText } from '../../components/BookingWidgetUi'
import { PhoneNumberInput } from '../../components/CountryCodePicker'
import { StaffPickerField } from '../../components/staff/StaffPickerField'
import { StaffRoleAvatar } from '../../components/staff/StaffRoleAvatar'
import { StaffCostAssignments } from '../../components/StaffCostAssignments'
import { hoursLabel } from '../../lib/staff/dates'
import { dongDigits, formatDongInput, formatVnd } from '../../lib/staff/formatting'
import type { StaffHrModel } from '../../lib/staff/hrModel'
import { normalizeStaffContractStatus, normalizeStaffEmploymentType } from '../../lib/staff/hrSettings'
import {
  staffEmploymentTypes,
  staffGenderOptions,
  staffProfilePhotoTypes
} from '../../lib/staff/options'
import { customerName } from '../../lib/staff/profiles'
import { CollapsibleEmployeeSection, EmployeeDirectoryStatus, EmployeeProfileSectionId, employeeExperienceCopy } from './presentation'

export type EmployeesSectionProps = {
  employeeCopy: (typeof employeeExperienceCopy)["en" | "vi"]
  toggleAllEmployeeSections: () => void
  allEmployeeSectionsOpen: boolean
  isOwnerOrAdmin: StaffHrModel['access']['isOwnerOrAdmin']
  setCreateEmployeeStatus: React.Dispatch<React.SetStateAction<string>>
  setCreateEmployeeStatusTone: React.Dispatch<React.SetStateAction<"error" | "success">>
  setCreateEmployeeOpen: React.Dispatch<React.SetStateAction<boolean>>
  createEmployeeStatus: string
  createEmployeeStatusTone: "error" | "success"
  createEmployeeOpen: boolean
  text: StaffHrModel['shared']['text']
  newEmployee: { email: string; employmentType: "full_time" | "part_time" | "contractor" | "intern" | "probation_full_time" | "probation_part_time"; fullName: string; phone: string }
  setNewEmployee: React.Dispatch<React.SetStateAction<{ email: string; employmentType: "full_time" | "part_time" | "contractor" | "intern" | "probation_full_time" | "probation_part_time"; fullName: string; phone: string }>>
  sharedText: StaffHrModel['shared']['sharedText']
  createEmployeeSaving: boolean
  submitNewEmployee: () => Promise<void>
  filteredEmployeeProfileOptions: import("../../lib/staff/types").StaffProfile[]
  selectedEmployeeOutsideFilters: boolean
  selectedEmployeeStaffId: StaffHrModel['employees']['selectedEmployeeStaffId']
  editEmployeeProfile: StaffHrModel['employees']['editEmployeeProfile']
  groupedEmployeeOptions: { label: string; employees: import("../../lib/staff/types").StaffProfile[] }[]
  employeeProfileById: StaffHrModel['employees']['employeeProfileById']
  employeeDirectoryGroup: string
  updateEmployeeDirectoryFilters: ({ group, location, status, }: { group?: string | undefined; location?: string | undefined; status?: EmployeeDirectoryStatus | undefined }) => void
  employeeDirectoryGroups: string[]
  employeeDirectoryLocation: string
  employeeDirectoryLocations: string[]
  employeeDirectoryStatus: EmployeeDirectoryStatus
  employeeDirectoryCounts: { active: number; terminated: number }
  visibleAllStaffProfileOptions: StaffHrModel['employees']['visibleAllStaffProfileOptions']
  employeeDirectoryFiltersActive: boolean
  canEditEmployeeProfiles: StaffHrModel['access']['canEditEmployeeProfiles']
  selectedEmployeeStaffProfile: StaffHrModel['employees']['selectedEmployeeStaffProfile']
  hrDocumentUploading: StaffHrModel['employees']['hrDocumentUploading']
  handleHrDocumentUpload: StaffHrModel['employees']['handleHrDocumentUpload']
  saving: StaffHrModel['shared']['saving']
  saveEmployeeProfile: StaffHrModel['employees']['saveEmployeeProfile']
  employeePayrollSummary: StaffHrModel['employees']['employeePayrollSummary']
  hrJobTitleOptions: StaffHrModel['settings']['hrJobTitleOptions']
  toggleEmployeeSection: (section: EmployeeProfileSectionId) => void
  openEmployeeSections: Record<EmployeeProfileSectionId, boolean>
  employeeForm: StaffHrModel['employees']['employeeForm']
  setEmployeeForm: StaffHrModel['employees']['setEmployeeForm']
  hrDepartmentOptions: StaffHrModel['settings']['hrDepartmentOptions']
  hrLocationOptions: StaffHrModel['settings']['hrLocationOptions']
  enabledEmploymentTypes: import("../../lib/staff/types").StaffEmploymentType[]
  enabledContractStatuses: import("../../lib/staff/types").StaffContractStatus[]
  hrContractTypeOptions: StaffHrModel['settings']['hrContractTypeOptions']
  costAssignments: StaffHrModel['payroll']['costAssignments']
  resolvedLanguage: StaffHrModel['shared']['resolvedLanguage']
  reloadCostAssignments: StaffHrModel['payroll']['reloadCostAssignments']
  hrSettings: StaffHrModel['settings']['hrSettings']
  canRevealEmployeeKioskPin: StaffHrModel['access']['canRevealEmployeeKioskPin']
  employeeKioskEligible: boolean
  canManageEmployeeKioskPins: StaffHrModel['access']['canManageEmployeeKioskPins']
  employeeKioskAccessRole: StaffHrModel['employees']['employeeKioskAccessRole']
  setEmployeeKioskAccessRole: StaffHrModel['employees']['setEmployeeKioskAccessRole']
  employeeKioskPinLoading: StaffHrModel['employees']['employeeKioskPinLoading']
  employeeKioskPinVisibleValue: StaffHrModel['employees']['employeeKioskPinVisibleValue']
  savedEmployeeEmail: string
  employeeKioskPinEmailState: StaffHrModel['employees']['employeeKioskPinEmailState']
  employeeKioskPinEmailRecipient: StaffHrModel['employees']['employeeKioskPinEmailRecipient']
  sendEmployeeKioskPinEmail: StaffHrModel['employees']['sendEmployeeKioskPinEmail']
  generateEmployeeKioskPin: StaffHrModel['employees']['generateEmployeeKioskPin']
  employeeKioskPin: StaffHrModel['employees']['employeeKioskPin']
  setEmployeeKioskPin: StaffHrModel['employees']['setEmployeeKioskPin']
  employeeKioskPinConfirm: StaffHrModel['employees']['employeeKioskPinConfirm']
  setEmployeeKioskPinConfirm: StaffHrModel['employees']['setEmployeeKioskPinConfirm']
  employeeKioskPinSaveConfirmation: StaffHrModel['employees']['employeeKioskPinSaveConfirmation']
  configureEmployeeKioskPin: StaffHrModel['employees']['configureEmployeeKioskPin']
  selectedEmployeeDocuments: StaffHrModel['employees']['selectedEmployeeDocuments']
}

export default function EmployeesSection({
  employeeCopy,
  toggleAllEmployeeSections,
  allEmployeeSectionsOpen,
  isOwnerOrAdmin,
  setCreateEmployeeStatus,
  setCreateEmployeeStatusTone,
  setCreateEmployeeOpen,
  createEmployeeStatus,
  createEmployeeStatusTone,
  createEmployeeOpen,
  text,
  newEmployee,
  setNewEmployee,
  sharedText,
  createEmployeeSaving,
  submitNewEmployee,
  filteredEmployeeProfileOptions,
  selectedEmployeeOutsideFilters,
  selectedEmployeeStaffId,
  editEmployeeProfile,
  groupedEmployeeOptions,
  employeeProfileById,
  employeeDirectoryGroup,
  updateEmployeeDirectoryFilters,
  employeeDirectoryGroups,
  employeeDirectoryLocation,
  employeeDirectoryLocations,
  employeeDirectoryStatus,
  employeeDirectoryCounts,
  visibleAllStaffProfileOptions,
  employeeDirectoryFiltersActive,
  canEditEmployeeProfiles,
  selectedEmployeeStaffProfile,
  hrDocumentUploading,
  handleHrDocumentUpload,
  saving,
  saveEmployeeProfile,
  employeePayrollSummary,
  hrJobTitleOptions,
  toggleEmployeeSection,
  openEmployeeSections,
  employeeForm,
  setEmployeeForm,
  hrDepartmentOptions,
  hrLocationOptions,
  enabledEmploymentTypes,
  enabledContractStatuses,
  hrContractTypeOptions,
  costAssignments,
  resolvedLanguage,
  reloadCostAssignments,
  hrSettings,
  canRevealEmployeeKioskPin,
  employeeKioskEligible,
  canManageEmployeeKioskPins,
  employeeKioskAccessRole,
  setEmployeeKioskAccessRole,
  employeeKioskPinLoading,
  employeeKioskPinVisibleValue,
  savedEmployeeEmail,
  employeeKioskPinEmailState,
  employeeKioskPinEmailRecipient,
  sendEmployeeKioskPinEmail,
  generateEmployeeKioskPin,
  employeeKioskPin,
  setEmployeeKioskPin,
  employeeKioskPinConfirm,
  setEmployeeKioskPinConfirm,
  employeeKioskPinSaveConfirmation,
  configureEmployeeKioskPin,
  selectedEmployeeDocuments,
}: EmployeesSectionProps) {
  return (
    <div className="staff-attendance-layout staff-employee-layout staff-hr-employee-layout staff-hr-employee-layout-single">
      <div className="staff-hr-employee-commandbar">
        <div>
          <h3>{employeeCopy.employeeProfiles}</h3>
          <p>{employeeCopy.employeeProfilesHelp}</p>
        </div>
        <div className="staff-hr-employee-command-actions">
          <button className="secondary" type="button" onClick={toggleAllEmployeeSections}>
            <ChevronDown aria-hidden="true" className={allEmployeeSectionsOpen ? 'is-expanded' : ''} size={17} />
            {allEmployeeSectionsOpen ? employeeCopy.collapseAll : employeeCopy.expandAll}
          </button>
          {isOwnerOrAdmin && <button className="primary" type="button" onClick={() => {
            setCreateEmployeeStatus('')
            setCreateEmployeeStatusTone('success')
            setCreateEmployeeOpen(true)
          }}>
            <UserPlus aria-hidden="true" size={17} />
            {employeeCopy.createEmployee}
          </button>}
        </div>
      </div>

      {createEmployeeStatus && <p className={`staff-hr-employee-create-status ${createEmployeeStatusTone}`} role="status">{createEmployeeStatus}</p>}

      {createEmployeeOpen && (
        <section className="staff-hr-employee-create-panel" aria-labelledby="staff-create-employee-title">
          <header>
            <span className="staff-hr-employee-create-icon"><UserPlus aria-hidden="true" size={22} /></span>
            <div>
              <h4 id="staff-create-employee-title">{employeeCopy.createEmployee}</h4>
              <p>{employeeCopy.createHelp}</p>
            </div>
            <button aria-label={text.actions.cancel} className="staff-icon-button" type="button" onClick={() => setCreateEmployeeOpen(false)}>
              <X aria-hidden="true" size={18} />
            </button>
          </header>
          <p className="staff-hr-employee-create-intro">{employeeCopy.createIntro}</p>
          <div className="form-grid compact-form-grid staff-hr-employee-create-fields">
            <label>
              {employeeCopy.fullName}
              <input autoComplete="name" placeholder="Nguyen Van A" value={newEmployee.fullName} onChange={(event) => setNewEmployee((current) => ({ ...current, fullName: event.target.value }))} />
            </label>
            <label>
              {employeeCopy.workEmail}
              <input autoComplete="email" placeholder="employee@example.com" type="email" value={newEmployee.email} onChange={(event) => setNewEmployee((current) => ({ ...current, email: event.target.value }))} />
            </label>
            <label>
              {employeeCopy.phone}
              <PhoneNumberInput buttonLabel={sharedText.countryCode} className="staff-phone-control" inputLabel={employeeCopy.phone} onChange={(phone) => setNewEmployee((current) => ({ ...current, phone }))} searchPlaceholder={sharedText.searchCountry} value={newEmployee.phone} />
            </label>
            <label>
              {employeeCopy.employmentType}
              <select value={newEmployee.employmentType} onChange={(event) => setNewEmployee((current) => ({ ...current, employmentType: event.target.value as StaffEmployeeRecordEmploymentType }))}>
                {staffEmploymentTypes.map((item) => <option key={item} value={item}>{text.employmentTypes[item]}</option>)}
              </select>
            </label>
          </div>
          <footer>
            <button className="secondary" type="button" onClick={() => setCreateEmployeeOpen(false)}>{text.actions.cancel}</button>
            <button className="primary" disabled={createEmployeeSaving || !newEmployee.fullName.trim()} type="button" onClick={() => void submitNewEmployee()}>
              {createEmployeeSaving ? <RefreshCw aria-hidden="true" className="staff-spin" size={17} /> : <Save aria-hidden="true" size={17} />}
              {createEmployeeSaving ? employeeCopy.creating : employeeCopy.saveRecord}
            </button>
          </footer>
        </section>
      )}

      <section className="staff-hr-employee-navigator" aria-label={employeeCopy.employeeProfiles}>
        <div className="staff-hr-employee-filter-grid">
          <label className="staff-hr-employee-picker-filter" htmlFor="staff-employee-profile-picker">
            <span>{employeeCopy.employeePicker}</span>
            <select
              id="staff-employee-profile-picker"
              disabled={filteredEmployeeProfileOptions.length === 0}
              value={selectedEmployeeOutsideFilters ? '' : selectedEmployeeStaffId}
              onChange={(event) => {
                const staffProfile = filteredEmployeeProfileOptions.find((item) => item.id === event.target.value)
                if (staffProfile) editEmployeeProfile(staffProfile)
              }}
            >
              <option disabled value="">{filteredEmployeeProfileOptions.length === 0 ? employeeCopy.noEmployeeMatches : employeeCopy.selectEmployee}</option>
              {groupedEmployeeOptions.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.employees.map((item) => {
                    const employee = employeeProfileById.get(item.id)
                    const name = employee?.legal_name || customerName(item, text)
                    return <option key={item.id} value={item.id}>{name}{employee?.employee_code ? ` · ${employee.employee_code}` : ''}</option>
                  })}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            <span>{employeeCopy.groupFilter}</span>
            <select value={employeeDirectoryGroup} onChange={(event) => updateEmployeeDirectoryFilters({ group: event.target.value })}>
              <option value="all">{employeeCopy.allGroups}</option>
              {employeeDirectoryGroups.map((group) => <option key={group} value={group}>{group}</option>)}
            </select>
          </label>
          <label>
            <span>{employeeCopy.locationFilter}</span>
            <select value={employeeDirectoryLocation} onChange={(event) => updateEmployeeDirectoryFilters({ location: event.target.value })}>
              <option value="all">{employeeCopy.allLocations}</option>
              {employeeDirectoryLocations.map((location) => <option key={location} value={location}>{location}</option>)}
            </select>
          </label>
          <label>
            <span>{employeeCopy.statusFilter}</span>
            <select value={employeeDirectoryStatus} onChange={(event) => updateEmployeeDirectoryFilters({ status: event.target.value as StaffHrModel['schedule']['shiftForm']['status'] as EmployeeDirectoryStatus })}>
              <option value="active">{employeeCopy.activeStatus} ({employeeDirectoryCounts.active})</option>
              <option value="terminated">{employeeCopy.terminatedStatus} ({employeeDirectoryCounts.terminated})</option>
              <option value="all">{employeeCopy.allStatuses} ({visibleAllStaffProfileOptions.length})</option>
            </select>
          </label>
        </div>
        <div className="staff-hr-employee-filter-summary" aria-live="polite">
          <span>{employeeCopy.showingEmployees(filteredEmployeeProfileOptions.length, visibleAllStaffProfileOptions.length)}</span>
          {filteredEmployeeProfileOptions.length === 0 && <strong>{employeeCopy.noEmployeeMatches}</strong>}
          {employeeDirectoryFiltersActive && (
            <button type="button" onClick={() => {
              updateEmployeeDirectoryFilters({ group: 'all', location: 'all', status: 'active' })
            }}>
              <RefreshCw aria-hidden="true" size={14} />
              {employeeCopy.resetFilters}
            </button>
          )}
        </div>
      </section>

      {!selectedEmployeeOutsideFilters && <fieldset className="staff-readonly-fieldset staff-attendance-form staff-employee-form staff-hr-workspace" disabled={!canEditEmployeeProfiles || !selectedEmployeeStaffProfile}>
        {selectedEmployeeStaffProfile && (
          <div className="staff-employee-selected">
            <label className="staff-employee-photo-upload" title={text.actions.uploadPhoto}>
              <StaffRoleAvatar profile={selectedEmployeeStaffProfile} text={text} />
              <span className="staff-employee-photo-edit" aria-hidden="true">
                {hrDocumentUploading === 'profile_photo'
                  ? <RefreshCw className="staff-spin" size={13} />
                  : <Pencil size={13} />}
              </span>
              <input
                accept={staffProfilePhotoTypes.join(',')}
                aria-label={text.actions.uploadPhoto}
                disabled={Boolean(hrDocumentUploading) || !canEditEmployeeProfiles}
                type="file"
                onChange={(event) => void handleHrDocumentUpload(event, 'profile_photo')}
              />
            </label>
            <div className="staff-employee-selected-identity">
              <strong>{employeeProfileById.get(selectedEmployeeStaffId)?.legal_name || customerName(selectedEmployeeStaffProfile, text)}</strong>
              <span>
                {[
                  employeeProfileById.get(selectedEmployeeStaffId)?.job_title,
                  employeeProfileById.get(selectedEmployeeStaffId)?.department,
                  employeeProfileById.get(selectedEmployeeStaffId)?.main_work_location,
                  selectedEmployeeStaffProfile.email || selectedEmployeeStaffProfile.phone,
                ].filter(Boolean).join(' · ') || text.noContact}
              </span>
            </div>
            <button className="primary staff-employee-selected-save" type="button" disabled={saving || !canEditEmployeeProfiles} onClick={saveEmployeeProfile}>
              <ButtonIconText icon={<Save aria-hidden="true" size={15} />}>{text.actions.saveEmployeeProfile}</ButtonIconText>
            </button>
          </div>
        )}
        <div className="staff-summary-grid staff-employee-summary staff-hr-pay-summary">
          <div><span>{text.labels.scheduledHours}</span><strong>{hoursLabel(employeePayrollSummary.scheduledMinutes)}</strong></div>
          <div><span>{text.labels.workedHours}</span><strong>{hoursLabel(employeePayrollSummary.workedMinutes)}</strong></div>
          <div><span>{text.labels.grossIncome}</span><strong>{formatVnd(employeePayrollSummary.grossIncome)}</strong></div>
          <div><span>{text.labels.netIncome}</span><strong>{formatVnd(employeePayrollSummary.netIncome)}</strong></div>
        </div>
        <datalist id="staff-hr-job-title-options">{hrJobTitleOptions.map((option) => <option key={option.id} value={option.name} />)}</datalist>
        <div className="staff-hr-profile-form">
          <CollapsibleEmployeeSection description={employeeCopy.sectionHelp.identity} id="identity" onToggle={toggleEmployeeSection} open={openEmployeeSections.identity} title={employeeCopy.sectionTitles.identity}>
            <div className="form-grid compact-form-grid">
              <label>{text.labels.employeeCode}<input value={employeeForm.employee_code} onChange={(event) => setEmployeeForm({ ...employeeForm, employee_code: event.target.value })} /></label>
              <label>{text.labels.attendanceNumber}<input value={employeeForm.attendance_number} onChange={(event) => setEmployeeForm({ ...employeeForm, attendance_number: event.target.value })} /></label>
              <label>{text.labels.legalName}<input value={employeeForm.legal_name} onChange={(event) => setEmployeeForm({ ...employeeForm, legal_name: event.target.value })} /></label>
              <label>{text.labels.nationalId}<input value={employeeForm.national_id} onChange={(event) => setEmployeeForm({ ...employeeForm, national_id: event.target.value })} /></label>
              <label>{text.labels.dateOfBirth}<StaffPickerField ariaLabel={text.labels.dateOfBirth} placeholder={text.chooseDate} type="date" value={employeeForm.date_of_birth} onChange={(value: string) => setEmployeeForm({ ...employeeForm, date_of_birth: value })} /></label>
              <label>
                {text.labels.gender}
                <select value={employeeForm.gender} onChange={(event) => setEmployeeForm({ ...employeeForm, gender: event.target.value })}>
                  <option value="">{text.any}</option>
                  {staffGenderOptions.map((gender) => <option key={gender} value={gender}>{text.genderOptions[gender]}</option>)}
                </select>
              </label>
            </div>
          </CollapsibleEmployeeSection>

          <CollapsibleEmployeeSection description={employeeCopy.sectionHelp.contract} id="contract" onToggle={toggleEmployeeSection} open={openEmployeeSections.contract} title={employeeCopy.sectionTitles.contract}>
            <div className="form-grid compact-form-grid">
              <label>{text.labels.department}<select value={employeeForm.department} onChange={(event) => { const location = employeeHomeLocation(event.target.value); setEmployeeForm({ ...employeeForm, department: event.target.value, ...(location ? { main_work_location: location, payroll_location: location } : {}) }) }}><option value="">{text.any}</option>{employeeForm.department && !hrDepartmentOptions.some((option) => option.name === employeeForm.department) && <option value={employeeForm.department}>{employeeForm.department}</option>}{hrDepartmentOptions.map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}</select></label>
              <label>{text.labels.jobTitle}<select value={employeeForm.job_title} onChange={(event) => setEmployeeForm({ ...employeeForm, job_title: event.target.value })}><option value="">{text.any}</option>{employeeForm.job_title && !hrJobTitleOptions.some((option) => option.name === employeeForm.job_title) && <option value={employeeForm.job_title}>{employeeForm.job_title}</option>}{hrJobTitleOptions.map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}</select></label>
              <label>{text.labels.mainWorkLocation}<select disabled={Boolean(employeeHomeLocation(employeeForm.department))} value={employeeHomeLocation(employeeForm.department) || employeeForm.main_work_location} onChange={(event) => setEmployeeForm({ ...employeeForm, main_work_location: event.target.value })}><option value="">{text.any}</option>{employeeForm.main_work_location && !hrLocationOptions.some((option) => option.name === employeeForm.main_work_location) && <option value={employeeForm.main_work_location}>{employeeForm.main_work_location}</option>}{hrLocationOptions.map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}</select></label>
              <label>{text.labels.payrollLocation}<select value={employeeForm.payroll_location} onChange={(event) => setEmployeeForm({ ...employeeForm, payroll_location: event.target.value })}><option value="">{text.any}</option>{employeeForm.payroll_location && !hrLocationOptions.some((option) => option.name === employeeForm.payroll_location) && <option value={employeeForm.payroll_location}>{employeeForm.payroll_location}</option>}{hrLocationOptions.map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}</select></label>
              <label>
                {text.labels.employmentType}
                <select value={employeeForm.employment_type} onChange={(event) => setEmployeeForm({ ...employeeForm, employment_type: normalizeStaffEmploymentType(event.target.value) })}>
                  {enabledEmploymentTypes.map((item) => <option key={item} value={item}>{text.employmentTypes[item]}</option>)}
                </select>
              </label>
              <label>
                {text.labels.contractStatus}
                <select value={employeeForm.contract_status} onChange={(event) => setEmployeeForm({ ...employeeForm, contract_status: normalizeStaffContractStatus(event.target.value) })}>
                  {enabledContractStatuses.map((statusValue) => <option key={statusValue} value={statusValue}>{text.contractStatuses[statusValue]}</option>)}
                </select>
              </label>
              <label>{text.labels.contractType}<select value={employeeForm.contract_type} onChange={(event) => setEmployeeForm({ ...employeeForm, contract_type: event.target.value })}><option value="">{text.any}</option>{employeeForm.contract_type && !hrContractTypeOptions.some((option) => option.name === employeeForm.contract_type) && <option value={employeeForm.contract_type}>{employeeForm.contract_type}</option>}{hrContractTypeOptions.map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}</select></label>
              <label>{employeeCopy.probationPayrollType}<select value={employeeForm.probation_payroll_type} onChange={(event) => setEmployeeForm({ ...employeeForm, probation_payroll_type: event.target.value as StaffHrModel['employees']['employeeForm']['probation_payroll_type'] })}><option value="hourly">{employeeCopy.hourly}</option><option value="monthly">{employeeCopy.monthly}</option><option value="manager">{employeeCopy.manager}</option></select></label>
              <label>{employeeCopy.laborPayrollType}<select value={employeeForm.labor_payroll_type} onChange={(event) => setEmployeeForm({ ...employeeForm, labor_payroll_type: event.target.value as StaffHrModel['employees']['employeeForm']['labor_payroll_type'] })}><option value="hourly">{employeeCopy.hourly}</option><option value="monthly">{employeeCopy.monthly}</option><option value="manager">{employeeCopy.manager}</option></select></label>
              <label>{employeeCopy.probationSalaryPercentage}<select value={employeeForm.probation_salary_percentage} onChange={(event) => setEmployeeForm({ ...employeeForm, probation_salary_percentage: event.target.value })}><option value="85">85%</option><option value="100">100%</option></select></label>
              <label>{employeeCopy.probationBonusPercentage}<select value={employeeForm.probation_bonus_percentage} onChange={(event) => setEmployeeForm({ ...employeeForm, probation_bonus_percentage: event.target.value })}><option value="85">85%</option><option value="100">100%</option></select></label>
              <label>{employeeCopy.probationStart}<StaffPickerField ariaLabel={employeeCopy.probationStart} placeholder={text.chooseDate} type="date" value={employeeForm.probation_start_date} onChange={(value: string) => setEmployeeForm({ ...employeeForm, probation_start_date: value })} /></label>
              <label>{employeeCopy.probationEnd}<StaffPickerField ariaLabel={employeeCopy.probationEnd} placeholder={text.chooseDate} type="date" value={employeeForm.probation_end_date} onChange={(value: string) => setEmployeeForm({ ...employeeForm, probation_end_date: value })} /></label>
              <label>{employeeCopy.laborStart}<StaffPickerField ariaLabel={employeeCopy.laborStart} placeholder={text.chooseDate} type="date" value={employeeForm.labor_start_date} onChange={(value: string) => setEmployeeForm({ ...employeeForm, labor_start_date: value })} /></label>
              <label>{employeeCopy.laborEnd}<StaffPickerField ariaLabel={employeeCopy.laborEnd} placeholder={text.chooseDate} type="date" value={employeeForm.labor_end_date} onChange={(value: string) => setEmployeeForm({ ...employeeForm, labor_end_date: value })} /></label>
            </div>
          </CollapsibleEmployeeSection>

          <StaffCostAssignments key={selectedEmployeeStaffId} profileId={selectedEmployeeStaffId} homeLocation={employeeProfileById.get(selectedEmployeeStaffId)?.main_work_location || ''} assignments={costAssignments} canEdit={canEditEmployeeProfiles} language={resolvedLanguage} reload={reloadCostAssignments} />

          <CollapsibleEmployeeSection description={employeeCopy.sectionHelp.payroll} id="payroll" onToggle={toggleEmployeeSection} open={openEmployeeSections.payroll} title={employeeCopy.sectionTitles.payroll}>
            <div className="form-grid compact-form-grid">
              <label>{text.labels.monthlyGross}<input inputMode="numeric" value={formatDongInput(employeeForm.base_salary_vnd)} onChange={(event) => setEmployeeForm({ ...employeeForm, base_salary_vnd: dongDigits(event.target.value) })} /></label>
              <label>{text.labels.hourlyRate}<input inputMode="numeric" value={formatDongInput(employeeForm.hourly_rate_vnd)} onChange={(event) => setEmployeeForm({ ...employeeForm, hourly_rate_vnd: dongDigits(event.target.value) })} /></label>
              <label className="full">{employeeCopy.monthlyBonus}<input inputMode="numeric" value={formatDongInput(employeeForm.monthly_bonus_vnd)} onChange={(event) => setEmployeeForm({ ...employeeForm, monthly_bonus_vnd: dongDigits(event.target.value) })} /></label>
              <div className="staff-hr-policy-summary full">
                <div><strong>{employeeCopy.companyPolicy}</strong><span>{employeeCopy.companyPolicyHelp}</span></div>
                <dl><div><dt>{text.labels.lunchAllowance}</dt><dd>{formatVnd(hrSettings.lunch_allowance_vnd)}</dd></div><div><dt>{text.labels.restPeriodHours}</dt><dd>{Number((hrSettings.rest_period_minutes / 60).toFixed(2))}h</dd></div><div><dt>{text.labels.normalOvertimeMultiplier}</dt><dd>{hrSettings.normal_overtime_multiplier}×</dd></div><div><dt>{text.labels.nightOvertimeMultiplier}</dt><dd>{hrSettings.night_overtime_multiplier}×</dd></div><div><dt>{text.labels.holidayOvertimeMultiplier}</dt><dd>{hrSettings.holiday_overtime_multiplier}×</dd></div></dl>
              </div>
            </div>
          </CollapsibleEmployeeSection>

          <CollapsibleEmployeeSection description={employeeCopy.sectionHelp.bank} id="bank" onToggle={toggleEmployeeSection} open={openEmployeeSections.bank} title={employeeCopy.sectionTitles.bank}>
            <div className="form-grid compact-form-grid">
              <label>{text.labels.pitWithholdingRate}<input min={0} step="0.1" type="number" value={employeeForm.pit_withholding_rate} onChange={(event) => setEmployeeForm({ ...employeeForm, pit_withholding_rate: event.target.value })} /></label>
              <label>{text.labels.dependentsCount}<input min={0} step="1" type="number" value={employeeForm.dependents_count} onChange={(event) => setEmployeeForm({ ...employeeForm, dependents_count: event.target.value })} /></label>
              <label className="staff-checkbox-row"><input checked={employeeForm.social_insurance_enrolled} type="checkbox" onChange={(event) => setEmployeeForm({ ...employeeForm, social_insurance_enrolled: event.target.checked })} /><span>{employeeCopy.insuranceEnrolled}</span></label>
              <label>{employeeCopy.insuranceSalary}<input disabled={!employeeForm.social_insurance_enrolled} inputMode="numeric" value={formatDongInput(employeeForm.social_insurance_salary_vnd)} onChange={(event) => setEmployeeForm({ ...employeeForm, social_insurance_salary_vnd: dongDigits(event.target.value) })} /></label>
              <label>{text.labels.bankName}<input value={employeeForm.bank_name} onChange={(event) => setEmployeeForm({ ...employeeForm, bank_name: event.target.value })} /></label>
              <label>{text.labels.bankAccount}<input value={employeeForm.bank_account_number} onChange={(event) => setEmployeeForm({ ...employeeForm, bank_account_number: event.target.value })} /></label>
              <label>{text.labels.taxCodeEmployee}<input value={employeeForm.tax_code} onChange={(event) => setEmployeeForm({ ...employeeForm, tax_code: event.target.value })} /></label>
              <label>{text.labels.socialInsurance}<input value={employeeForm.social_insurance_number} onChange={(event) => setEmployeeForm({ ...employeeForm, social_insurance_number: event.target.value })} /></label>
            </div>
          </CollapsibleEmployeeSection>

          <CollapsibleEmployeeSection description={employeeCopy.sectionHelp.contact} id="contact" onToggle={toggleEmployeeSection} open={openEmployeeSections.contact} title={employeeCopy.sectionTitles.contact}>
            <div className="form-grid compact-form-grid">
              <label>{text.labels.personalPhone}<PhoneNumberInput buttonLabel={sharedText.countryCode} className="staff-phone-control" inputLabel={text.labels.personalPhone} onChange={(phone) => setEmployeeForm({ ...employeeForm, personal_phone: phone })} searchPlaceholder={sharedText.searchCountry} value={employeeForm.personal_phone} /></label>
              <label>{text.labels.personalEmail}<input value={employeeForm.personal_email} onChange={(event) => setEmployeeForm({ ...employeeForm, personal_email: event.target.value })} /></label>
              <label className="full">{text.labels.address}<input value={employeeForm.address} onChange={(event) => setEmployeeForm({ ...employeeForm, address: event.target.value })} /></label>
              <label>{employeeCopy.emergencyName}<input value={employeeForm.emergency_contact_name} onChange={(event) => setEmployeeForm({ ...employeeForm, emergency_contact_name: event.target.value })} /></label>
              <label>{employeeCopy.emergencyRelationship}<input value={employeeForm.emergency_contact_relationship} onChange={(event) => setEmployeeForm({ ...employeeForm, emergency_contact_relationship: event.target.value })} /></label>
              <label>{employeeCopy.emergencyPhone}<PhoneNumberInput buttonLabel={sharedText.countryCode} className="staff-phone-control" inputLabel={employeeCopy.emergencyPhone} onChange={(phone) => setEmployeeForm({ ...employeeForm, emergency_contact_phone: phone })} searchPlaceholder={sharedText.searchCountry} value={employeeForm.emergency_contact_phone} /></label>
              <label className="full">{text.labels.payrollNote}<textarea value={employeeForm.payroll_note} onChange={(event) => setEmployeeForm({ ...employeeForm, payroll_note: event.target.value })} /></label>
            </div>
          </CollapsibleEmployeeSection>

          {canRevealEmployeeKioskPin && employeeKioskEligible && <CollapsibleEmployeeSection description={employeeCopy.sectionHelp.store} id="store" onToggle={toggleEmployeeSection} open={openEmployeeSections.store} title={employeeCopy.sectionTitles.store}>
            <div className="staff-hr-kiosk-access">
              <div className="staff-hr-kiosk-access-head">
                <span className="staff-hr-kiosk-access-icon"><Smartphone aria-hidden="true" size={20} /></span>
                <div className="staff-hr-kiosk-access-copy">
                  <small>{resolvedLanguage === 'vi' ? 'Thông tin đăng nhập thiết bị dùng chung' : 'Shared-device credential'}</small>
                  <strong>{resolvedLanguage === 'vi' ? 'PIN nhân viên' : 'Employee PIN'}</strong>
                  <p>{resolvedLanguage === 'vi' ? 'Mã cá nhân 6 số xác định nhân viên trên thiết bị cửa hàng.' : 'A personal six-digit code identifies this employee on store devices.'}</p>
                </div>
                <span className={`staff-hr-kiosk-status ${employeeForm.kiosk_pin_configured_at ? 'configured' : ''}`}>
                  {employeeForm.kiosk_pin_configured_at ? <CircleCheckBig aria-hidden="true" size={14} /> : <KeyRound aria-hidden="true" size={14} />}
                  {employeeForm.kiosk_pin_configured_at
                    ? (resolvedLanguage === 'vi' ? 'Đã cấu hình' : 'Configured')
                    : (resolvedLanguage === 'vi' ? 'Chưa có PIN' : 'No PIN')}
                </span>
              </div>

              <div className="staff-hr-kiosk-fields">
                <div className="staff-hr-kiosk-overview">
                  <label className="staff-hr-kiosk-role">
                    <span>{resolvedLanguage === 'vi' ? 'Cấp quyền' : 'Access level'}</span>
                    <select disabled={!canManageEmployeeKioskPins} value={employeeKioskAccessRole} onChange={(event) => setEmployeeKioskAccessRole(event.target.value as 'manager' | 'staff')}>
                      <option value="staff">{resolvedLanguage === 'vi' ? 'Nhân viên' : 'Staff'}</option>
                      <option value="manager">{resolvedLanguage === 'vi' ? 'Quản lý' : 'Manager'}</option>
                    </select>
                    <small>{employeeKioskAccessRole === 'manager'
                      ? (resolvedLanguage === 'vi' ? 'Mở các công cụ quản lý cửa hàng và HR được cấp quyền.' : 'Unlocks the permitted store-management and HR tools.')
                      : (resolvedLanguage === 'vi' ? 'Dành cho hoạt động hàng ngày tại cửa hàng.' : 'For daily store operations.')}</small>
                  </label>

                  <div className="staff-hr-kiosk-current-pin">
                    <div className="staff-hr-kiosk-pin-heading">
                      <span id="staff-hr-current-pin-label">{resolvedLanguage === 'vi' ? 'PIN hiện tại' : 'Current PIN'}</span>
                      <small>{resolvedLanguage === 'vi' ? 'Thông tin bảo mật' : 'Protected credential'}</small>
                    </div>
                    <output aria-labelledby="staff-hr-current-pin-label" aria-live="polite">{employeeKioskPinLoading ? '••••••' : employeeKioskPinVisibleValue || '—'}</output>
                    <small>{employeeKioskPinLoading
                      ? (resolvedLanguage === 'vi' ? 'Đang giải mã PIN an toàn…' : 'Securely revealing PIN…')
                      : employeeKioskPinVisibleValue
                        ? (resolvedLanguage === 'vi' ? 'Chỉ Chủ sở hữu, Quản trị viên và Nhân viên văn phòng mới thấy PIN này.' : 'Visible only to Owner, Admin, and Office Staff.')
                        : (resolvedLanguage === 'vi' ? 'Chưa có PIN cho nhân viên này.' : 'No PIN is configured for this employee.')}</small>
                    <div className="staff-hr-kiosk-pin-delivery">
                      <div>
                        <strong>{resolvedLanguage === 'vi' ? 'Gửi PIN an toàn' : 'Secure PIN delivery'}</strong>
                        <small>{savedEmployeeEmail
                          ? (resolvedLanguage === 'vi' ? `Gửi tới email HR đã lưu: ${savedEmployeeEmail}` : `Send to the saved HR email: ${savedEmployeeEmail}`)
                          : (resolvedLanguage === 'vi' ? 'Lưu email cá nhân trong mục Liên hệ & ghi chú trước.' : 'Save a personal email in Contact & notes first.')}</small>
                        {employeeKioskPinEmailState === 'sent' && employeeKioskPinEmailRecipient && <small className="staff-hr-kiosk-email-recipient">
                          {resolvedLanguage === 'vi' ? `Đã gửi tới ${employeeKioskPinEmailRecipient}` : `Sent to ${employeeKioskPinEmailRecipient}`}
                        </small>}
                      </div>
                      <button
                        aria-live="polite"
                        className={`secondary staff-hr-kiosk-email ${employeeKioskPinEmailState === 'sent' ? 'is-confirmed' : ''}`}
                        disabled={employeeKioskPinEmailState !== 'idle' || employeeKioskPinLoading || !employeeForm.kiosk_pin_configured_at || !savedEmployeeEmail}
                        title={savedEmployeeEmail
                          ? (resolvedLanguage === 'vi' ? `Gửi PIN tới ${savedEmployeeEmail}` : `Send PIN to ${savedEmployeeEmail}`)
                          : (resolvedLanguage === 'vi' ? 'Lưu email cá nhân trước' : 'Save a personal email first')}
                        type="button"
                        onClick={() => void sendEmployeeKioskPinEmail(selectedEmployeeStaffId)}
                      >
                        {employeeKioskPinEmailState === 'sent' ? <CircleCheckBig aria-hidden="true" size={16} /> : <Send aria-hidden="true" size={16} />}
                        {employeeKioskPinEmailState === 'sending'
                          ? (resolvedLanguage === 'vi' ? 'Đang gửi…' : 'Sending…')
                          : employeeKioskPinEmailState === 'sent'
                            ? (resolvedLanguage === 'vi' ? 'Đã gửi email' : 'Email sent')
                            : (resolvedLanguage === 'vi' ? 'Gửi qua email' : 'Send by email')}
                      </button>
                    </div>
                  </div>
                </div>

                {canManageEmployeeKioskPins && <div className="staff-hr-kiosk-editor">
                  <div className="staff-hr-kiosk-editor-head">
                    <div>
                      <strong>{employeeForm.kiosk_pin_configured_at
                        ? (resolvedLanguage === 'vi' ? 'Đổi PIN' : 'Replace PIN')
                        : (resolvedLanguage === 'vi' ? 'Tạo PIN' : 'Create PIN')}</strong>
                      <small>{resolvedLanguage === 'vi' ? 'Nhập mã riêng hoặc tạo một mã bảo mật ngẫu nhiên.' : 'Enter a private code or generate a secure random one.'}</small>
                    </div>
                    <button className="secondary staff-hr-kiosk-generate" type="button" onClick={generateEmployeeKioskPin}>
                      <RefreshCw aria-hidden="true" size={16} />
                      {resolvedLanguage === 'vi' ? 'Tạo PIN ngẫu nhiên' : 'Generate random PIN'}
                    </button>
                  </div>
                  <div className="staff-hr-kiosk-pin-entry">
                    <label>
                      {resolvedLanguage === 'vi' ? 'PIN 6 số mới' : 'New 6-digit PIN'}
                      <input autoComplete="new-password" inputMode="numeric" maxLength={6} placeholder="••••••" type="password" value={employeeKioskPin} onChange={(event) => setEmployeeKioskPin(event.target.value.replace(/\D/g, '').slice(0, 6))} />
                    </label>
                    <label>
                      {resolvedLanguage === 'vi' ? 'Xác nhận PIN' : 'Confirm PIN'}
                      <input autoComplete="new-password" inputMode="numeric" maxLength={6} placeholder="••••••" type="password" value={employeeKioskPinConfirm} onChange={(event) => setEmployeeKioskPinConfirm(event.target.value.replace(/\D/g, '').slice(0, 6))} />
                    </label>
                  </div>
                  <div className="staff-hr-kiosk-actions">
                    <small>{resolvedLanguage === 'vi' ? 'Cả hai ô phải chứa cùng một mã gồm 6 số.' : 'Both fields must contain the same six-digit code.'}</small>
                    <button aria-live="polite" className={`primary staff-hr-kiosk-save ${employeeKioskPinSaveConfirmation ? 'is-confirmed' : ''}`} disabled={saving || Boolean(employeeKioskPinSaveConfirmation) || employeeKioskPin.length !== 6 || employeeKioskPinConfirm.length !== 6} type="button" onClick={() => void configureEmployeeKioskPin()}>
                      {employeeKioskPinSaveConfirmation ? <CircleCheckBig aria-hidden="true" size={18} /> : <KeyRound aria-hidden="true" size={17} />}
                      {employeeKioskPinSaveConfirmation === 'created'
                        ? (resolvedLanguage === 'vi' ? 'Đã tạo PIN' : 'PIN created')
                        : employeeKioskPinSaveConfirmation === 'replaced'
                          ? (resolvedLanguage === 'vi' ? 'Đã đổi PIN' : 'PIN replaced')
                          : employeeForm.kiosk_pin_configured_at
                            ? (resolvedLanguage === 'vi' ? 'Đổi PIN' : 'Replace PIN')
                            : (resolvedLanguage === 'vi' ? 'Tạo PIN' : 'Create PIN')}
                    </button>
                  </div>
                </div>}
              </div>
            </div>
          </CollapsibleEmployeeSection>}
        </div>
        <CollapsibleEmployeeSection description={employeeCopy.sectionHelp.documents} id="documents" onToggle={toggleEmployeeSection} open={openEmployeeSections.documents} title={employeeCopy.sectionTitles.documents}>
          <div className="staff-hr-document-section">
            <div className="staff-hr-drive-folder">
              <label>{employeeCopy.driveFolder}<input inputMode="url" placeholder="https://drive.google.com/drive/folders/…" value={employeeForm.google_drive_folder_url} onChange={(event) => setEmployeeForm({ ...employeeForm, google_drive_folder_url: event.target.value })} /></label>
              {employeeForm.google_drive_folder_url && <a href={employeeForm.google_drive_folder_url} rel="noreferrer" target="_blank"><ExternalLink aria-hidden="true" size={15} />{employeeCopy.driveFolderHelp}</a>}
            </div>
            <p className="staff-hr-document-count"><strong>{selectedEmployeeDocuments.length}</strong> {text.labels.attachmentList}</p>
            <div className="staff-hr-document-list">
              {selectedEmployeeDocuments.length > 0 ? selectedEmployeeDocuments.slice(0, 4).map((document) => (
                <span key={document.id}>{text.hrTabs.employees}: {document.file_name}</span>
              )) : <span>{text.messages.noHrDocuments}</span>}
            </div>
          </div>
        </CollapsibleEmployeeSection>
        <label className="staff-checkbox-row staff-employee-active-row">
          <input type="checkbox" checked={employeeForm.active} onChange={(event) => setEmployeeForm({ ...employeeForm, active: event.target.checked })} />
          <span>{text.labels.activeEmployee}</span>
        </label>
      </fieldset>}
    </div>
  )
}
