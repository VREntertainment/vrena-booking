import { checkServiceHealth } from '../../../lib/serviceHealth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const health = await checkServiceHealth({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })
  return Response.json(health, {
    status: health.status === 'ok' ? 200 : 503,
    headers: { 'Cache-Control': health.status === 'ok' ? 'public, max-age=0, s-maxage=15' : 'no-store' },
  })
}
