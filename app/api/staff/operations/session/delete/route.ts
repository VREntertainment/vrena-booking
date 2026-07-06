import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { staffConsoleRoleRank as staffRank } from '@/lib/staffRoles'

export const runtime = 'nodejs'

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
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
  return [
    user.email,
    metadataEmail(user.user_metadata),
    metadataEmail(user.app_metadata),
    ...(user.identities || []).map((identity) => metadataEmail(identity?.identity_data)),
  ].filter((email): email is string => Boolean(email))
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonError('Staff session delete is not configured on this environment.', 500)
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
    return jsonError('Invalid delete payload.', 400)
  }

  const sessionId = cleanString(body.sessionId)
  const deleteReason = cleanString(body.deleteReason) || 'Deleted from Staff Console'
  if (!sessionId) return jsonError('Session id is required.', 400)

  const { data: session, error: sessionError } = await adminClient
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .is('deleted_at', null)
    .maybeSingle()

  if (sessionError) return jsonError(sessionError.message, 500)
  if (!session) return jsonError('Session not found.', 404)

  const now = new Date().toISOString()

  const { error: updateSessionError } = await adminClient
    .from('sessions')
    .update({
      status: 'cancelled',
      deleted_at: now,
      deleted_by: userData.user.id,
      delete_reason: deleteReason,
      updated_at: now,
    })
    .eq('id', sessionId)
    .is('deleted_at', null)

  if (updateSessionError) return jsonError(updateSessionError.message, 500)

  const { data: participants, error: participantsError } = await adminClient
    .from('session_participants')
    .update({
      deleted_at: now,
      deleted_by: userData.user.id,
      delete_reason: deleteReason,
      updated_at: now,
    })
    .eq('session_id', sessionId)
    .is('deleted_at', null)
    .select('id')

  if (participantsError) return jsonError(participantsError.message, 500)

  const { data: linkedOrders, error: linkedOrdersError } = await adminClient
    .from('staff_orders')
    .select('id, internal_note')
    .eq('session_id', sessionId)
    .not('order_status', 'in', '(cancelled,refunded)')

  if (linkedOrdersError) return jsonError(linkedOrdersError.message, 500)

  const orderUpdates = await Promise.all((linkedOrders || []).map((order) => adminClient
    .from('staff_orders')
    .update({
      order_status: 'cancelled',
      updated_at: now,
      internal_note: [
        cleanString((order as { internal_note?: unknown }).internal_note),
        `Session deleted from Staff Console by ${userData.user.id} at ${now}`,
      ].filter(Boolean).join('\n'),
    })
    .eq('id', order.id)))

  const orderUpdateError = orderUpdates.find((result) => result.error)?.error
  if (orderUpdateError) return jsonError(orderUpdateError.message, 500)

  await adminClient.from('audit_logs').insert({
    actor_user_id: userData.user.id,
    action: 'staff_session_deleted',
    entity_type: 'sessions',
    entity_id: sessionId,
    old_value: session,
    new_value: {
      deleted: true,
      booking_type: (session as { booking_type?: unknown }).booking_type || null,
      participants_deleted: participants?.length || 0,
      orders_cancelled: linkedOrders?.length || 0,
      reason: deleteReason,
      source: 'staff_api_fallback',
    },
  })

  return NextResponse.json({
    deleted: true,
    session_id: sessionId,
    participants_deleted: participants?.length || 0,
    orders_cancelled: linkedOrders?.length || 0,
  })
}
