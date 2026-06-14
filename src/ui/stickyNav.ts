export function initStickyNav(): void {
  const sentinel = document.getElementById('sticky-nav-sentinel');
  const nav = document.getElementById('app-sticky-nav');

  if (!sentinel || !nav) {
    return;
  }

  const observer = new IntersectionObserver(
    ([entry]) => {
      nav.classList.toggle('is-stuck', !entry.isIntersecting);
    },
    { threshold: 0 },
  );

  observer.observe(sentinel);
}
