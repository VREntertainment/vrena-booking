import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '../../../lib/supabase/server'

function formatCurrency(value: number | null, currency = 'VND') {
  if (!value) return '-'

  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export async function POST(request: Request) {
  const resendApiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.NOTIFICATION_FROM_EMAIL || 'VRena Booking <onboarding@resend.dev>'
  const recipients = (process.env.TEAM_NOTIFICATION_EMAILS || 'contact@vre-vietnam.com,emile@vre-vietnam.com,linh@vre-vietnam.com,nhu@vre-vietnam.com')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean)

  if (!resendApiKey) {
    return NextResponse.json({ success: false, message: 'Missing RESEND_API_KEY.' }, { status: 500 })
  }

  const supabaseAdmin = createSupabaseAdminClient()

  const { sessionId } = await request.json()

  if (!sessionId) {
    return NextResponse.json({ success: false, message: 'Missing sessionId.' }, { status: 400 })
  }

  const { data: session, error: sessionError } = await supabaseAdmin
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ success: false, message: sessionError?.message || 'Session not found.' }, { status: 404 })
  }

  const [{ data: owner }, { data: participants }] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('phone, email, nickname')
      .eq('id', session.owner_id)
      .maybeSingle(),
    supabaseAdmin
      .from('session_participants')
      .select('display_name, profiles(phone, email, nickname)')
      .eq('session_id', session.id),
  ])

  const participantLines = (participants || [])
    .map((participant: any) => {
      const profile = participant.profiles
      return `- ${participant.display_name || profile?.nickname || 'Player'} | ${profile?.phone || 'No phone'} | ${profile?.email || 'No email'}`
    })
    .join('\n')

  const text = [
    'NEW VRENA SESSION',
    '',
    `Session: ${session.name}`,
    `Visibility: ${session.visibility}`,
    `Private code: ${session.invite_code || '-'}`,
    `Date: ${session.date}`,
    `Time: ${String(session.start_time).slice(0, 5)}`,
    `Duration: ${session.duration_minutes} min`,
    `Players wanted: ${session.max_players}`,
    `Arenas: ${session.arena_count || 1}`,
    `Estimated total: ${formatCurrency(session.estimated_total, session.currency || 'VND')}`,
    `Games: ${(session.game_options || []).join(', ')}`,
    '',
    'Creator',
    `Name: ${owner?.nickname || '-'}`,
    `Phone: ${owner?.phone || '-'}`,
    `Email: ${owner?.email || '-'}`,
    '',
    'Participants',
    participantLines || '-',
    '',
    `Notes: ${session.notes || '-'}`,
  ].join('\n')

  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: recipients,
      subject: `New VRena session - ${session.name} - ${session.date}`,
      text,
    }),
  })

  if (!emailResponse.ok) {
    const message = await emailResponse.text()
    return NextResponse.json({ success: false, message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
