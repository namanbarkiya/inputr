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

  // Try-here: surface the picked file and support drag/drop.
  // The <input type="file"> is real so the Inputr extension's content
  // script can detect it and parse the helper label next to it.
  const tryDrop = document.querySelector('.try-drop');
  const tryInput = document.querySelector('.try-input');
  const tryStatus = document.querySelector('[data-try-status]');
  const tryStatusText = tryStatus
    ? tryStatus.querySelector('.try-status-text')
    : null;
  const tryPreview = document.querySelector('[data-try-preview]');
  const tryPreviewRatio = document.querySelector('[data-try-preview-ratio]');
  const tryHeadline = document.querySelector('[data-try-headline]');
  const tryCta = document.querySelector('[data-try-cta]');
  const tryClear = document.querySelector('[data-try-clear]');

  const HEADLINE_DEFAULT = tryHeadline ? tryHeadline.textContent : '';
  const CTA_DEFAULT = tryCta ? tryCta.textContent : '';
  let lastObjectUrl = null;

  const formatBytes = (n) => {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  };

  const releasePreview = () => {
    if (lastObjectUrl) {
      URL.revokeObjectURL(lastObjectUrl);
      lastObjectUrl = null;
    }
  };

  const resetUI = () => {
    if (tryStatus) tryStatus.classList.remove('is-ok');
    if (tryStatusText) tryStatusText.textContent = 'No file picked yet.';
    if (tryDrop) tryDrop.classList.remove('is-loaded');
    if (tryHeadline) tryHeadline.textContent = HEADLINE_DEFAULT;
    if (tryCta) tryCta.textContent = CTA_DEFAULT;
    if (tryPreview) {
      tryPreview.removeAttribute('src');
      tryPreview.alt = '';
    }
    if (tryPreviewRatio) tryPreviewRatio.textContent = '';
    if (tryClear) tryClear.hidden = true;
    releasePreview();
  };

  const reportFile = (file) => {
    if (!tryStatus || !tryStatusText) return;
    if (!file) {
      resetUI();
      return;
    }

    tryStatus.classList.add('is-ok');
    if (tryDrop) tryDrop.classList.add('is-loaded');

    const name = file.name || 'image';
    tryStatusText.innerHTML =
      `<strong>${name}</strong> · ${formatBytes(file.size)} · ` +
      `${file.type || 'image'}`;

    if (tryHeadline) tryHeadline.textContent = 'Looks good. Got it.';
    if (tryCta) tryCta.textContent = 'Replace file';
    if (tryClear) tryClear.hidden = false;

    if (tryPreview && file.type && file.type.startsWith('image/')) {
      releasePreview();
      lastObjectUrl = URL.createObjectURL(file);
      tryPreview.src = lastObjectUrl;
      tryPreview.alt = name;
      tryPreview.onload = () => {
        if (tryPreviewRatio && tryPreview.naturalWidth) {
          tryPreviewRatio.textContent =
            `${tryPreview.naturalWidth} × ${tryPreview.naturalHeight}`;
        }
      };
    }
  };

  if (tryInput) {
    tryInput.addEventListener('change', () => {
      reportFile(tryInput.files && tryInput.files[0]);
    });
  }

  if (tryClear && tryInput) {
    tryClear.addEventListener('click', () => {
      tryInput.value = '';
      resetUI();
    });
  }

  if (tryDrop && tryInput) {
    ['dragenter', 'dragover'].forEach((evt) => {
      tryDrop.addEventListener(evt, (e) => {
        e.preventDefault();
        tryDrop.classList.add('is-drag');
      });
    });
    ['dragleave', 'dragend'].forEach((evt) => {
      tryDrop.addEventListener(evt, () => {
        tryDrop.classList.remove('is-drag');
      });
    });
    tryDrop.addEventListener('drop', (e) => {
      e.preventDefault();
      tryDrop.classList.remove('is-drag');
      const files = e.dataTransfer && e.dataTransfer.files;
      if (!files || !files.length) return;
      // Mirror the dropped file onto the real input so listeners and the
      // extension's detector both see it as if the user clicked.
      try {
        const dt = new DataTransfer();
        dt.items.add(files[0]);
        tryInput.files = dt.files;
      } catch {
        /* DataTransfer assignment may be blocked in older browsers */
      }
      reportFile(files[0]);
    });
  }
})();
