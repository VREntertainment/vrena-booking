import assert from 'node:assert/strict'
import test from 'node:test'
import { buildStaffPinEmail, maskEmailAddress, sendStaffPinEmail } from './staffPinEmail.ts'

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


test('PIN delivery uses a transactional sender rather than an unrelated notification mailbox', async (t) => {
  const keys = ['RESEND_API_KEY', 'STAFF_PIN_FROM_EMAIL', 'RESEND_FROM_EMAIL', 'NOTIFICATION_FROM_EMAIL'] as const
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  try {
    process.env.RESEND_API_KEY = 'test-only-key'
    process.env.NOTIFICATION_FROM_EMAIL = 'notification@example.com'
    delete process.env.STAFF_PIN_FROM_EMAIL
    delete process.env.RESEND_FROM_EMAIL
    let sender = ''
    t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
      sender = JSON.parse(String(options.body)).from
      return new Response('{}', { status: 200 })
    })
    await sendStaffPinEmail({ accessRole: 'staff', employeeName: 'Test employee', pin: '012345', recipientEmail: 'test@example.com' })
    assert.equal(sender, 'VRena <contact@vre-vietnam.com>')
    process.env.STAFF_PIN_FROM_EMAIL = 'VRena <staff@example.com>'
    await sendStaffPinEmail({ accessRole: 'staff', employeeName: 'Test employee', pin: '012345', recipientEmail: 'test@example.com' })
    assert.equal(sender, 'VRena <staff@example.com>')
  } finally {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key]
      else process.env[key] = original[key]
    }
  }
})
