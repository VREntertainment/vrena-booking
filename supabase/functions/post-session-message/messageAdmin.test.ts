import test from 'node:test'
import assert from 'node:assert/strict'
import { hasMessageAdminPrivileges } from './messageAdmin.ts'

test('rejects anonymous users even when a privileged profile email was supplied elsewhere', () => {
  const spoofedProfile = { email: 'contact@vre-vietnam.com', role: 'player' }

  assert.equal(spoofedProfile.email, 'contact@vre-vietnam.com')
  assert.equal(
    hasMessageAdminPrivileges({
      isAnonymous: true,
      staffRoleRank: 100,
    }),
    false,
  )
})

test('requires the trusted admin rank returned in the caller auth context', () => {
  assert.equal(hasMessageAdminPrivileges({ isAnonymous: false, staffRoleRank: 0 }), false)
  assert.equal(hasMessageAdminPrivileges({ isAnonymous: false, staffRoleRank: 99 }), false)
  assert.equal(hasMessageAdminPrivileges({ isAnonymous: false, staffRoleRank: null }), false)
  assert.equal(hasMessageAdminPrivileges({ isAnonymous: false, staffRoleRank: 100 }), true)
  assert.equal(hasMessageAdminPrivileges({ isAnonymous: false, staffRoleRank: 120 }), true)
})
