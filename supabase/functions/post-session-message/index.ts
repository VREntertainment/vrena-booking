import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
}

const ADMIN_EMAILS = ['emile@vre-vietnam.com']
const MODERATION_MODEL = 'omni-moderation-latest'

type MessageType = 'announcement' | 'comment'
type ModerationStatus = 'approved' | 'pending_review'

type ModerationResult = {
  status: ModerationStatus
  reason: string | null
  categories: Record<string, unknown>
  score: number | null
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function isAdmin(profile: { role?: string | null; email?: string | null } | null) {
  return Boolean(profile?.role === 'admin' || (profile?.email && ADMIN_EMAILS.includes(profile.email.toLowerCase())))
}

function moderationScore(categoryScores: Record<string, unknown>) {
  const values = Object.values(categoryScores).filter((value): value is number => typeof value === 'number')
  if (!values.length) return null
  return Math.max(...values)
}

async function moderateText(input: string, trustedAuthor: boolean): Promise<ModerationResult> {
  if (trustedAuthor) {
    return {
      status: 'approved',
      reason: null,
      categories: {},
      score: null,
    }
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    return {
      status: 'pending_review',
      reason: 'moderation_unavailable',
      categories: {},
      score: null,
    }
  }

  try {
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODERATION_MODEL,
        input,
      }),
    })

    if (!response.ok) {
      return {
        status: 'pending_review',
        reason: 'moderation_unavailable',
        categories: {},
        score: null,
      }
    }

    const data = await response.json()
    const result = data?.results?.[0]
    const categories = (result?.categories ?? {}) as Record<string, unknown>
    const categoryScores = (result?.category_scores ?? {}) as Record<string, unknown>
    const flaggedCategories = Object.entries(categories)
      .filter(([, flagged]) => flagged === true)
      .map(([category]) => category)

    return {
      status: result?.flagged ? 'pending_review' : 'approved',
      reason: flaggedCategories.length ? flaggedCategories.join(',') : null,
      categories,
      score: moderationScore(categoryScores),
    }
  } catch {
    return {
      status: 'pending_review',
      reason: 'moderation_unavailable',
      categories: {},
      score: null,
    }
  }
}

async function handleRequest(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Server is missing Supabase moderation configuration.' }, 500)
  }

  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) {
    return jsonResponse({ error: 'Missing session token.' }, 401)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  const authUser = authData?.user
  if (authError || !authUser) {
    return jsonResponse({ error: 'Invalid session token.' }, 401)
  }

  let payload: { session_id?: string; message_type?: MessageType; body?: string }
  try {
    payload = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400)
  }

  const sessionId = payload.session_id
  const messageType = payload.message_type
  const body = (payload.body ?? '').trim()

  if (!sessionId || (messageType !== 'announcement' && messageType !== 'comment')) {
    return jsonResponse({ error: 'Invalid message request.' }, 400)
  }

  if (body.length < 1 || body.length > 500) {
    return jsonResponse({ error: 'Message must be between 1 and 500 characters.' }, 400)
  }

  const [{ data: profile }, { data: session }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, nickname, email, role, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto')
      .eq('id', authUser.id)
      .single(),
    supabase
      .from('sessions')
      .select('id, owner_id')
      .eq('id', sessionId)
      .single(),
  ])

  if (!profile || !session) {
    return jsonResponse({ error: 'Profile or session not found.' }, 404)
  }

  const admin = isAdmin(profile)
  const owner = session.owner_id === authUser.id
  const { data: participant } = await supabase
    .from('session_participants')
    .select('id')
    .eq('session_id', sessionId)
    .eq('profile_id', authUser.id)
    .maybeSingle()

  if (messageType === 'announcement' && !owner && !admin) {
    return jsonResponse({ error: 'Only the session creator or admin can post announcements.' }, 403)
  }

  if (messageType === 'comment' && !participant && !owner && !admin) {
    return jsonResponse({ error: 'Only session participants can comment.' }, 403)
  }

  const moderation = await moderateText(body, owner || admin)
  const displayName = profile.nickname || profile.full_name || profile.email || 'Player'

  const { data: message, error: insertError } = await supabase
    .from('session_messages')
    .insert({
      session_id: sessionId,
      author_id: authUser.id,
      author_display_name: displayName,
      author_avatar_url: profile.avatar_url,
      author_avatar_emoji: profile.avatar_emoji,
      author_avatar_initials: profile.avatar_initials,
      author_avatar_color: profile.avatar_color,
      author_avatar_text_color: profile.avatar_text_color,
      author_profile_motto: profile.profile_motto,
      message_type: messageType,
      body,
      moderation_status: moderation.status,
      moderation_reason: moderation.reason,
      moderation_categories: moderation.categories,
      moderation_score: moderation.score,
      reviewed_by: moderation.status === 'approved' && (owner || admin) ? authUser.id : null,
      reviewed_at: moderation.status === 'approved' && (owner || admin) ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (insertError) {
    return jsonResponse({ error: insertError.message }, 400)
  }

  return jsonResponse({ message })
}

serve(async (request) => {
  try {
    return await handleRequest(request)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected function error.'
    return jsonResponse({ error: message }, 500)
  }
})
