import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calculateStaffPayroll, leaveHoursInsidePeriod } from './staff/payroll.ts'
import { defaultAttendanceSettings, defaultHrSettings } from './staff/hrSettings.ts'
import { calculateDiscount, calculateManualDiscount, discountMatchesContext, selectPricingRule } from './staff/pricing.ts'
import { countRestPeriodWarnings, shiftConflictWarnings } from './staff/scheduling.ts'
import { staffConsoleText } from './staff/copy.ts'
import type { StaffEmployeeProfile, StaffAttendanceLog, StaffScheduleShift, StaffHrAdjustment, StaffLeaveRequest, StaffDiscount, StaffPriceRule } from './staff/types'

function employee(overrides: Partial<StaffEmployeeProfile> = {}): StaffEmployeeProfile {
  return {
    profile_id: 'employee',
    employee_code: null,
    attendance_number: null,
    legal_name: null,
    personal_phone: null,
    personal_email: null,
    national_id: null,
    date_of_birth: null,
    gender: null,
    address: null,
    department: null,
    job_title: null,
    employment_type: 'part_time',
    main_work_location: null,
    payroll_location: null,
    contract_status: 'active',
    contract_type: null,
    contract_start_date: null,
    contract_end_date: null,
    probation_payroll_type: 'hourly',
    labor_payroll_type: 'hourly',
    probation_salary_percentage: 100,
    probation_bonus_percentage: 100,
    probation_start_date: null,
    probation_end_date: null,
    labor_start_date: null,
    labor_end_date: null,
    start_date: null,
    end_date: null,
    base_salary_vnd: 0,
    hourly_rate_vnd: 30000,
    monthly_bonus_vnd: 0,
    lunch_allowance_vnd: 0,
    rest_period_minutes: null,
    overtime_rate_multiplier: null,
    night_rate_multiplier: null,
    holiday_rate_multiplier: null,
    employee_contribution_rate: null,
    employer_contribution_rate: null,
    pit_withholding_rate: null,
    dependents_count: 0,
    bank_name: null,
    bank_account_number: null,
    tax_code: null,
    social_insurance_number: null,
    social_insurance_enrolled: false,
    social_insurance_salary_vnd: 0,
    emergency_contact: null,
    emergency_contact_name: null,
    emergency_contact_relationship: null,
    emergency_contact_phone: null,
    google_drive_folder_url: null,
    payroll_note: null,
    profile_photo_path: null,
    cv_document_path: null,
    active: true,
    kiosk_access_role: null,
    kiosk_pin_configured_at: null,
    created_by: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

function attendance(overrides: Partial<StaffAttendanceLog> = {}): StaffAttendanceLog {
  return {
    id: 'attendance',
    staff_profile_id: 'employee',
    shift_id: null,
    work_date: '2026-09-07',
    clock_in_at: '2026-09-07T09:00:00+07:00',
    clock_out_at: '2026-09-07T17:00:00+07:00',
    break_minutes: 0,
    status: 'present',
    regular_minutes: 240,
    overtime_minutes: 0,
    night_minutes: 0,
    holiday_minutes: 0,
    late_minutes: 0,
    early_leave_minutes: 0,
    is_half_day: false,
    approval_status: 'approved',
    approved_by: null,
    approved_at: null,
    manager_note: null,
    created_by: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

function shift(overrides: Partial<StaffScheduleShift> = {}): StaffScheduleShift {
  return {
    id: 'shift',
    staff_profile_id: 'employee',
    location: '',
    shift_role: '',
    shift_date: '2026-09-07',
    start_time: '09:00',
    end_time: '17:00',
    break_minutes: 0,
    status: 'published',
    notes: null,
    created_by: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

function adjustment(overrides: Partial<StaffHrAdjustment> = {}): StaffHrAdjustment {
  return {
    id: 'adjustment',
    profile_id: 'employee',
    payroll_run_id: null,
    adjustment_type: 'bonus',
    title: '',
    amount_vnd: 50000,
    effective_date: '2026-09-07',
    period_start: null,
    period_end: null,
    status: 'approved',
    requires_validation: false,
    validated_by: null,
    validated_at: null,
    notes: null,
    created_by: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

function leave(overrides: Partial<StaffLeaveRequest> = {}): StaffLeaveRequest {
  return {
    id: 'leave',
    staff_profile_id: 'employee',
    leave_type: 'annual',
    start_date: '2026-08-31',
    end_date: '2026-09-02',
    hours: 24,
    reason: null,
    status: 'approved',
    requested_by: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

function discount(overrides: Partial<StaffDiscount> = {}): StaffDiscount {
  return {
    id: 'discount',
    code: null,
    name: 'Ten percent',
    game_id: null,
    price_rule_id: null,
    min_players: null,
    max_players: null,
    day_scope: 'all',
    time_start: null,
    time_end: null,
    ticket_type: 'all',
    min_order_total: 0,
    max_discount_amount: null,
    per_customer_limit: null,
    discount_type: 'percentage',
    value: 10,
    valid_from: '2026-01-01',
    valid_until: null,
    max_uses: null,
    used_count: 0,
    active: true,
    ...overrides,
  }
}

function price(overrides: Partial<StaffPriceRule> = {}): StaffPriceRule {
  return {
    id: 'default',
    rule_name: 'Default',
    game_id: null,
    day_type: 'weekday',
    time_start: null,
    time_end: null,
    price_per_player: 220000,
    price_per_arena_slot: null,
    valid_from: '2026-01-01',
    valid_until: null,
    active: true,
    ...overrides,
  }
}

function payroll({ profile = employee(), shifts = [shift()], logs = [attendance()], leaves = [] as StaffLeaveRequest[], adjustments = [] as StaffHrAdjustment[] } = {}) {
  return calculateStaffPayroll('employee', profile, shifts, logs, leaves, adjustments,
    { ...defaultHrSettings(), personal_income_tax_enabled: false, social_insurance_enabled: false, lunch_allowance_vnd: 0 },
    defaultAttendanceSettings(), '2026-09-01', '2026-09-30')
}

test('payroll uses approved paid minutes rather than the longer clock span', () => {
  const result = payroll({ logs: [attendance(), attendance({ id: 'pending', regular_minutes: 480, approval_status: 'pending' }), attendance({ id: 'other', staff_profile_id: 'someone-else', regular_minutes: 480 })] })
  assert.equal(result.workedMinutes, 240)
  assert.equal(result.regularMinutes, 240)
  assert.equal(result.basePay, 120000)
  assert.equal(result.netIncome, 120000)
})

test('payroll filters adjustments by employee, period, and approval and keeps costs reconcilable', () => {
  const result = payroll({ adjustments: [adjustment(), adjustment({ id: 'deduction', adjustment_type: 'deduction', amount_vnd: 10000 }), adjustment({ id: 'pending', status: 'pending' }), adjustment({ id: 'other', profile_id: 'other' }), adjustment({ id: 'past', effective_date: '2026-08-31' })] })
  assert.equal(result.bonuses, 50000)
  assert.equal(result.deductions, 10000)
  assert.equal(result.grossIncome, 170000)
  assert.equal(result.netIncome, 160000)
  assert.equal(result.companyCost, result.grossIncome + result.employerContributions)
})

test('night and holiday overtime are categorized without counting the same minutes twice', () => {
  const result = payroll({ logs: [attendance({ regular_minutes: 240, overtime_minutes: 180, night_minutes: 120, holiday_minutes: 120 })] })
  const settings = defaultHrSettings()
  const expected = Math.round(2 * 30000 * settings.holiday_overtime_multiplier + 1 * 30000 * (settings.normal_overtime_multiplier + settings.night_work_bonus_rate / 100 + settings.night_overtime_extra_rate / 100))
  assert.equal(result.overtimePay, expected)
  assert.equal(result.workedMinutes, 420)
  assert.equal(result.basePay, 120000)
})

test('paid leave is prorated to the selected period and remains excluded for hourly employees', () => {
  assert.equal(leaveHoursInsidePeriod(leave(), '2026-09-01', '2026-09-30'), 16)
  assert.equal(leaveHoursInsidePeriod(leave(), '2026-09-03', '2026-09-30'), 0)
  assert.equal(payroll({ leaves: [leave()] }).paidLeaveHours, 0)
  assert.equal(payroll({ profile: employee({ labor_payroll_type: 'monthly', base_salary_vnd: 10000000 }), leaves: [leave()] }).paidLeaveHours, 16)
})

test('payroll honors probation percentages and excludes draft or cancelled planned hours', () => {
  const result = payroll({ profile: employee({ probation_start_date: '2026-09-01', probation_end_date: '2026-10-01', probation_salary_percentage: 85 }), shifts: [shift(), shift({ id: 'draft', status: 'draft' }), shift({ id: 'cancelled', status: 'cancelled' })] })
  assert.equal(result.scheduledMinutes, 480)
  assert.equal(result.basePay, 102000)
})

test('planning warnings combine overlap, approved leave, daily limits, and overnight rest gaps', () => {
  const first = shift()
  const other = shift({ id: 'other', start_time: '16:00', end_time: '22:00' })
  const warnings = shiftConflictWarnings(first, [first, other], [leave({ start_date: first.shift_date, end_date: first.shift_date })], defaultAttendanceSettings(), staffConsoleText.en)
  assert.deepEqual(warnings, [staffConsoleText.en.messages.planningConflictOverlap, staffConsoleText.en.messages.planningConflictLeave, staffConsoleText.en.messages.planningConflictDailyLimit])
  assert.deepEqual(shiftConflictWarnings({ ...first, status: 'cancelled' }, [first, other], [], defaultAttendanceSettings(), staffConsoleText.en), [])
  assert.equal(countRestPeriodWarnings([shift({ start_time: '22:00', end_time: '02:00' }), shift({ id: 'next', shift_date: '2026-09-08', start_time: '09:00' })], 12 * 60), 1)
})

test('staff pricing favors game-specific custom rules over general walk-in rules', () => {
  const rules = [price(), price({ id: 'game', game_id: 'laser-tag' }), price({ id: 'custom', game_id: 'laser-tag', day_type: 'custom' }), price({ id: 'disabled', game_id: 'laser-tag', day_type: 'custom', active: false })]
  assert.equal(selectPricingRule(rules, 'laser-tag', '2026-09-07', '16:00')?.id, 'custom')
  assert.equal(selectPricingRule(rules, 'other-game', '2026-09-07', '16:00')?.id, 'default')
  assert.equal(selectPricingRule(rules, 'other-game', '2025-09-07', '16:00'), null)
})

test('voucher context honors usage, spending, player count, game, date, and overnight time windows', () => {
  const voucher = discount({ game_id: 'laser-tag', min_players: 4, max_players: 8, time_start: '20:00', time_end: '02:00', min_order_total: 500000, max_uses: 5, used_count: 4 })
  const context = { date: '2026-09-07', time: '21:00', gameId: 'laser-tag', players: 4, priceRuleId: null, subtotal: 600000, ticketType: 'all' as const }
  assert.ok(discountMatchesContext(voucher, context))
  assert.ok(discountMatchesContext(voucher, { ...context, time: '01:00' }))
  for (const change of [{ time: '12:00' }, { players: 3 }, { gameId: 'other' }, { subtotal: 499999 }, { date: '2025-09-07' }]) assert.equal(discountMatchesContext(voucher, { ...context, ...change }), false)
  assert.equal(discountMatchesContext({ ...voucher, used_count: 5 }, context), false)
})

test('manual and voucher reductions never exceed either the rule cap or booking subtotal', () => {
  assert.equal(calculateDiscount(discount({ value: 50, max_discount_amount: 100000 }), 600000, 220000), 100000)
  assert.equal(calculateDiscount(discount({ discount_type: 'free_ticket' }), 100000, 220000), 100000)
  assert.equal(calculateManualDiscount('percentage', 200, 600000), 600000)
  assert.equal(calculateManualDiscount('fixed_amount', 900000, 600000), 600000)
})
