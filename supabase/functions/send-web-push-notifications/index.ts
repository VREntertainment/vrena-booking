import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.0'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Max-Age': '86400',
}

type PushEventRow = {
  id: string
  recipient_id: string
  event_key: string
  event_type: string
  session_id: string | null
  title: string
  body: string
  url: string
  metadata: Record<string, unknown>
}

type PushSubscriptionRow = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
  fail_count: number | null
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

function isAuthorized(request: Request, serviceRoleKey: string) {
  const cronSecret = Deno.env.get('PUSH_CRON_SECRET')
  const requestSecret = request.headers.get('x-cron-secret')
  if (cronSecret && requestSecret === cronSecret) return true

  const authorization = request.headers.get('authorization') || ''
  return Boolean(serviceRoleKey && authorization === `Bearer ${serviceRoleKey}`)
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

function statusCode(error: unknown) {
  if (typeof error === 'object' && error && 'statusCode' in error) {
    const value = Number((error as { statusCode?: unknown }).statusCode)
    return Number.isFinite(value) ? value : null
  }

  return null
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || ''
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || ''
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:contact@vre-vietnam.com'

  if (!isAuthorized(request, serviceRoleKey)) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Missing Supabase service configuration' }, 500)
  }

  if (!vapidPublicKey || !vapidPrivateKey) {
    return jsonResponse({ error: 'Missing VAPID secrets' }, 500)
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const now = new Date().toISOString()
  const { error: reminderError } = await supabase.rpc('enqueue_due_session_reminders')
  if (reminderError) {
    return jsonResponse({ error: reminderError.message }, 500)
  }

  const { data: events, error: eventError } = await supabase
    .from('push_events')
    .select('id, recipient_id, event_key, event_type, session_id, title, body, url, metadata')
    .eq('status', 'pending')
    .is('processed_at', null)
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true })
    .limit(100)

  if (eventError) return jsonResponse({ error: eventError.message }, 500)

  let sent = 0
  let failed = 0
  let withoutSubscription = 0

  for (const event of (events || []) as PushEventRow[]) {
    const { data: subscriptions, error: subscriptionError } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, fail_count')
      .eq('profile_id', event.recipient_id)
      .is('disabled_at', null)

    if (subscriptionError) {
      failed += 1
      await supabase
        .from('push_events')
        .update({
          processed_at: new Date().toISOString(),
          status: 'failed',
          last_error: subscriptionError.message,
        })
        .eq('id', event.id)
      continue
    }

    if (!subscriptions || subscriptions.length === 0) {
      withoutSubscription += 1
      await supabase
        .from('push_events')
        .update({
          processed_at: new Date().toISOString(),
          status: 'no_subscription',
          last_error: 'No active push subscription',
        })
        .eq('id', event.id)
      continue
    }

    let eventSent = 0
    let lastError = ''

    for (const subscription of subscriptions as PushSubscriptionRow[]) {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        }, JSON.stringify({
          title: event.title,
          body: event.body,
          url: event.url || '/',
          tag: event.event_key,
          icon: '/vrena-icon.png',
          badge: '/vrena-icon.png',
          metadata: event.metadata || {},
        }))

        eventSent += 1
        await supabase
          .from('push_subscriptions')
          .update({
            fail_count: 0,
            last_error: null,
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id)
      } catch (error) {
        const message = errorMessage(error).slice(0, 500)
        lastError = message
        const code = statusCode(error)
        const nextFailCount = (subscription.fail_count || 0) + 1

        await supabase
          .from('push_subscriptions')
          .update({
            disabled_at: code === 404 || code === 410 || nextFailCount >= 5 ? new Date().toISOString() : null,
            fail_count: nextFailCount,
            last_error: message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id)
      }
    }

    if (eventSent > 0) {
      sent += eventSent
      await supabase
        .from('push_events')
        .update({
          processed_at: new Date().toISOString(),
          status: 'sent',
          last_error: null,
        })
        .eq('id', event.id)
    } else {
      failed += 1
      await supabase
        .from('push_events')
        .update({
          processed_at: new Date().toISOString(),
          status: 'failed',
          last_error: lastError || 'Push delivery failed',
        })
        .eq('id', event.id)
    }
  }

  return jsonResponse({
    ok: true,
    events: events?.length || 0,
    sent,
    failed,
    withoutSubscription,
  })
})
