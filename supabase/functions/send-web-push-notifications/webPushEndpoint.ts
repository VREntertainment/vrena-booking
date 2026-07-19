const ALLOWED_WEB_PUSH_HOSTS = new Set([
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
])

export function isAllowedWebPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint)
    const hostname = url.hostname.toLowerCase()

    if (url.protocol !== 'https:' || url.username || url.password || url.port) {
      return false
    }

    return ALLOWED_WEB_PUSH_HOSTS.has(hostname)
      || hostname === 'notify.windows.com'
      || hostname.endsWith('.notify.windows.com')
  } catch {
    return false
  }
}
