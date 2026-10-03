import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { loginAsAdmin, openAdmin } from './support/admin'

test('client details save and reopen without changing player stats', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Exercise isolated writes once and cover mobile in the same flow.')
  if (process.env.SUPABASE_URL !== 'http://127.0.0.1:56431') throw new Error('Client fixtures require isolated local services.')
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const suffix = Date.now()
  const name = `Client details ${suffix}`
  const created = await admin.auth.admin.createUser({ email: `details-${suffix}@example.invalid`, email_confirm: true })
  if (created.error) throw created.error
  const id = created.data.user.id
  try {
    const fixture = await admin.from('profiles').upsert({ id, full_name: name, nickname: `details-${suffix}`, role: 'player', loyalty_points_total: 42 })
    if (fixture.error) throw fixture.error
    await loginAsAdmin(page)
    await openAdmin(page)
    await page.getByRole('tab', { name: 'Client Profile', exact: true }).click()
    await page.getByRole('combobox', { name: 'Choose player' }).fill(name)
    await page.getByRole('option').filter({ hasText: name }).click()
    const details = page.getByRole('group', { name: 'Client details', exact: true })
    await expect(details.getByLabel('Full name (including surname)')).toHaveValue(name)
    await details.getByLabel('Full name (including surname)').fill(`${name} Nguyen`)
    await details.getByLabel('Nickname', { exact: true }).fill(`renamed-${suffix}`)
    await details.getByLabel('Phone number', { exact: true }).fill('+84900000712')
    await details.getByLabel('Contact email', { exact: true }).fill(`contact-${suffix}@example.invalid`)
    await details.getByLabel('Date of birth', { exact: true }).fill('2000-02-29')
    await details.getByLabel('Gender', { exact: true }).selectOption('female')
    await details.getByLabel('Profile motto', { exact: true }).fill('Play together')
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await details.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    const response = page.waitForResponse((res) => res.url().endsWith('/rpc/staff_save_client_profile_v4'))
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    expect((await response).ok()).toBe(true)
    const saved = await admin.from('profiles').select('full_name,nickname,phone,email,birthday,gender,profile_motto,loyalty_points_total').eq('id', id).single()
    expect(saved.error).toBeNull()
    expect(saved.data).toEqual({ full_name: `${name} Nguyen`, nickname: `renamed-${suffix}`, phone: '+84900000712', email: `contact-${suffix}@example.invalid`, birthday: '2000-02-29', gender: 'female', profile_motto: 'Play together', loyalty_points_total: 42 })
    await page.reload()
    await page.getByRole('tab', { name: 'Client Profile', exact: true }).click()
    await page.getByRole('combobox', { name: 'Choose player' }).fill(`renamed-${suffix}`)
    await page.getByRole('option').filter({ hasText: `${name} Nguyen` }).click()
    await expect(details.getByLabel('Date of birth')).toHaveValue('2000-02-29')
    await expect(details.getByLabel('Phone number')).toHaveValue('+84900000712')
    await expect(page.getByText('Edit player stats', { exact: true })).toBeVisible()
  } finally {
    const removed = await admin.auth.admin.deleteUser(id)
    if (removed.error) throw removed.error
  }
})
