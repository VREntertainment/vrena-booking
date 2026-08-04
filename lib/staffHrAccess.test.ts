import assert from 'node:assert/strict'
import test from 'node:test'
import { accessibleStaffHrTabs, canAccessCoreHrSettings, canAccessHrConsole, canAccessZaloHrSettings } from './staffKioskScope.ts'

const hrTabs = ['employees', 'zalo', 'settings'] as const

test('the shared store login never receives HR console access', () => {
  assert.equal(canAccessHrConsole({ authEmail: 'contact@vre-vietnam.com', role: 'admin', roleRank: 120 }), false)
  assert.equal(canAccessZaloHrSettings({ authEmail: 'CONTACT@VRE-VIETNAM.COM', role: 'owner', roleRank: 120 }), false)
  assert.equal(canAccessCoreHrSettings({ authEmail: ' contact@vre-vietnam.com ', role: 'cashier', roleRank: 100 }), false)
})

test('named staff accounts preserve general HR console access', () => {
  assert.equal(canAccessHrConsole({ authEmail: 'viewer@vre-vietnam.com', role: 'viewer', roleRank: 20 }), true)
  assert.equal(canAccessHrConsole({ authEmail: 'player@example.com', role: 'player', roleRank: 0 }), false)
})

test('Zalo settings are limited to named owners and admins', () => {
  assert.equal(canAccessZaloHrSettings({ authEmail: 'owner@vre-vietnam.com', role: 'owner', roleRank: 120 }), true)
  assert.equal(canAccessZaloHrSettings({ authEmail: 'admin@vre-vietnam.com', role: 'admin', roleRank: 100 }), true)
  assert.equal(canAccessZaloHrSettings({ authEmail: 'office@vre-vietnam.com', role: 'cashier', roleRank: 20 }), false)
  assert.equal(canAccessZaloHrSettings({ authEmail: 'manager@vre-vietnam.com', role: 'manager', roleRank: 80 }), false)
})

test('core HR settings include named office staff but exclude managers', () => {
  assert.equal(canAccessCoreHrSettings({ authEmail: 'owner@vre-vietnam.com', role: 'owner', roleRank: 120 }), true)
  assert.equal(canAccessCoreHrSettings({ authEmail: 'admin@vre-vietnam.com', role: 'admin', roleRank: 100 }), true)
  assert.equal(canAccessCoreHrSettings({ authEmail: 'office@vre-vietnam.com', role: 'cashier', roleRank: 20 }), true)
  assert.equal(canAccessCoreHrSettings({ authEmail: 'manager@vre-vietnam.com', role: 'manager', roleRank: 80 }), false)
})

test('the HR tab rail removes every unauthorized settings surface', () => {
  assert.deepEqual(accessibleStaffHrTabs(hrTabs, { canAccessHrSettings: false, canAccessZaloSettings: false }), ['employees'])
  assert.deepEqual(accessibleStaffHrTabs(hrTabs, { canAccessHrSettings: true, canAccessZaloSettings: false }), ['employees', 'settings'])
  assert.deepEqual(accessibleStaffHrTabs(hrTabs, { canAccessHrSettings: true, canAccessZaloSettings: true }), hrTabs)
})
