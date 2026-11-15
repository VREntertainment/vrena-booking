import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createStaffSettingsActions } from '../features/staff/lazySettingsActions.ts'
import type { SettingsActionContext } from '../features/staff/settings.actions.tsx'

test('lazy HR settings preserve the save result and recover the busy state', async () => {
  const saving: boolean[] = []
  const context = { setSaving: (value: boolean) => saving.push(value) } as unknown as SettingsActionContext
  let loads = 0
  const actions = createStaffSettingsActions(() => context, async () => {
    loads++
    return { createStaffSettingsActions: (read: () => SettingsActionContext) => ({
      updateHrSetupOption: async () => { assert.equal(read(), context); return true },
    }) } as unknown as typeof import('../features/staff/settings.actions')
  })
  assert.equal(loads, 0)
  assert.equal(await actions.updateHrSetupOption('option-1', 'Updated label'), true)
  assert.equal(loads, 1)
  assert.deepEqual(saving, [true, false])
})

test('failed HR settings module loading returns a failed save and shows feedback', async () => {
  const saving: boolean[] = []
  const status: string[] = []
  const context = {
    setSaving: (value: boolean) => saving.push(value),
    setStatus: (value: string) => status.push(value),
  } as unknown as SettingsActionContext
  const actions = createStaffSettingsActions(() => context, async () => { throw new Error('Unable to load settings') })
  assert.equal(await actions.updateHrSetupOption('option-1', 'Updated label'), false)
  assert.deepEqual(saving, [true, false])
  assert.deepEqual(status, ['Unable to load settings'])
})
