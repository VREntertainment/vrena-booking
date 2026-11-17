/** Listen only while the calendar is mounted in the foreground. */
export function listenForForegroundRefresh(refresh: () => void) {
  const refreshVisible = () => {
    if (document.visibilityState === 'visible') refresh()
  }
  const events = ['focus', 'pageshow', 'online', 'offline'] as const
  events.forEach(event => window.addEventListener(event, refreshVisible))
  document.addEventListener('visibilitychange', refreshVisible)
  const timer = window.setInterval(refreshVisible, 30_000)
  return () => {
    events.forEach(event => window.removeEventListener(event, refreshVisible))
    document.removeEventListener('visibilitychange', refreshVisible)
    window.clearInterval(timer)
  }
}
