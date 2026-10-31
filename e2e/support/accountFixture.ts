import { expect, type Page } from '@playwright/test'

const userId = '00000000-0000-4000-8000-000000000991'
const bookingId = '00000000-0000-4000-8000-000000000992'

export async function accountFixture(page: Page, phone: string, signedIn = true) {
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'booking-regression@vrena.local', app_metadata: {}, user_metadata: {}, factors: [] }
  const token = [Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now()/1000)+3600, aal: 'aal1', amr: [] })).toString('base64url'), 'fixture'].join('.')
  let profile = { id: userId, phone, full_name: 'Booking Tester', email: user.email, birthday: '1990-01-01', role: 'player', nickname: 'Tester', marketing_consent: false, loyalty_points_total: 1250, onboarding_tour_completed_at: '2026-01-01T00:00:00Z' }
  const requests: Array<{ name: string; args: Record<string, unknown> }> = []
  let bookings: Record<string, unknown>[] = []
  await page.context().addCookies([{ name: 'vrena-cookie-consent', value: 'essential', url: 'http://127.0.0.1:3000' }])
  if (signedIn) await page.addInitScript(({ user, token }) => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: token, refresh_token: 'fixture', expires_at: Math.floor(Date.now()/1000)+3600, expires_in: 3600, token_type: 'bearer', user }))
  }, { user, token })
  await page.route(`${process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'}/**`, async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/auth/v1/token') return route.fulfill({ json: { access_token: token, refresh_token: 'fixture', expires_in: 3600, token_type: 'bearer', user } })
    if (url.pathname === '/auth/v1/user') return route.fulfill({ json: user })
    if (url.pathname === '/rest/v1/profiles' && url.searchParams.get('id') === `eq.${userId}`) {
      if (route.request().method() === 'PATCH') profile = { ...profile, ...route.request().postDataJSON() }
      return route.fulfill({ json: profile })
    }
    if (url.pathname === '/rest/v1/sessions' && url.searchParams.has('or')) {
      expect(url.searchParams.get('or')).toContain(`owner_id.eq.${userId}`)
      expect(url.searchParams.get('or')).toContain(`ticket_customer_id.eq.${userId}`)
      return route.fulfill({ json: bookings })
    }
    if (url.pathname.endsWith('/sessions_list_page')) return route.fulfill({ json: { sessions: [], has_more_after: false } })
    if (url.pathname.includes('rate_limit')) return route.fulfill({ json: { allowed: true } })
    return route.fulfill({ json: [] })
  })
  await page.route('**/api/bookings/tickets', async route => {
    const request = route.request().postDataJSON()
    requests.push(request)
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`)
    expect(profile.phone).toBe('+84900000991')
    bookings = [{ id: bookingId, owner_id: userId, ticket_customer_id: userId, venue_key: request.name === 'create_cafe_ticket_booking_request' ? 'cafe-des-stagiaires' : 'ha-do-centrosa', name: 'Account reservation', date: request.args.p_date, start_time: request.args.p_start_time, duration_minutes: 30, max_players: 2, arena_count: 1, game_options: [], status: 'open', ticket_status: 'confirmed', booking_type: 'ticket', ticket_reference: 'QA-ACCOUNT-991', ticket_total_price: 440000, session_participants: [] }]
    return route.fulfill({ json: { data: { session_id: bookingId, ticket_reference: 'QA-ACCOUNT-991', ticket_status: 'confirmed' }, error: null } })
  })
  return requests
}

