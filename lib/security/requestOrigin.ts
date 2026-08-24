export function isSameOriginRequest(headers: Headers, expectedOrigin: string) {
  const suppliedOrigin = headers.get('origin')
  if (!suppliedOrigin) return false

  try {
    if (new URL(suppliedOrigin).origin !== new URL(expectedOrigin).origin) return false
  } catch {
    return false
  }

  return headers.get('sec-fetch-site') !== 'cross-site'
}
