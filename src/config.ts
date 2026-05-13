export const config = {
  backendUrl:
    import.meta.env.VITE_BACKEND_URL ??
    'https://script.google.com/macros/s/AKfycby8Ikg95Fn4AKbKzHOdEBaNPNrISll8Z_PfrZs7hR5alJbMVkHybvguZY6d_tmSthA9bg/exec',
  festivalTimeZoneOffset: '+02:00',
  preDawnCutoffMinutes: 5 * 60,
  dayToDate: {
    'Streda 2.7.': '2025-07-02',
    'Štvrtok 3.7.': '2025-07-03',
    'Piatok 4.7.': '2025-07-04',
    'Sobota 5.7.': '2025-07-05',
  } as Record<string, string>,
};
