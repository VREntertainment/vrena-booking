import assert from 'node:assert/strict'
import test from 'node:test'
import { staffConsoleRoleRank, staffRoleRank } from './staffRoles.ts'

test('legacy Staff and Manager profile roles no longer grant web-app access', () => {
  for (const role of ['staff', 'manager', 'employee']) {
    assert.equal(staffRoleRank(role), 0)
    assert.equal(staffConsoleRoleRank(role), 0)
  }
})

test('current named web-app roles retain their intended rank', () => {
  assert.equal(staffRoleRank('owner'), 120)
  assert.equal(staffRoleRank('admin'), 100)
  assert.equal(staffRoleRank('cashier'), 20)
  assert.equal(staffRoleRank('viewer'), 20)
  assert.equal(staffRoleRank('player'), 0)
})
