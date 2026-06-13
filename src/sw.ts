/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

const DEFAULT_BACKEND =
  'https://script.google.com/macros/s/AKfycbxmGd0_jjD1znuizGRf-rbAqyAOTDobxbzURac4e-962J3WOyROaATc4qWYe7onsLfG6Q/exec';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  event.waitUntil(handlePush(event));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(openApp());
});

async function handlePush(event: PushEvent): Promise<void> {
  const data = parsePushData(event);
  if (data) {
    await showNotifications([data]);
    const endpoint = await readStoredEndpoint();
    if (endpoint) await ackNotifications(endpoint, [data.id]);
    return;
  }

  const endpoint = await readStoredEndpoint();
  if (!endpoint) return;

  const pending = await fetchPendingNotifications(endpoint);
  if (!pending.length) return;

  await showNotifications(pending);
  await ackNotifications(endpoint, pending.map((item) => item.id));
}

function parsePushData(event: PushEvent): PendingNotification | null {
  if (!event.data) return null;

  try {
    const parsed = event.data.json() as Partial<PendingNotification>;
    if (!parsed.title || !parsed.body) return null;
    return {
      id: parsed.id ?? `inline:${Date.now()}`,
      title: parsed.title,
      body: parsed.body,
      tag: parsed.tag ?? parsed.id ?? 'b4l-notification',
    };
  } catch {
    return null;
  }
}

async function showNotifications(notifications: PendingNotification[]): Promise<void> {
  for (const notification of notifications) {
    await self.registration.showNotification(notification.title, {
      body: notification.body,
      tag: notification.tag,
      icon: './apple-touch-icon.png',
      badge: './favicon.png',
      data: { id: notification.id },
    });
  }
}

async function openApp(): Promise<void> {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const existing = clients.find((client) => 'focus' in client);
  if (existing && 'focus' in existing) {
    await existing.focus();
    return;
  }

  await self.clients.openWindow('./');
}

async function readStoredEndpoint(): Promise<string | null> {
  const cache = await caches.open('b4l-push');
  const response = await cache.match('push-endpoint');
  if (response) return response.text();

  const subscription = await self.registration.pushManager.getSubscription();
  return subscription?.endpoint ?? null;
}

async function fetchPendingNotifications(endpoint: string): Promise<PendingNotification[]> {
  const backendUrl = await readBackendUrl();
  const url = new URL(backendUrl);
  url.searchParams.set('action', 'pendingNotifications');
  url.searchParams.set('endpoint', endpoint);
  url.searchParams.set('nocache', String(Date.now()));

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) return [];

  const payload = (await response.json()) as { notifications?: PendingNotification[] };
  return payload.notifications ?? [];
}

async function ackNotifications(endpoint: string, ids: string[]): Promise<void> {
  const backendUrl = await readBackendUrl();
  const url = new URL(backendUrl);
  url.searchParams.set('action', 'ackNotifications');
  url.searchParams.set('endpoint', endpoint);
  url.searchParams.set('ids', ids.join(','));
  url.searchParams.set('nocache', String(Date.now()));

  await fetch(url, { headers: { Accept: 'application/json' } });
}

async function readBackendUrl(): Promise<string> {
  const cache = await caches.open('b4l-push');
  const response = await cache.match('backend-url');
  if (!response) return DEFAULT_BACKEND;
  return response.text();
}

interface PendingNotification {
  id: string;
  title: string;
  body: string;
  tag: string;
}

export {};
