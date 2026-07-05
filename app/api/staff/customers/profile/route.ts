import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { staffConsoleRoleRank as staffRank } from '@/lib/staffRoles'

export const runtime = 'nodejs'

const profileGenderValues = ['male', 'female', 'non_binary', 'prefer_not_to_say', 'self_describe'] as const
const profileSelect = 'id, phone, full_name, nickname, email, birthday, gender, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto, role, score_adjustment, loyalty_points_total, total_projectiles_override, anonymous_mode, anonymous_callsign, marketing_consent, marketing_consent_at, marketing_opted_out_at'

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function metadataEmail(source: unknown) {
  if (!source || typeof source !== 'object') return null
  const value = (source as Record<string, unknown>).email
  return typeof value === 'string' ? value : null
}

function authUserEmails(user: {
  email?: string | null
  user_metadata?: unknown
  app_metadata?: unknown
  identities?: Array<{ identity_data?: unknown } | null> | null
}) {
  const emails = [
    user.email,
    metadataEmail(user.user_metadata),
    metadataEmail(user.app_metadata),
    ...(user.identities || []).map((identity) => metadataEmail(identity?.identity_data)),
  ]

  return emails.filter((email): email is string => Boolean(email))
}

function cleanNullableString(value: unknown, maxLength = 255) {
  if (typeof value !== 'string') return null
  const cleaned = value.trim()
  if (!cleaned) return null
  return Array.from(cleaned).slice(0, maxLength).join('')
}

function cleanRequiredString(value: unknown, maxLength = 255) {
  return cleanNullableString(value, maxLength) || ''
}

function cleanBirthday(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  return value
}

function cleanGender(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string' && profileGenderValues.includes(value as typeof profileGenderValues[number])) return value
  return undefined
}

export async function PATCH(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonError('Staff profile editing is not configured on this environment.', 500)
  }

  const authorization = request.headers.get('authorization') || ''
  const accessToken = authorization.replace(/^Bearer\s+/i, '').trim()
  if (!accessToken) return jsonError('Staff session required.', 401)

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  })
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await authClient.auth.getUser(accessToken)
  if (userError || !userData.user) return jsonError(userError?.message || 'Staff session required.', 401)

  const { data: actorProfile, error: actorError } = await adminClient
    .from('profiles')
    .select('id, email, role, deleted_at')
    .eq('id', userData.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (actorError) return jsonError(actorError.message, 500)

  const userEmails = authUserEmails(userData.user)
  const actorRank = Math.max(
    staffRank(actorProfile?.role, actorProfile?.email),
    ...userEmails.map((email) => staffRank(userData.user.app_metadata?.role as string | undefined, email)),
  )
  if (actorRank < 50) return jsonError('Staff access required.', 403)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid customer profile payload.', 400)
  }

  const profileId = cleanRequiredString(body.profileId)
  if (!profileId) return jsonError('Profile id is required.', 400)

  const fullName = cleanRequiredString(body.fullName, 120)
  if (!fullName) return jsonError('Enter the customer name.', 400)

  const birthday = cleanBirthday(body.birthday)
  if (birthday === undefined) return jsonError('Birthday must use YYYY-MM-DD.', 400)

  const gender = cleanGender(body.gender)
  if (gender === undefined) return jsonError('Choose a valid gender value.', 400)

  const updates = {
    full_name: fullName,
    nickname: cleanNullableString(body.nickname, 80),
    phone: cleanNullableString(body.phone, 40),
    birthday,
    gender,
    profile_motto: cleanNullableString(body.profileMotto, 20),
    updated_at: new Date().toISOString(),
  }

  const { data: updatedProfile, error: updateError } = await adminClient
    .from('profiles')
    .update(updates)
    .eq('id', profileId)
    .is('deleted_at', null)
    .select(profileSelect)
    .single()

  if (updateError) return jsonError(updateError.message, 500)

  return NextResponse.json({ profile: updatedProfile })
}
