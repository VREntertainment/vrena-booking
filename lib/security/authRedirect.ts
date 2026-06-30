function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function trustedAppOrigin() {
  const rawUrl = cleanString(process.env.NEXT_PUBLIC_SITE_URL)
  if (!rawUrl) return null

  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (url.username || url.password) return null
    return url.origin
  } catch {
    return null
  }
}

export function resolveTrustedAppRedirect(value: unknown, fallbackPath = '/') {
  const origin = trustedAppOrigin()
  if (!origin) {
    return {
      ok: false as const,
      status: 500,
      message: 'App URL is not configured on this environment.',
    }
  }

  const rawRedirect = cleanString(value)
  if (!rawRedirect) {
    return {
      ok: true as const,
      url: new URL(fallbackPath, origin).toString(),
    }
  }

  if (rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')) {
    return {
      ok: true as const,
      url: new URL(rawRedirect, origin).toString(),
    }
  }

  try {
    const redirectUrl = new URL(rawRedirect)
    if (redirectUrl.origin !== origin || redirectUrl.username || redirectUrl.password) {
      return {
        ok: false as const,
        status: 400,
        message: 'Redirect URL is not allowed.',
      }
    }

    return {
      ok: true as const,
      url: new URL(`${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`, origin).toString(),
    }
  } catch {
    return {
      ok: false as const,
      status: 400,
      message: 'Redirect URL is not allowed.',
    }
  }
}
