import { expect, test } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const stagingConfirmation = 'I_AM_USING_STAGING_OR_LOCAL_FAKE_DATA'

const productionHostPatterns = [
  /(^|\.)vrena-booking\.vercel\.app$/i,
  /(^|\.)vre-vietnam\.com$/i,
]

const fixtureIds = {
  player: '00000000-0000-4000-8000-00000000e201',
  staff: '00000000-0000-4000-8000-00000000e202',
  game: '00000000-0000-4000-8000-00000000e301',
  priceRule: '00000000-0000-4000-8000-00000000e302',
  discountRule: '00000000-0000-4000-8000-00000000e303',
  order: '00000000-0000-4000-8000-00000000e304',
  ticketSession: '00000000-0000-4000-8000-00000000e305',
  attendanceLog: '00000000-0000-4000-8000-00000000e306',
} as const

type SecurityConfig = {
  supabaseUrl: string
  supabaseAnonKey: string
  supabaseServiceRoleKey: string
  playerEmail: string
  playerPassword: string
}

function readSecurityConfig(): SecurityConfig | null {
  if (process.env.SECURITY_REST_TESTS !== '1') {
    return null
  }

  const baseURL = process.env.SECURITY_BASE_URL || process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'
  const appUrl = new URL(baseURL)

  if (productionHostPatterns.some((pattern) => pattern.test(appUrl.hostname))) {
    throw new Error(`SECURITY_BASE_URL/E2E_BASE_URL points to a production host (${appUrl.hostname}). Use staging or local fake data.`)
  }

  if (process.env.SECURITY_STAGING_CONFIRMATION !== stagingConfirmation) {
    throw new Error(`Set SECURITY_STAGING_CONFIRMATION=${stagingConfirmation} before running direct REST security tests.`)
  }

  const required = (name: string) => {
    const value = process.env[name]?.trim()
    if (!value) {
      throw new Error(`${name} is required for direct REST security tests.`)
    }
    return value
  }

  const supabaseUrl = process.env.SECURITY_SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabaseAnonKey = process.env.SECURITY_SUPABASE_ANON_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('SECURITY_SUPABASE_URL/SECURITY_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY are required.')
  }

  const supabaseHostname = new URL(supabaseUrl).hostname
  if (supabaseHostname.endsWith('.supabase.co') && !process.env.SECURITY_SUPABASE_URL) {
    throw new Error('Set SECURITY_SUPABASE_URL explicitly so this test cannot accidentally inherit production app env.')
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey: required('SECURITY_SUPABASE_SERVICE_ROLE_KEY'),
    playerEmail: required('SECURITY_PLAYER_EMAIL'),
    playerPassword: required('SECURITY_PLAYER_PASSWORD'),
  }
}

function makeClient(url: string, key: string) {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}

async function resetFixtureState(service: SupabaseClient) {
  await service
    .from('profiles')
    .update({
      role: 'player',
      score_adjustment: 0,
      loyalty_points_total: 0,
      deleted_at: null,
      banned_at: null,
    })
    .eq('id', fixtureIds.player)

  await service
    .from('staff_games')
    .update({ name: 'Security Fixture Game', active: true })
    .eq('id', fixtureIds.game)

  await service
    .from('staff_pricing_rules')
    .update({ price_per_player: 200000, active: true })
    .eq('id', fixtureIds.priceRule)

  await service
    .from('staff_discount_rules')
    .update({ value: 10, used_count: 0, active: true })
    .eq('id', fixtureIds.discountRule)

  await service
    .from('staff_orders')
    .update({
      payment_status: 'unpaid',
      order_status: 'confirmed',
      total: 200000,
      discount_total: 0,
    })
    .eq('id', fixtureIds.order)

  await service
    .from('sessions')
    .update({
      status: 'open',
      ticket_total_price: 200000,
      ticket_unit_price: 200000,
      ticket_status: 'confirmed',
      deleted_at: null,
    })
    .eq('id', fixtureIds.ticketSession)

  await service
    .from('session_participants')
    .update({
      checked_in: false,
      checked_in_at: null,
      payment_status: null,
      payment_amount: 200000,
      payment_splits: [],
      score: null,
    })
    .eq('session_id', fixtureIds.ticketSession)
    .eq('profile_id', fixtureIds.player)

  await service
    .from('staff_attendance_logs')
    .update({
      status: 'present',
      regular_minutes: 0,
      manager_note: 'Security fixture attendance log',
      deleted_at: null,
    })
    .eq('id', fixtureIds.attendanceLog)
}

async function expectFixture(service: SupabaseClient, label: string, table: string, idColumn: string, id: string) {
  const { data, error } = await service.from(table).select(idColumn).eq(idColumn, id).maybeSingle()
  expect(error, `${label} fixture should be readable by service role`).toBeNull()
  expect(data, `${label} fixture is missing. Run supabase/e2e/create-security-fixtures.sql on staging first.`).toBeTruthy()
}

const security = readSecurityConfig()

test.describe('direct REST write security', () => {
  test.skip(!security, 'Set SECURITY_REST_TESTS=1 to run staging/local direct REST security probes.')
  test.describe.configure({ mode: 'serial' })

  let player: SupabaseClient
  let service: SupabaseClient

  test.beforeAll(async () => {
    if (!security) {
      return
    }

    player = makeClient(security.supabaseUrl, security.supabaseAnonKey)
    service = makeClient(security.supabaseUrl, security.supabaseServiceRoleKey)

    const { error } = await player.auth.signInWithPassword({
      email: security.playerEmail,
      password: security.playerPassword,
    })

    expect(error, 'security player must be able to sign in').toBeNull()

    await expectFixture(service, 'player profile', 'profiles', 'id', fixtureIds.player)
    await expectFixture(service, 'staff game', 'staff_games', 'id', fixtureIds.game)
    await expectFixture(service, 'price rule', 'staff_pricing_rules', 'id', fixtureIds.priceRule)
    await expectFixture(service, 'discount rule', 'staff_discount_rules', 'id', fixtureIds.discountRule)
    await expectFixture(service, 'order', 'staff_orders', 'id', fixtureIds.order)
    await expectFixture(service, 'ticket session', 'sessions', 'id', fixtureIds.ticketSession)
    await expectFixture(service, 'attendance log', 'staff_attendance_logs', 'id', fixtureIds.attendanceLog)
  })

  test.beforeEach(async () => {
    await resetFixtureState(service)
  })

  test('normal player cannot promote their own profile through REST', async () => {
    await player
      .from('profiles')
      .update({
        role: 'owner',
        score_adjustment: 9999,
        loyalty_points_total: 9999,
      })
      .eq('id', fixtureIds.player)

    const { data, error } = await service
      .from('profiles')
      .select('role, score_adjustment, loyalty_points_total')
      .eq('id', fixtureIds.player)
      .single()

    expect(error).toBeNull()
    expect(data).toMatchObject({
      role: 'player',
      score_adjustment: 0,
      loyalty_points_total: 0,
    })
  })

  test('normal player cannot write staff pricing, discount, game, or order rows through REST', async () => {
    await player.from('staff_games').update({ name: 'Player Took Over' }).eq('id', fixtureIds.game)
    await player.from('staff_pricing_rules').update({ price_per_player: 1 }).eq('id', fixtureIds.priceRule)
    await player.from('staff_discount_rules').update({ value: 99, used_count: 99 }).eq('id', fixtureIds.discountRule)
    await player.from('staff_orders').update({ payment_status: 'paid', order_status: 'completed', total: 1 }).eq('id', fixtureIds.order)
    await player.from('staff_discount_rules').insert({
      name: 'Player Rogue Discount',
      discount_type: 'percentage',
      value: 99,
      valid_from: new Date().toISOString().slice(0, 10),
      active: true,
    })

    const [game, priceRule, discountRule, order] = await Promise.all([
      service.from('staff_games').select('name').eq('id', fixtureIds.game).single(),
      service.from('staff_pricing_rules').select('price_per_player').eq('id', fixtureIds.priceRule).single(),
      service.from('staff_discount_rules').select('value, used_count').eq('id', fixtureIds.discountRule).single(),
      service.from('staff_orders').select('payment_status, order_status, total').eq('id', fixtureIds.order).single(),
    ])

    expect(game.error).toBeNull()
    expect(priceRule.error).toBeNull()
    expect(discountRule.error).toBeNull()
    expect(order.error).toBeNull()
    expect(game.data).toMatchObject({ name: 'Security Fixture Game' })
    expect(priceRule.data).toMatchObject({ price_per_player: 200000 })
    expect(discountRule.data).toMatchObject({ value: 10, used_count: 0 })
    expect(order.data).toMatchObject({ payment_status: 'unpaid', order_status: 'confirmed', total: 200000 })
  })

  test('normal player cannot alter ticket payment or attendance trust fields through REST', async () => {
    await player
      .from('sessions')
      .update({
        status: 'completed',
        ticket_total_price: 1,
        ticket_unit_price: 1,
        ticket_status: 'completed',
      })
      .eq('id', fixtureIds.ticketSession)

    await player
      .from('session_participants')
      .update({
        checked_in: true,
        checked_in_at: new Date().toISOString(),
        payment_status: 'paid',
        payment_amount: 1,
        score: 9999,
      })
      .eq('session_id', fixtureIds.ticketSession)
      .eq('profile_id', fixtureIds.player)

    await player
      .from('staff_attendance_logs')
      .update({
        status: 'absent',
        regular_minutes: 999,
        manager_note: 'Player changed attendance',
      })
      .eq('id', fixtureIds.attendanceLog)

    const [session, participant, attendance] = await Promise.all([
      service.from('sessions').select('status, ticket_total_price, ticket_unit_price, ticket_status').eq('id', fixtureIds.ticketSession).single(),
      service.from('session_participants').select('checked_in, checked_in_at, payment_status, payment_amount, score').eq('session_id', fixtureIds.ticketSession).eq('profile_id', fixtureIds.player).single(),
      service.from('staff_attendance_logs').select('status, regular_minutes, manager_note').eq('id', fixtureIds.attendanceLog).single(),
    ])

    expect(session.error).toBeNull()
    expect(participant.error).toBeNull()
    expect(attendance.error).toBeNull()
    expect(session.data).toMatchObject({
      status: 'open',
      ticket_total_price: 200000,
      ticket_unit_price: 200000,
      ticket_status: 'confirmed',
    })
    expect(participant.data).toMatchObject({
      checked_in: false,
      checked_in_at: null,
      payment_status: null,
      payment_amount: 200000,
      score: null,
    })
    expect(attendance.data).toMatchObject({
      status: 'present',
      regular_minutes: 0,
      manager_note: 'Security fixture attendance log',
    })
  })
})
