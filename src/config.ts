import { gasBackendUrl } from './gas-backend-url.generated';

export const config = {
  backendUrl: import.meta.env.VITE_BACKEND_URL ?? gasBackendUrl,
  vapidPublicKey:
    import.meta.env.VITE_VAPID_PUBLIC_KEY ??
    'BIMRXGq1T4ofojR84NQKSnrZ_smcyID7njPtt0HQH-vc7YiuJrfV3Aa_3jA4DA6uXQZFWN1fjFD-ae3YxpiMcUI',
  festivalTimeZoneOffset: '+02:00',
  preDawnCutoffMinutes: 11 * 60,
  /** Fallback only: ISO date per exact day tab string when the label has no D.M.YYYY to parse. */
  dayToDate: {} as Record<string, string>,
};
