import assert from 'node:assert/strict'
import test from 'node:test'
import { allocateStaffCompanyCost, employeeHomeLocation, type StaffCostAssignment } from './staffCostAllocation.ts'

const assignment: StaffCostAssignment = { id: 'a', profile_id: 'employee', cost_location: 'HaDo', start_date: '2026-09-03', end_date: '2026-09-04', reason: 'Cover', cancelled_at: null }
const log = (date: string, minutes: number, approval = 'approved') => ({ staff_profile_id: 'employee', work_date: date, approval_status: approval, regular_minutes: minutes, overtime_minutes: 0, holiday_minutes: 0 })
const base = { profileId: 'employee', homeLocation: 'CS', periodStart: '2026-09-01', periodEnd: '2026-09-30', companyCost: 1001, paidLeaveMinutes: 0, assignments: [assignment], attendance: [] }

test('inclusive dates allocate approved paid hours and preserve total company cost', () => {
  const result = allocateStaffCompanyCost({ ...base, attendance: [log('2026-09-02', 60), log('2026-09-03', 60), log('2026-09-04', 60), log('2026-09-05', 60), log('2026-09-04', 500, 'pending'), log('2026-10-01', 900)] })
  assert.deepEqual(result.shares, [{ location: 'CS', paidMinutes: 120, companyCost: 501 }, { location: 'HaDo', paidMinutes: 120, companyCost: 500 }])
})
test('leave stays at home and cancelled assignments are ignored', () => {
  const result = allocateStaffCompanyCost({ ...base, paidLeaveMinutes: 60, attendance: [log('2026-09-03', 60)] })
  assert.equal(result.shares.find((row) => row.location === 'CS')?.companyCost, 501)
  assert.deepEqual(allocateStaffCompanyCost({ ...base, assignments: [{ ...assignment, cancelled_at: '2026-09-02' }], attendance: [log('2026-09-03', 60)] }).shares, [{ location: 'CS', paidMinutes: 60, companyCost: 1001 }])
})
test('missing hours are flagged instead of guessing temporary costs', () => {
  assert.equal(allocateStaffCompanyCost(base).needsPaidHours, true)
  assert.equal(allocateStaffCompanyCost({ ...base, assignments: [] }).needsPaidHours, false)
})
test('Office and GC have canonical home locations', () => {
  assert.equal(employeeHomeLocation('Office'), 'VRE')
  assert.equal(employeeHomeLocation('GC'), 'HaDo')
  assert.equal(employeeHomeLocation('VRena'), null)
})
