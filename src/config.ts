export const config = {
  backendUrl:
    import.meta.env.VITE_BACKEND_URL ??
    'https://script.google.com/macros/s/AKfycbxLQgx0g9t1Uzq2PNOjU4YfiPA7Ny9Kcwd2N8rTbis5ZovL2QPzvclyox7IDx16Xt_-3g/exec',
  vapidPublicKey:
    import.meta.env.VITE_VAPID_PUBLIC_KEY ??
    'BIMRXGq1T4ofojR84NQKSnrZ_smcyID7njPtt0HQH-vc7YiuJrfV3Aa_3jA4DA6uXQZFWN1fjFD-ae3YxpiMcUI',
  festivalTimeZoneOffset: '+02:00',
  preDawnCutoffMinutes: 5 * 60,
  /** Fallback only: ISO date per exact day tab string when the label has no D.M.YYYY to parse. */
  dayToDate: {} as Record<string, string>,
};
