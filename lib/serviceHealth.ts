type ServiceHealthOptions = {
  url?: string
  anonKey?: string
  fetcher?: typeof fetch
}

export async function checkServiceHealth({ url, anonKey, fetcher = fetch }: ServiceHealthOptions) {
  if (!url || !anonKey) {
    return { status: 'unavailable' as const, checks: { database: 'unavailable', auth: 'unavailable' } }
  }
  const check = async (pathname: string) => {
    try {
      const response = await fetcher(new URL(pathname, url), {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
      })
      await response.body?.cancel()
      return response.ok ? 'ok' : 'unavailable'
    } catch {
      return 'unavailable'
    }
  }
  const [database, auth] = await Promise.all([
    check('/rest/v1/staff_games?select=id&limit=1'),
    check('/auth/v1/health'),
  ])
  return {
    status: database === 'ok' && auth === 'ok' ? 'ok' as const : 'unavailable' as const,
    checks: { database, auth },
  }
}
