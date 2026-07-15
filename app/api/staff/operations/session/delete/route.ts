import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hasVerifiedAal2Session } from '@/lib/security/staffMfa'

export const runtime = 'nodejs'

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

type DeleteSessionResult = {
  session_id?: unknown
  participants_deleted?: unknown
  orders_cancelled?: unknown
} | null

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonError('Staff session delete is not configured on this environment.', 500)
  }

  const authorization = request.headers.get('authorization') || ''
  const accessToken = authorization.replace(/^Bearer\s+/i, '').trim()
  if (!accessToken) return jsonError('Staff session required.', 401)

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })

  const { data: userData, error: userError } = await authClient.auth.getUser(accessToken)
  if (userError || !userData.user) return jsonError(userError?.message || 'Staff session required.', 401)
  if (!await hasVerifiedAal2Session(authClient, accessToken)) {
    return jsonError('Staff two-step verification required.', 403)
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid delete payload.', 400)
  }

  const sessionId = cleanString(body.sessionId)
  const deleteReason = cleanString(body.deleteReason) || 'Deleted from Staff Console'
  if (!sessionId) return jsonError('Session id is required.', 400)

  const { data, error } = await authClient.rpc('staff_delete_session_operation', {
    p_session_id: sessionId,
    p_delete_reason: deleteReason,
  })

  if (error) return jsonError(error.message, 400)

  const result = data as DeleteSessionResult

  return NextResponse.json({
    deleted: true,
    session_id: cleanString(result?.session_id) || sessionId,
    participants_deleted: typeof result?.participants_deleted === 'number' ? result.participants_deleted : 0,
    orders_cancelled: typeof result?.orders_cancelled === 'number' ? result.orders_cancelled : 0,
  })
}
