import assert from 'node:assert/strict'
import test from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { linkZaloIdentity } from './zaloAttendanceLink.ts'

const identity = { id: 'link', staff_profile_id: 'employee', zalo_app_user_id: 'zalo', revoked_at: null as string | null }
function client(row: typeof identity | null, concurrentRevocation = false) {
  const writes: Record<string, unknown>[] = []
  const filters: unknown[][] = []
  const db = { from(table: string) {
    const query = {
      select() { return query }, eq() { return query },
      is(...args: unknown[]) { filters.push(args); return query },
      maybeSingle: async () => ({ data: row, error: null }),
      update(values: Record<string, unknown>) { writes.push(values); return query },
      insert(values: Record<string, unknown>) { writes.push(values); return table === 'staff_zalo_attendance_events' ? Promise.resolve({ error: null }) : query },
      single: async () => ({ data: concurrentRevocation ? null : identity, error: concurrentRevocation ? { message: 'no rows' } : null }),
    }; return query
  } } as unknown as SupabaseClient
  return { db, writes, filters }
}
test('revoked employee identity cannot self-reactivate or overwrite audit history', async () => {
  const c = client({ ...identity, revoked_at: '2026-10-31T00:00:00Z' })
  await assert.rejects(linkZaloIdentity(c.db, { profile_id: 'employee' }, { id: 'zalo' }, '+84900000000'), /revoked/)
  assert.equal(c.writes.length, 0)
})
test('concurrent revocation fails closed and does not record a successful link', async () => {
  const c = client(identity, true)
  await assert.rejects(linkZaloIdentity(c.db, { profile_id: 'employee' }, { id: 'zalo' }, '+84900000000'), /could not be linked/)
  assert.deepEqual(c.filters, [['revoked_at', null]])
  assert.equal(c.writes.length, 1)
  for (const key of ['revoked_at', 'revoked_by', 'revoke_reason']) assert.equal(key in c.writes[0], false)
})
test('new links and active link refreshes remain available', async () => {
  for (const row of [null, identity]) {
    const c = client(row)
    assert.deepEqual(await linkZaloIdentity(c.db, { profile_id: 'employee' }, { id: 'zalo' }, '+84900000000'), identity)
    assert.equal(c.writes.length, 2)
  }
})
test('identities cannot be reassigned to another employee or account', async () => {
  for (const row of [{ ...identity, staff_profile_id: 'other' }, { ...identity, zalo_app_user_id: 'other' }]) {
    const c = client(row)
    await assert.rejects(linkZaloIdentity(c.db, { profile_id: 'employee' }, { id: 'zalo' }, '+84900000000'), /already linked/)
    assert.equal(c.writes.length, 0)
  }
})
