/**
 * DayOtter service worker - handles Web Push notifications for the desktop/browser
 * "webpush" reminder channel. Registered by web-push-toggle.tsx after the user
 * opts in. The payload is the JSON sent by @dayotter/notifications' web-push
 * provider: { title, body, url }.
 */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "DayOtter";
  const options = {
    body: data.body || "",
    icon: "/brand/notification-icon.png",
    badge: "/brand/notification-icon.png",
    tag: "dayotter-reminder",
    data: { url: data.url || "/dashboard" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus an existing tab already on the target, else open a new one.
      for (const client of clientList) {
        if (client.url.includes(target) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    }),
  );
});
