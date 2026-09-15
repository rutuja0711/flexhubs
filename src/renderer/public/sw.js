self.addEventListener('push', (event) => {
  let payload = {
    title: 'Flexhubs',
    body: 'You have a new notification.',
    url: '/',
    eventId: null,
    view: null,
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = {
        ...payload,
        ...parsed,
        ...(parsed.data && typeof parsed.data === 'object' ? parsed.data : {}),
      };
    }
  } catch {
    if (event.data) {
      payload.body = event.data.text();
    }
  }

  const isCalendar =
    payload.view === 'calendar' ||
    Boolean(payload.eventId) ||
    String(payload.type || '')
      .toLowerCase()
      .includes('calendar') ||
    String(payload.type || '')
      .toLowerCase()
      .includes('event');

  const targetUrl =
    payload.url ||
    (isCalendar
      ? `/?view=calendar${payload.eventId ? `&eventId=${encodeURIComponent(payload.eventId)}` : ''}`
      : '/');

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Flexhubs', {
      body: payload.body || '',
      icon: '/logo-symbol.png',
      data: { ...payload, url: targetUrl },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl = data.url || '/';

  event.waitUntil(clients.openWindow(targetUrl));
});
