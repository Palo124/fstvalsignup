export const config = {
  backendUrl:
    import.meta.env.VITE_BACKEND_URL ??
    'https://script.google.com/macros/s/AKfycby8Ikg95Fn4AKbKzHOdEBaNPNrISll8Z_PfrZs7hR5alJbMVkHybvguZY6d_tmSthA9bg/exec',
  festivalTimeZoneOffset: '+02:00',
  preDawnCutoffMinutes: 5 * 60,
  /** Fallback only: ISO date per exact day tab string when the label has no D.M.YYYY to parse. */
  dayToDate: {} as Record<string, string>,
};
