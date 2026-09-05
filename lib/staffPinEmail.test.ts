import assert from 'node:assert/strict'
import test from 'node:test'
import { buildStaffPinEmail, maskEmailAddress } from './staffPinEmail.ts'

test('masks the saved HR email without hiding its destination domain', () => {
  assert.equal(maskEmailAddress('Employee.Name@Example.com'), 'em•••••••••••@example.com')
  assert.equal(maskEmailAddress('a@example.com'), 'a•••@example.com')
  assert.equal(maskEmailAddress('invalid'), '')
})

test('builds a bilingual branded six-digit employee PIN email', () => {
  const email = buildStaffPinEmail({
    accessRole: 'manager',
    employeeName: '<script>Tu</script>',
    pin: '857343',
    recipientEmail: 'tu@example.com',
  })

  assert.equal(email.subject, '[VRena] Your employee PIN / Mã PIN nhân viên')
  assert.match(email.text, /Access level: Manager/)
  assert.match(email.text, /Cấp quyền: Quản lý/)
  assert.match(email.html, /vrena-logo-full-dark\.png/)
  assert.match(email.html, /857343/)
  assert.doesNotMatch(email.html, /<script>Tu<\/script>/)
  assert.match(email.html, /&lt;script&gt;Tu&lt;\/script&gt;/)
})

test('rejects malformed PINs before building an email', () => {
  assert.throws(() => buildStaffPinEmail({
    accessRole: 'staff',
    employeeName: 'Employee',
    pin: '1234',
    recipientEmail: 'employee@example.com',
  }), /exactly six digits/)
})
