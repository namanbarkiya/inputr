/**
 * Inputr landing. Minimal interactivity:
 *   - Fade-up reveal on scroll via IntersectionObserver
 *   - Sticky-nav border once user scrolls past the hero
 *   - Hero panel tab cycle (Upload / Create / Draw)
 */

(() => {
  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;

  // Reveal on scroll
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.1, rootMargin: '0px 0px -32px 0px' },
  );
  document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));

  // Sticky nav border
  const nav = document.querySelector('.nav');
  if (nav) {
    const onScroll = () => {
      nav.classList.toggle('is-stuck', window.scrollY > 24);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Hero panel: clickable tabs + auto-cycle while in view
  const tabs = document.querySelectorAll('.panel-tab');
  const stages = document.querySelectorAll('.panel-canvas');

  const setStage = (id) => {
    tabs.forEach((t) =>
      t.classList.toggle('is-on', t.dataset.tab === id),
    );
    stages.forEach((s) =>
      s.classList.toggle('is-on', s.dataset.stage === id),
    );
  };

  if (tabs.length) {
    setStage('upload');
    tabs.forEach((t) => {
      t.addEventListener('click', () => setStage(t.dataset.tab));
    });

    if (!reduceMotion) {
      const order = ['upload', 'create', 'draw'];
      let idx = 0;
      let timer = null;
      const product = document.querySelector('.showcase');
      if (product) {
        const cycleObs = new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (e.isIntersecting && !timer) {
                timer = setInterval(() => {
                  idx = (idx + 1) % order.length;
                  setStage(order[idx]);
                }, 3200);
              } else if (!e.isIntersecting && timer) {
                clearInterval(timer);
                timer = null;
              }
            }
          },
          { threshold: 0.3 },
        );
        cycleObs.observe(product);
      }
    }
  }

  // Anchor focus for keyboard users
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', () => {
      const href = a.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    });
  });
})();
