export const config = {
  backendUrl:
    import.meta.env.VITE_BACKEND_URL ??
    'https://script.google.com/macros/s/AKfycbxmGd0_jjD1znuizGRf-rbAqyAOTDobxbzURac4e-962J3WOyROaATc4qWYe7onsLfG6Q/exec',
  vapidPublicKey:
    import.meta.env.VITE_VAPID_PUBLIC_KEY ??
    'BIMRXGq1T4ofojR84NQKSnrZ_smcyID7njPtt0HQH-vc7YiuJrfV3Aa_3jA4DA6uXQZFWN1fjFD-ae3YxpiMcUI',
  festivalTimeZoneOffset: '+02:00',
  preDawnCutoffMinutes: 5 * 60,
  /** Fallback only: ISO date per exact day tab string when the label has no D.M.YYYY to parse. */
  dayToDate: {} as Record<string, string>,
};
