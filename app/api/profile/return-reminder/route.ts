import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { nextVrenaWeekendReminderAt, returnReminderDateKey } from '../../../../lib/playerReturnMission'

export async function POST(request: Request) {
  const accessToken = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!accessToken) {
    return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return NextResponse.json({ error: 'Reminder service is unavailable.' }, { status: 503 })
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken)
  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 })
  }

  const reminderAt = nextVrenaWeekendReminderAt()
  const reminderDateKey = returnReminderDateKey(reminderAt)
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await adminClient
    .from('push_events')
    .upsert({
      body: 'Your weekly progress is waiting. Join a session and play at VRena this weekend.',
      event_key: `return-reminder:${user.id}:${reminderDateKey}`,
      event_type: 'return_reminder',
      metadata: { source: 'return_mission', timezone: 'Asia/Ho_Chi_Minh' },
      recipient_id: user.id,
      scheduled_for: reminderAt.toISOString(),
      status: 'pending',
      title: 'Ready for your next VRena run?',
      url: '/sessions',
    }, {
      ignoreDuplicates: true,
      onConflict: 'event_key',
    })

  if (error) {
    return NextResponse.json({ error: 'Could not schedule the reminder.' }, { status: 500 })
  }

  return NextResponse.json({ scheduledFor: reminderAt.toISOString() })
}
