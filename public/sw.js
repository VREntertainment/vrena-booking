self.addEventListener('push', function (event) {
  let data = {}

  if (event.data) {
    try {
      data = event.data.json()
    } catch {
      data = { body: event.data.text() }
    }
  }

  const title = data.title || 'VRena'
  const options = {
    body: data.body || '',
    icon: data.icon || '/vrena-icon.png',
    badge: data.badge || '/vrena-icon.png',
    tag: data.tag || 'vrena-push',
    renotify: Boolean(data.renotify),
    data: {
      url: data.url || '/',
      dateOfArrival: Date.now(),
    },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()

  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href

  event.waitUntil((async function () {
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true })

    for (const client of clientList) {
      if ('navigate' in client) {
        await client.navigate(targetUrl)
      }
      if ('focus' in client) return client.focus()
    }

    if (clients.openWindow) return clients.openWindow(targetUrl)
  })())
})
