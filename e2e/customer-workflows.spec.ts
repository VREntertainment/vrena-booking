import { expect, test } from '@playwright/test'
import type { Club } from '../lib/bookingWidgetDomain'
import { loginAsAdmin } from './support/admin'

const memberId = '11111111-1111-4111-8111-111111111111'
const clubs: Club[] = ['public', 'private'].map((visibility, index) => ({
  id: `22222222-2222-4222-8222-22222222222${index}`,
  owner_id: memberId,
  name: `Workflow ${visibility} club`,
  description: 'Read-only browser fixture',
  visibility: visibility as Club['visibility'],
  pin_code: visibility === 'private' ? 'EXPECTED' : null,
  member_count: 1,
  created_at: '2026-09-01T00:00:00Z',
  club_members: [{
    id: `33333333-3333-4333-8333-33333333333${index}`,
    club_id: `22222222-2222-4222-8222-22222222222${index}`,
    profile_id: memberId,
    display_name: 'Workflow Player',
    avatar_url: null,
    status: 'approved',
    role: 'member',
  }],
}))

test('club sections and player challenges load; an incorrect private code remains blocked', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await loginAsAdmin(page)
  // Only replace read requests in this browser. No club, challenge, or message is created.
  await page.route('**/rest/v1/rpc/clubs_list_page', (route) => route.fulfill({ json: clubs }))
  await page.route(/\/rest\/v1\/clubs\?/, (route) => route.fulfill({ json: clubs }))
  await page.route(/\/rest\/v1\/club_members\?/, (route) => route.fulfill({ json: clubs.flatMap((club) => club.club_members ?? []) }))
  await page.goto('/clubs')
  await page.locator('.club-card').filter({ hasText: 'Workflow public club' }).getByRole('heading').click()
  const drawer = page.locator('.club-drawer')
  await expect(drawer.getByRole('heading', { name: 'Workflow public club' })).toBeVisible()
  for (const name of ['Sessions', 'Messages', 'Settings', 'Members']) {
    await drawer.locator('.club-page-tabs').getByRole('button', { name, exact: true }).click()
    await expect(drawer.locator('.club-tab-panel')).toBeVisible()
  }
  await drawer.locator('.club-member-list .player-avatar-button').first().click()
  await page.locator('.compact-challenge-card .challenge-button').click()
  await expect(page.locator('.challenge-form-grid')).toBeVisible()
  await expect(page.locator('.challenge-form-grid select').first()).not.toHaveValue('')
  await page.goto('/clubs')
  await page.locator('.club-card').filter({ hasText: 'Workflow private club' }).getByRole('heading').click()
  const unlock = page.locator('[aria-labelledby="club-unlock-title"]')
  await expect(unlock).toBeVisible()
  await unlock.locator('input').fill('WRONG')
  await unlock.locator('button[type="submit"]').click()
  await expect(unlock.locator('.notice.error')).toBeVisible()
  await expect(page.locator('.club-drawer')).toHaveCount(0)
  expect(errors).toEqual([])
})
