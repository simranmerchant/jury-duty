self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "jury duty", {
      body: data.body ?? "",
      icon: "/icon.png",
      badge: "/icon.png",
      data: data.data ?? {},
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const eventId = event.notification.data?.event_id;
  const betId = event.notification.data?.bet_id;
  const base = eventId ? `/e/${eventId}` : "/";
  const url = base + (betId ? `?bet=${betId}&from=push` : "?from=push");
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
