self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Limpa qualquer cache deixado por um service worker anterior (por exemplo
  // o do vite-plugin-pwa, que fazia cache-first do app e era a causa mais
  // provável do bug de conteúdo desatualizado no mobile). Como este service
  // worker não usa cache nenhum, não há risco de apagar algo que ele próprio
  // precise.
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("push", (event) => {
  let payload = { title: "Servix", body: "Você tem um lembrete." };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: payload.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
