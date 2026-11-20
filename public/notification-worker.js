self.addEventListener('notificationclick', event => {
  event.notification.close()
  const path = event.notification.data?.destination
  if (typeof path !== 'string' || !/^\/(?:player|owner|organizer|admin)\//.test(path)) return
  event.waitUntil((async () => {
    const target = new URL(path, self.location.origin)
    if (target.origin !== self.location.origin) return
    for (const client of await self.clients.matchAll({ type: 'window' })) {
      if (client.url === target.href) return client.focus()
    }
    return self.clients.openWindow(target.href)
  })())
})
