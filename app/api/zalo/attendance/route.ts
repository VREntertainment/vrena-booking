import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { trustedClientIp, UNKNOWN_CLIENT_IP } from '@/lib/security/requestIp'

export const runtime = 'nodejs'

const ZALO_MINI_APP_ORIGIN = 'https://h5.zdn.vn'
const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh'
const MAX_TOKEN_LENGTH = 4096

type AttendanceAction = 'status' | 'link' | 'clock_in' | 'clock_out'

type ZaloProfile = {
  id: string
  name: string | null
}

type ZaloLocation = {
  latitude: number
  longitude: number
  provider: string | null
}

type ZaloSettings = {
  enabled: boolean
  require_location: boolean
  allow_timesheet: boolean
  allow_payslip: boolean
}

type ZaloIdentity = {
  id: string
  staff_profile_id: string
  zalo_app_user_id: string
  revoked_at: string | null
}

type EmployeeProfile = {
  profile_id: string
  employee_code: string | null
  attendance_number: string | null
  legal_name: string | null
  personal_phone: string | null
  job_title: string | null
  main_work_location: string | null
  contract_status: string | null
  active: boolean
}

function requestOrigin(request: NextRequest) {
  return request.headers.get('origin')?.trim() || null
}

function isAllowedOrigin(origin: string | null) {
  if (!origin || origin === ZALO_MINI_APP_ORIGIN) return true
  if (process.env.NODE_ENV === 'production') return false

  try {
    const parsed = new URL(origin)
    return parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)
  } catch {
    return false
  }
}

function corsHeaders(origin: string | null) {
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  })

  if (origin && isAllowedOrigin(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
  }

  return headers
}

function jsonResponse(request: NextRequest, body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: corsHeaders(requestOrigin(request)),
  })
}

function cleanString(value: unknown, maxLength = 255) {
  if (typeof value !== 'string') return ''
  return Array.from(value.trim()).slice(0, maxLength).join('')
}

function bearerToken(request: NextRequest) {
  const authorization = request.headers.get('authorization') || ''
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i)
  const token = match?.[1]?.trim() || ''
  if (!token || token.length > MAX_TOKEN_LENGTH) return ''
  return token
}

function normalizePhone(value: unknown) {
  let digits = cleanString(value, 40).replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('84')) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = digits.slice(1)
  return digits.length >= 8 && digits.length <= 11 ? digits : ''
}

function vietnamDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

async function fetchZaloJson(url: string, headers: HeadersInit) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload || typeof payload !== 'object') {
      throw new Error('Zalo could not verify this request.')
    }
    return payload as Record<string, unknown>
  } finally {
    clearTimeout(timeout)
  }
}

async function verifyZaloAccessToken(accessToken: string): Promise<ZaloProfile> {
  const payload = await fetchZaloJson('https://graph.zalo.me/v2.0/me?fields=id,name', {
    access_token: accessToken,
  })
  const data = payload.data && typeof payload.data === 'object'
    ? payload.data as Record<string, unknown>
    : payload
  const id = cleanString(data.id, 255)

  if (!id || (typeof payload.error === 'number' && payload.error !== 0)) {
    throw new Error('Zalo session expired. Reopen the Mini App and try again.')
  }

  return {
    id,
    name: cleanString(data.name, 120) || null,
  }
}

async function decodeZaloPhone(accessToken: string, phoneToken: string) {
  const appSecret = process.env.ZALO_APP_SECRET
  if (!appSecret) throw new Error('Zalo employee linking is not configured yet.')

  const payload = await fetchZaloJson('https://graph.zalo.me/v2.0/me/info', {
    access_token: accessToken,
    code: phoneToken,
    secret_key: appSecret,
  })
  const data = payload.data && typeof payload.data === 'object'
    ? payload.data as Record<string, unknown>
    : {}
  const phone = normalizePhone(data.number)

  if (!phone || (typeof payload.error === 'number' && payload.error !== 0)) {
    throw new Error('Zalo could not verify the phone number. Please approve access and try again.')
  }

  return phone
}

async function decodeZaloLocation(accessToken: string, locationToken: string): Promise<ZaloLocation> {
  const appSecret = process.env.ZALO_APP_SECRET
  if (!appSecret) throw new Error('Zalo employee attendance is not configured yet.')

  const payload = await fetchZaloJson('https://graph.zalo.me/v2.0/me/info', {
    access_token: accessToken,
    code: locationToken,
    secret_key: appSecret,
  })
  const data = payload.data && typeof payload.data === 'object'
    ? payload.data as Record<string, unknown>
    : {}
  const latitude = Number(data.latitude)
  const longitude = Number(data.longitude)
  const provider = cleanString(data.provider, 40) || null
  const rawTimestamp = typeof data.timestamp === 'string' || typeof data.timestamp === 'number'
    ? data.timestamp
    : null
  const numericTimestamp = Number(rawTimestamp)
  const timestampMs = Number.isFinite(numericTimestamp)
    ? (numericTimestamp < 1_000_000_000_000 ? numericTimestamp * 1000 : numericTimestamp)
    : Date.parse(String(rawTimestamp || ''))

  if (
    (typeof payload.error === 'number' && payload.error !== 0)
    || !Number.isFinite(latitude)
    || latitude < -90
    || latitude > 90
    || !Number.isFinite(longitude)
    || longitude < -180
    || longitude > 180
  ) {
    throw new Error('Zalo could not verify your current location. Approve location access and try again.')
  }

  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
    throw new Error('Your location proof expired. Try clocking again to request a fresh location.')
  }

  return { latitude, longitude, provider }
}

async function consumeRateLimit(
  adminClient: SupabaseClient,
  subject: string,
  limit: number,
  windowSeconds: number,
) {
  const { error } = await adminClient.rpc('consume_rate_limit', {
    p_action: 'staff_config_write',
    p_limit: limit,
    p_window_seconds: windowSeconds,
    p_subject: subject,
  })
  if (error) {
    const message = cleanString(error.message, 200)
    throw new Error(
      message.includes('Too many attempts')
        ? message
        : 'Attendance security checks are temporarily unavailable.',
    )
  }
}

function clockErrorMessage(value: unknown) {
  const message = cleanString(value, 240)
  const safeMessages = [
    'Unsupported attendance action.',
    'A linked Zalo identity is required.',
    'The Zalo account is not linked to an employee.',
    'The employee profile is not active.',
    'There is no open attendance shift to clock out.',
    'Zalo employee attendance is disabled.',
    'A current location is required to record attendance.',
    'Attendance location is not configured.',
    'You are outside an approved check-in location.',
  ]
  return safeMessages.includes(message) || message.includes('Too many attempts')
    ? message
    : 'Attendance could not be recorded.'
}

async function findEmployeeByPhone(adminClient: SupabaseClient, verifiedPhone: string) {
  const { data: employees, error: employeeError } = await adminClient
    .from('staff_employee_profiles')
    .select('profile_id, employee_code, attendance_number, legal_name, personal_phone, job_title, main_work_location, contract_status, active')
    .eq('active', true)
    .in('contract_status', ['active', 'probation'])
    .is('deleted_at', null)

  if (employeeError) throw new Error('Employee records are unavailable.')

  const employeeRows = (employees || []) as EmployeeProfile[]
  const profileIds = employeeRows.map((employee) => employee.profile_id)
  const profilePhoneById = new Map<string, string>()

  if (profileIds.length > 0) {
    const { data: profiles, error: profileError } = await adminClient
      .from('profiles')
      .select('id, phone')
      .in('id', profileIds)
      .is('deleted_at', null)

    if (profileError) throw new Error('Employee records are unavailable.')
    for (const profile of profiles || []) {
      profilePhoneById.set(cleanString(profile.id), normalizePhone(profile.phone))
    }
  }

  const matches = employeeRows.filter((employee) => {
    const employeePhone = normalizePhone(employee.personal_phone)
    const profilePhone = profilePhoneById.get(employee.profile_id) || ''
    return employeePhone === verifiedPhone || profilePhone === verifiedPhone
  })

  if (matches.length === 0) {
    throw new Error('This phone number is not assigned to an active employee profile.')
  }
  if (matches.length > 1) {
    throw new Error('This phone number matches more than one employee. Ask a manager to correct the HR records.')
  }

  return matches[0]
}

async function linkZaloIdentity(
  adminClient: SupabaseClient,
  employee: EmployeeProfile,
  zaloProfile: ZaloProfile,
  phone: string,
) {
  const [byUserResult, byEmployeeResult] = await Promise.all([
    adminClient
      .from('staff_zalo_identities')
      .select('id, staff_profile_id, zalo_app_user_id, revoked_at')
      .eq('zalo_app_user_id', zaloProfile.id)
      .maybeSingle(),
    adminClient
      .from('staff_zalo_identities')
      .select('id, staff_profile_id, zalo_app_user_id, revoked_at')
      .eq('staff_profile_id', employee.profile_id)
      .maybeSingle(),
  ])

  if (byUserResult.error || byEmployeeResult.error) {
    throw new Error('The employee link could not be checked.')
  }

  const byUser = byUserResult.data as ZaloIdentity | null
  const byEmployee = byEmployeeResult.data as ZaloIdentity | null

  if (byUser && byUser.staff_profile_id !== employee.profile_id) {
    throw new Error('This Zalo account is already linked to another employee.')
  }
  if (byEmployee && byEmployee.zalo_app_user_id !== zaloProfile.id) {
    throw new Error('This employee is already linked to another Zalo account. Ask a manager to reset it.')
  }

  const now = new Date().toISOString()
  const values = {
    staff_profile_id: employee.profile_id,
    zalo_app_user_id: zaloProfile.id,
    verified_phone_last_four: phone.slice(-4),
    linked_at: now,
    last_verified_at: now,
    last_seen_at: now,
    revoked_at: null,
    revoked_by: null,
    revoke_reason: null,
  }

  let identity: ZaloIdentity | null = null
  if (byUser || byEmployee) {
    const existing = byUser || byEmployee
    const { data, error } = await adminClient
      .from('staff_zalo_identities')
      .update(values)
      .eq('id', existing!.id)
      .select('id, staff_profile_id, zalo_app_user_id, revoked_at')
      .single()
    if (error) throw new Error('The Zalo account could not be linked.')
    identity = data as ZaloIdentity
  } else {
    const { data, error } = await adminClient
      .from('staff_zalo_identities')
      .insert(values)
      .select('id, staff_profile_id, zalo_app_user_id, revoked_at')
      .single()
    if (error) throw new Error('The Zalo account could not be linked.')
    identity = data as ZaloIdentity
  }

  const { error: eventError } = await adminClient
    .from('staff_zalo_attendance_events')
    .insert({
      identity_id: identity.id,
      staff_profile_id: employee.profile_id,
      event_type: 'link',
      event_payload: { phone_last_four: phone.slice(-4) },
    })
  if (eventError) throw new Error('The Zalo account was linked, but its audit event could not be recorded.')

  return identity
}

async function statusForIdentity(adminClient: SupabaseClient, identity: ZaloIdentity, settings: ZaloSettings) {
  const today = vietnamDate()
  const [employeeResult, profileResult, shiftsResult, openLogResult, todayLogResult] = await Promise.all([
    adminClient
      .from('staff_employee_profiles')
      .select('profile_id, employee_code, attendance_number, legal_name, personal_phone, job_title, main_work_location, contract_status, active')
      .eq('profile_id', identity.staff_profile_id)
      .is('deleted_at', null)
      .maybeSingle(),
    adminClient
      .from('profiles')
      .select('id, full_name, nickname')
      .eq('id', identity.staff_profile_id)
      .is('deleted_at', null)
      .maybeSingle(),
    adminClient
      .from('staff_schedule_shifts')
      .select('id, shift_date, start_time, end_time, break_minutes, location, shift_role, status')
      .eq('staff_profile_id', identity.staff_profile_id)
      .eq('shift_date', today)
      .in('status', ['published', 'completed'])
      .is('deleted_at', null)
      .order('start_time', { ascending: true }),
    adminClient
      .from('staff_attendance_logs')
      .select('id, work_date, clock_in_at, clock_out_at, break_minutes, status, regular_minutes, overtime_minutes, night_minutes')
      .eq('staff_profile_id', identity.staff_profile_id)
      .not('clock_in_at', 'is', null)
      .is('clock_out_at', null)
      .is('deleted_at', null)
      .order('clock_in_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    adminClient
      .from('staff_attendance_logs')
      .select('id, work_date, clock_in_at, clock_out_at, break_minutes, status, regular_minutes, overtime_minutes, night_minutes')
      .eq('staff_profile_id', identity.staff_profile_id)
      .eq('work_date', today)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (employeeResult.error || profileResult.error || shiftsResult.error || openLogResult.error || todayLogResult.error) {
    throw new Error('Attendance status is unavailable.')
  }

  const employee = employeeResult.data as EmployeeProfile | null
  if (!employee || !employee.active || !['active', 'probation'].includes(employee.contract_status || 'active')) {
    throw new Error('The linked employee profile is not active.')
  }

  const publicProfile = profileResult.data as { full_name?: string | null; nickname?: string | null } | null
  const displayName = cleanString(employee.legal_name, 120)
    || cleanString(publicProfile?.full_name, 120)
    || cleanString(publicProfile?.nickname, 80)
    || employee.employee_code
    || employee.attendance_number
    || 'VRena employee'
  const attendanceLog = openLogResult.data || todayLogResult.data || null

  await adminClient
    .from('staff_zalo_identities')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', identity.id)

  return {
    linked: true,
    serverTime: new Date().toISOString(),
    workDate: today,
    employee: {
      displayName,
      employeeCode: employee.employee_code || employee.attendance_number,
      jobTitle: employee.job_title,
      location: employee.main_work_location,
    },
    shifts: shiftsResult.data || [],
    attendanceLog,
    canClockIn: !openLogResult.data,
    canClockOut: Boolean(openLogResult.data),
    locationRequired: settings.require_location,
    allowTimesheet: settings.allow_timesheet,
    allowPayslip: settings.allow_payslip,
  }
}

function actionErrorStatus(message: string) {
  if (message.includes('Too many attempts')) return 429
  if (message.includes('temporarily unavailable')) return 503
  if (message === 'Attendance could not be recorded.') return 500
  if (message.includes('not active')) return 403
  if (message.includes('disabled')) return 403
  if (message.includes('current location') || message.includes('location proof') || message.includes('outside an approved')) return 403
  if (message.includes('already linked') || message.includes('no open attendance shift')) return 409
  if (message.includes('not configured')) return 503
  if (message.includes('Zalo session expired')) return 401
  return 400
}

export async function OPTIONS(request: NextRequest) {
  const origin = requestOrigin(request)
  if (!isAllowedOrigin(origin)) return new NextResponse(null, { status: 403 })
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

export async function POST(request: NextRequest) {
  const origin = requestOrigin(request)
  if (!isAllowedOrigin(origin)) return jsonResponse(request, { error: 'Origin not allowed.' }, 403)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(request, { error: 'Employee attendance is not configured on this environment.' }, 503)
  }

  const accessToken = bearerToken(request)
  if (!accessToken) return jsonResponse(request, { error: 'A valid Zalo session is required.' }, 401)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonResponse(request, { error: 'Invalid attendance request.' }, 400)
  }

  const action = cleanString(body.action, 20) as AttendanceAction
  if (!['status', 'link', 'clock_in', 'clock_out'].includes(action)) {
    return jsonResponse(request, { error: 'Unsupported attendance action.' }, 400)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const ip = trustedClientIp(request.headers)
    const tokenHash = createHash('sha256').update(accessToken).digest('hex').slice(0, 24)
    const preAuthSubject = ip === UNKNOWN_CLIENT_IP ? `token:${tokenHash}` : `ip:${ip}`
    await consumeRateLimit(adminClient, `zalo-preauth:${preAuthSubject}`, 40, 60)

    const zaloProfile = await verifyZaloAccessToken(accessToken)
    await consumeRateLimit(adminClient, `zalo:${action}:${zaloProfile.id}`, action === 'status' ? 60 : 12, 60)

    const { data: settingsData, error: settingsError } = await adminClient
      .from('staff_zalo_settings')
      .select('enabled, require_location, allow_timesheet, allow_payslip')
      .eq('id', 'default')
      .single()
    if (settingsError || !settingsData) throw new Error('Zalo employee attendance is not configured yet.')
    const settings = settingsData as ZaloSettings
    if (!settings.enabled) throw new Error('Zalo employee attendance is disabled.')

    if (action === 'link') {
      const phoneToken = cleanString(body.phoneToken, MAX_TOKEN_LENGTH)
      if (!phoneToken) return jsonResponse(request, { error: 'Approve phone access in Zalo to link your employee profile.' }, 400)

      const phone = await decodeZaloPhone(accessToken, phoneToken)
      const employee = await findEmployeeByPhone(adminClient, phone)
      const identity = await linkZaloIdentity(adminClient, employee, zaloProfile, phone)
      return jsonResponse(request, await statusForIdentity(adminClient, identity, settings))
    }

    const { data: identityData, error: identityError } = await adminClient
      .from('staff_zalo_identities')
      .select('id, staff_profile_id, zalo_app_user_id, revoked_at')
      .eq('zalo_app_user_id', zaloProfile.id)
      .is('revoked_at', null)
      .maybeSingle()

    if (identityError) throw new Error('The employee link could not be checked.')
    const identity = identityData as ZaloIdentity | null

    if (!identity) {
      return jsonResponse(request, {
        linked: false,
        serverTime: new Date().toISOString(),
        message: 'Link this Zalo account to your active employee profile before using attendance.',
      })
    }

    if (action === 'status') {
      return jsonResponse(request, await statusForIdentity(adminClient, identity, settings))
    }

    const locationToken = cleanString(body.locationToken, MAX_TOKEN_LENGTH)
    if (settings.require_location && !locationToken) {
      throw new Error('A current location is required to record attendance.')
    }
    const location = settings.require_location
      ? await decodeZaloLocation(accessToken, locationToken)
      : null

    const { data: clockResult, error: clockError } = await adminClient.rpc('staff_zalo_attendance_clock', {
      p_identity_id: identity.id,
      p_action: action,
      p_latitude: location?.latitude ?? null,
      p_longitude: location?.longitude ?? null,
      p_location_provider: location?.provider ?? null,
    })
    if (clockError) throw new Error(clockErrorMessage(clockError.message))

    const status = await statusForIdentity(adminClient, identity, settings)
    return jsonResponse(request, { ...status, result: clockResult })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Attendance request failed.'
    return jsonResponse(request, { error: message }, actionErrorStatus(message))
  }
}
