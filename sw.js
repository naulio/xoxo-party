/* Service Worker XOXO PARTY — notifications push des commandes.
   Les adresses sont relatives au scope (le site peut vivre dans un
   sous-dossier, ex. https://<user>.github.io/xoxo-party/). */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

const abs = u => new URL(u || './', self.registration.scope).href

self.addEventListener('push', e => {
  let data = {}
  try { data = e.data.json() } catch { data = { title: 'XOXO PARTY', body: e.data && e.data.text() } }
  e.waitUntil(
    self.registration.showNotification(data.title || '🍸 XOXO PARTY', {
      body: data.body || '',
      icon: abs('icon-192.png'),
      badge: abs('icon-192.png'),
      tag: data.tag || 'xoxo',
      renotify: true,
      vibrate: [120, 60, 120],
      data: { url: abs(data.url) },
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || abs('./')
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url === url && 'focus' in client) return client.focus()
      }
      for (const client of list) {
        if ('navigate' in client && 'focus' in client) {
          return client.navigate(url).then(c => (c || client).focus())
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
