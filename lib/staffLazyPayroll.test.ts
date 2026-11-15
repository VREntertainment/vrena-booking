import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createStaffPayrollActions } from '../features/staff/lazyPayrollActions.ts'
import type { PayrollActionContext } from '../features/staff/payroll.actions.tsx'

test('payroll loads on action and keeps the initiating context while loading', async () => {
  const saving: boolean[] = []
  const first = { setSaving: (value: boolean) => saving.push(value) } as unknown as PayrollActionContext
  const second = {} as PayrollActionContext
  let current = first
  let loads = 0
  let release!: () => void
  let used: PayrollActionContext | undefined
  const actions = createStaffPayrollActions(() => current, async () => {
    loads++
    await new Promise<void>(resolve => { release = resolve })
    return { createStaffPayrollActions: (read: () => PayrollActionContext) => ({
      syncPayrollDraft: async () => { used = read() },
    }) } as unknown as typeof import('../features/staff/payroll.actions')
  })
  assert.equal(loads, 0)
  const pending = actions.syncPayrollDraft()
  assert.equal(loads, 1)
  assert.deepEqual(saving, [true])
  current = second
  release()
  await pending
  assert.equal(used, first)
  assert.deepEqual(saving, [true, false])
})

test('failed payroll module loading reports failure and releases the busy state', async () => {
  const saving: boolean[] = []
  const status: string[] = []
  const context = {
    setSaving: (value: boolean) => saving.push(value),
    setStatus: (value: string) => status.push(value),
  } as unknown as PayrollActionContext
  const actions = createStaffPayrollActions(() => context, async () => { throw new Error('Unable to load payroll') })
  await actions.generatePayrollRun()
  assert.deepEqual(status, ['Unable to load payroll'])
  assert.deepEqual(saving, [true, false])
})
