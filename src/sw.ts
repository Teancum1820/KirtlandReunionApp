/// <reference lib="webworker" />

import { initializeApp } from 'firebase/app'
import { getMessaging } from 'firebase/messaging/sw'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{
    revision: string | null
    url: string
  }>
}

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

registerRoute(
  ({ url }) => url.hostname.endsWith('tile.openstreetmap.org'),
  new CacheFirst({
    cacheName: 'kirtland-map-tiles',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 180,
        maxAgeSeconds: 60 * 60 * 24 * 14,
      }),
    ],
  }),
)

registerRoute(
  ({ url }) =>
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com',
  new StaleWhileRevalidate({
    cacheName: 'kirtland-fonts',
  }),
)

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

if (
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.messagingSenderId &&
  firebaseConfig.appId
) {
  getMessaging(initializeApp(firebaseConfig))
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target =
    (event.notification.data?.url as string | undefined) ??
    `${self.registration.scope}`
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const matchingClient = clients.find(
          (client) => 'focus' in client && client.url.startsWith(target),
        )
        if (matchingClient && 'focus' in matchingClient) {
          return matchingClient.focus()
        }
        return self.clients.openWindow(target)
      }),
  )
})
