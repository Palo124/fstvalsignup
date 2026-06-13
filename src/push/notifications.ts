import { config } from '../config';
import { defaultNotificationPreferences, type NotificationPreferences } from '../domain/notifications';
import { loadJson, saveJson, storageKeys } from '../state/storage';

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

export function loadNotificationPreferences(): NotificationPreferences {
  return loadJson(storageKeys.notificationPrefs, defaultNotificationPreferences);
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.register('./sw.js', { scope: './' });
}

export async function enablePushNotifications(nickname: string): Promise<void> {
  if (!config.vapidPublicKey) {
    throw new Error('Push notifications are not configured yet.');
  }

  if (!nickname.trim()) {
    throw new Error('Enter your nickname before enabling notifications.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  const registration = await registerServiceWorker();
  if (!registration) {
    throw new Error('Service workers are not supported in this browser.');
  }

  try {
    await navigator.serviceWorker.ready;
  } catch {
    throw new Error('Service worker failed to load. Use the production build (npm run build) over HTTPS.');
  }

  let subscription: PushSubscription;
  try {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey) as BufferSource,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Push subscription failed';
    throw new Error(message);
  }

  const payload = toSubscriptionPayload(subscription);
  await cachePushMetadata(payload.endpoint);
  try {
    await savePushSubscription(nickname, payload, loadNotificationPreferences());
  } catch (error) {
    await subscription.unsubscribe();
    const message = error instanceof Error ? error.message : 'Could not save subscription to server';
    throw new Error(message);
  }
  saveJson(storageKeys.notificationsEnabled, true);
}

export async function disablePushNotifications(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await removePushSubscription(subscription.endpoint);
    await subscription.unsubscribe();
  }
  saveJson(storageKeys.notificationsEnabled, false);
}

async function cachePushMetadata(endpoint: string): Promise<void> {
  const cache = await caches.open('b4l-push');
  await cache.put('push-endpoint', new Response(endpoint));
  await cache.put('backend-url', new Response(config.backendUrl));
}

async function savePushSubscription(
  nickname: string,
  subscription: PushSubscriptionPayload,
  preferences: NotificationPreferences,
): Promise<void> {
  const url = new URL(config.backendUrl);
  url.searchParams.set('action', 'savePushSubscription');
  url.searchParams.set('nickname', nickname);
  url.searchParams.set('endpoint', subscription.endpoint);
  url.searchParams.set('p256dh', subscription.keys.p256dh);
  url.searchParams.set('auth', subscription.keys.auth);
  url.searchParams.set('preferences', JSON.stringify(preferences));
  url.searchParams.set('nocache', String(Date.now()));

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to save push subscription: ${response.status}`);
  }

  const result = (await response.json()) as { ok?: boolean; error?: string };
  if (result.error) {
    throw new Error(result.error);
  }
}

async function removePushSubscription(endpoint: string): Promise<void> {
  const url = new URL(config.backendUrl);
  url.searchParams.set('action', 'removePushSubscription');
  url.searchParams.set('endpoint', endpoint);
  url.searchParams.set('nocache', String(Date.now()));

  await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
}

function toSubscriptionPayload(subscription: PushSubscription): PushSubscriptionPayload {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Push subscription is missing keys.');
  }

  return {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
  };
}

export async function syncPushSubscription(nickname: string): Promise<void> {
  if (!loadJson(storageKeys.notificationsEnabled, false)) return;
  if (!nickname.trim()) return;

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  const payload = toSubscriptionPayload(subscription);
  await cachePushMetadata(payload.endpoint);
  await savePushSubscription(nickname, payload, loadNotificationPreferences());
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
