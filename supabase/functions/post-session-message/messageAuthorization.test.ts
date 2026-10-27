import test from 'node:test'
import assert from 'node:assert/strict'
import { authorizeSessionMessage } from './messageAuthorization.ts'

const active = { deleted_at: null }
const removed = { deleted_at: '2026-10-27T00:00:00Z' }
const participant = {
  userId: 'player', isAnonymous: false, messageType: 'comment',
  profile: active, session: { ...active, owner_id: 'owner' },
  participant: active, staffRoleRank: 0, readFailed: false,
}

test('active participants can comment but cannot publish announcements', () => {
  assert.deepEqual(authorizeSessionMessage(participant), { allowed: true, trustedAuthor: false })
  assert.equal(authorizeSessionMessage({ ...participant, messageType: 'announcement' }).allowed, false)
})

test('removed or absent participants cannot comment', () => {
  for (const membership of [removed, null]) {
    assert.equal(authorizeSessionMessage({ ...participant, participant: membership }).allowed, false)
  }
})

test('owners and verified admins can announce without participant records', () => {
  for (const identity of [{ userId: 'owner', staffRoleRank: 0 }, { userId: 'admin', staffRoleRank: 100 }]) {
    assert.deepEqual(authorizeSessionMessage({ ...participant, ...identity, participant: null, messageType: 'announcement' }), {
      allowed: true, trustedAuthor: true,
    })
  }
})

test('deleted or missing profile/session denies participants, owners and admins', () => {
  for (const identity of [{ userId: 'player', staffRoleRank: 0 }, { userId: 'owner', staffRoleRank: 0 }, { userId: 'admin', staffRoleRank: 100 }]) {
    for (const profile of [removed, null]) {
      assert.equal(authorizeSessionMessage({ ...participant, ...identity, profile }).allowed, false)
    }
    for (const session of [{ ...removed, owner_id: 'owner' }, null]) {
      assert.equal(authorizeSessionMessage({ ...participant, ...identity, session }).allowed, false)
    }
  }
})

test('anonymous accounts and failed authorization reads always fail closed', () => {
  for (const identity of [{ userId: 'player', staffRoleRank: 0 }, { userId: 'owner', staffRoleRank: 100 }]) {
    assert.equal(authorizeSessionMessage({ ...participant, ...identity, isAnonymous: true }).allowed, false)
    assert.equal(authorizeSessionMessage({ ...participant, ...identity, readFailed: true }).allowed, false)
  }
})

test('a refreshed decision rejects membership removed during moderation', () => {
  assert.equal(authorizeSessionMessage(participant).allowed, true)
  assert.equal(authorizeSessionMessage({ ...participant, participant: removed }).allowed, false)
})
