/* Adresa Secretă - loading screen, intro sequence and scroll reveals.
   Order of operations:
     1. mark the reveal targets while the loader still covers the page;
     2. wait for the DOM, the fonts and the above-the-fold imagery;
     3. hold the CONFIDENȚIAL screen 2 extra seconds so it can be read;
     4. lift the loader, play the hero intro, then reveal on scroll. */
(() => {
  'use strict';

  const doc = document;
  const root = doc.documentElement;
  const HOLD_AFTER_READY = 2000; // requested dwell on the loading screen
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  /* Ce se preîncarcă nu mai e o listă de nume fixe (se rupea la fiecare
     redenumire de fișier), ci se citește din ce folosește chiar pagina. */
  const grain = 'assets/grain.svg';

  const layerImages = () =>
    [...doc.querySelectorAll('[data-live-bg]')]
      .map((section) => section.querySelector('.sec-bg, .hero-image'))
      .filter(Boolean)
      .map((el) =>
        el.tagName === 'IMG'
          ? (el.currentSrc || el.getAttribute('src'))
          : getComputedStyle(el).backgroundImage.match(/url\("?([^")]+)"?\)/)?.[1]
      )
      .filter(Boolean);

  const loader = doc.getElementById('loader');
  const fill = doc.getElementById('loader-fill');
  const pct = doc.getElementById('loader-pct');
  const msg = doc.getElementById('loader-msg');
  const stamp = doc.querySelector('.loader-stamp');

  /* [procentul de la care apare, mesajul] */
  const STEPS = [
    [0, 'SE VERIFICĂ AUTORIZAȚIA'],
    [35, 'SE DESCHIDE DOSARUL 0216'],
    [65, 'SE ÎNCARCĂ MATERIALELE'],
    [99, 'ACCES APROBAT'],
  ];
  const stepsDesc = [...STEPS].reverse();

  /* ------------------------------------------------------------ progress */

  let shown = 0; // what the bar displays
  let assetRatio = 0; // real asset progress
  let ready = false;
  let finished = false;
  const started = Date.now();

  const paint = () => {
    // The bar never stalls: it also creeps forward with time, but it can only
    // reach 100% once everything has actually reported in.
    const timed = Math.min((Date.now() - started) / 2600, 1) * 0.9;
    const target = ready ? 1 : Math.min(Math.max(assetRatio, timed), 0.96);
    shown += (target - shown) * 0.24;
    if (target - shown < 0.004) shown = target;

    const value = Math.round(shown * 100);
    if (fill) fill.style.width = `${value}%`;
    if (pct) pct.textContent = `${value}%`;
    if (msg) {
      const step = stepsDesc.find(([at]) => value >= at);
      if (step && msg.textContent !== step[1]) msg.textContent = step[1];
    }
    if (!(ready && shown === 1)) requestAnimationFrame(paint);
  };

  /* --------------------------------------------------------------- waits */

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const preload = (url) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = img.onerror = resolve;
      img.src = url;
    });

  const trackedAssets = () => {
    // Every eagerly requested <img> in the document, plus the critical
    // CSS backgrounds. Below-the-fold photographs stay lazy on purpose.
    const imgs = [...doc.images].filter((img) => img.loading !== 'lazy');
    const jobs = [
      ...imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
            })
      ),
      ...[grain, ...layerImages().slice(0, 1)].map(preload),
    ];

    let done = 0;
    const total = jobs.length || 1;
    for (const job of jobs) {
      job.then(() => {
        assetRatio = ++done / total;
      });
    }
    return Promise.all(jobs);
  };

  const domReady = () =>
    doc.readyState !== 'loading'
      ? Promise.resolve()
      : new Promise((resolve) =>
          doc.addEventListener('DOMContentLoaded', resolve, { once: true })
        );

  const fontsReady = () => doc.fonts?.ready ?? Promise.resolve();

  /* -------------------------------------------------------------- reveal */

  /* { selector, animația, decalajul între elementele grupului }
     Decalajul se numără în interiorul secțiunii, nu pe toată pagina: al
     treilea titlu de secțiune intră la fel de repede ca primul. */
  const STEP = 120; // pasul comun între elementele unui grup (pașii 01-02-03)
  /* at = de la ce milisecundă începe grupul, step = pasul dintre elementele
     lui. Ambele se numără de la intrarea secțiunii în ecran. */
  const GROUPS = [
    { sel: '.hero-copy > *', kind: 'hero', step: 110 },
    { sel: '.hero-rail > *', kind: 'fade', step: 90 },
    { sel: '.hero-art-notes > small', kind: 'fade' },
    { sel: '.hero-art-notes .handwritten', kind: 'up', at: 120 },
    { sel: '.index-rail', kind: 'left' },
    { sel: '.section-head .eyebrow', kind: 'up' },
    { sel: '.section-head h2', kind: 'up', at: 90 },
    { sel: '.section-head > p:not(.eyebrow)', kind: 'up', at: 160 },
    { sel: '.section-head .access-rule', kind: 'rule', at: 220 },
    { sel: '.access-scene', kind: 'photo' },
    { sel: '.section-note > span', kind: 'fade', at: 120, step: STEP },
    { sel: '.access-note', kind: 'fade', at: 140, step: 140 },
    { sel: '.access-document', kind: 'card' },
    { sel: '.access-stamp', kind: 'stamp', at: 420 },
    { sel: '.apply-content > *', kind: 'up', step: 90 },
    { sel: '.site-footer > div,.site-footer > small', kind: 'up', step: 90 },
    // pașii 01-02-03: același decalaj în toate secțiunile
    { sel: '.items .item', kind: 'up', step: STEP },
    { sel: '.s1-story > *', kind: 'up', step: 140 },
  ];

  /* Secțiunea de care ține un element; decalajele se numără în interiorul ei. */
  const scopeOf = (node) => node.closest('.hero, .content-section, .access-wrap, .apply, .site-footer') ?? doc.body;

  const markTargets = () => {
    for (const { sel, kind, at = 0, step = 0 } of GROUPS) {
      const seen = new Map(); // câte elemente din grup are fiecare secțiune
      for (const node of doc.querySelectorAll(sel)) {
        if (node.hasAttribute('data-rev')) continue;
        const scope = scopeOf(node);
        const index = seen.get(scope) ?? 0;
        /* Ce nu se randează deloc (display:none dintr-un media query, ex.
           pasul 02 pe telefon) nu ocupă un rând în cascadă; ce e doar
           visibility:hidden își păstrează locul, deci și ritmul. */
        if (node.getClientRects().length) seen.set(scope, index + 1);

        node.setAttribute('data-rev', kind);
        const delay = at + index * step;
        if (delay) node.style.setProperty('--rd', `${delay}ms`);
      }
    }
  };

  /* Once an element has arrived, every trace of the motion layer is removed
     from it, so the page at rest is exactly the original markup and the
     browser can go back to subpixel text rendering. */
  const settle = (node) =>
    setTimeout(() => {
      node.classList.remove('is-in');
      node.removeAttribute('data-rev');
      node.style.removeProperty('--rd');
    }, 2400);

  const reveal = (node) => {
    node.classList.add('is-in');
    settle(node);
  };

  /* Declanșarea se face cu IntersectionObserver: browserul anunță singur ce a
     intrat în ecran, deci nu se măsoară nimic la fiecare scroll.
     Pornirea e cu 7% înainte de marginea de jos, ca la varianta cu măsurători.
     Nimic nu poate rămâne invizibil: ce a fost sărit (un salt la o ancoră) se
     vede ca ieșit pe sus și intră imediat, iar ce e ascuns de un media query
     (lățime și înălțime zero) e scos din așteptare pe loc. */
  const startReveals = () => {
    const targets = [...doc.querySelectorAll('[data-rev]')];
    if (!('IntersectionObserver' in window)) {
      targets.forEach(reveal);
      return;
    }

    const pending = new Set(targets);

    const take = (node) => {
      pending.delete(node);
      io.unobserve(node);
      reveal(node);
      if (!pending.size) window.removeEventListener('scroll', atEnd);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const { target, isIntersecting, boundingClientRect: r } of entries) {
          const skipped = r.top < 0; // a rămas deasupra ecranului
          const hidden = !r.width && !r.height;
          if (!isIntersecting && !skipped && !hidden) continue;
          take(target);
        }
      },
      { rootMargin: '0px 0px -7% 0px' }
    );

    /* Ultimii 7% de pagină nu mai pot trece linia de pornire — footer-ul ar
       rămâne invizibil. La capătul paginii intră tot ce a mai rămas. */
    const atEnd = () => {
      if (window.innerHeight + window.scrollY < (root.scrollHeight || 0) - 2) return;
      for (const node of [...pending]) take(node);
    };

    for (const node of targets) io.observe(node);
    window.addEventListener('scroll', atEnd, { passive: true });
    atEnd();
  };

  /* ------------------------------------------------------ hero on scroll */

  const startHeroDrift = () => {
    if (reduced) return;
    const copy = doc.querySelector('.hero-copy');
    const notes = doc.querySelector('.hero-art-notes');
    const hero = doc.querySelector('.hero');
    if (!copy || !hero) return;
    let queued = false;

    const clear = () => {
      hero.classList.remove('is-drift');
      copy.style.removeProperty('--py');
      copy.style.removeProperty('opacity');
      notes?.style.removeProperty('--py');
      notes?.style.removeProperty('opacity');
    };

    const frame = () => {
      queued = false;
      const y = window.scrollY;
      // No drift on phones: there the copy sits below the photograph as the
      // section's main content, so fading it out while it is being read
      // would be wrong. At the very top the drift is off as well, so the
      // first screen renders exactly as designed, with no promoted layers.
      if (y <= 0 || window.innerWidth <= 1000) {
        clear();
        return;
      }
      hero.classList.add('is-drift');
      const span = Math.max(hero.offsetHeight * 0.8, 320);
      const p = Math.min(y / span, 1);
      copy.style.setProperty('--py', `${(-y * 0.14).toFixed(1)}px`);
      copy.style.opacity = (1 - p * 0.9).toFixed(3);
      if (notes) {
        notes.style.setProperty('--py', `${(-y * 0.06).toFixed(1)}px`);
        notes.style.opacity = (1 - Math.min(p * 1.25, 1)).toFixed(3);
      }
    };

    window.addEventListener(
      'scroll',
      () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(frame);
      },
      { passive: true }
    );
    frame();
  };

  /* ------------------------------------------------- parallax pe secțiuni */

  /* Mișcarea urmează scroll-ul, dar fără să coste cât un scroll listener
     obișnuit: pozițiile se măsoară o dată (și la resize), observer-ul spune
     care secțiuni sunt pe ecran, iar în frame se fac numai scrieri — nicio
     citire de geometrie, deci niciun layout forțat. */
  const startParallax = () => {
    if (reduced) return;
    const sections = [...doc.querySelectorAll('[data-live-bg]')].map((el) => ({
      el,
      top: 0,
      height: 0,
    }));
    if (!sections.length) return;

    const measure = () => {
      const y = window.scrollY;
      for (const s of sections) {
        const r = s.el.getBoundingClientRect();
        s.top = r.top + y;
        s.height = r.height;
      }
    };

    const live = new Set();
    let queued = false;

    const frame = () => {
      queued = false;
      const y = window.scrollY;
      const view = window.innerHeight;
      const mid = y + view / 2;
      for (const s of live) {
        // 1 = secțiunea vine de jos, 0 = e în dreptul ochiului, -1 = a ieșit sus
        const span = (view + s.height) / 2;
        const p = Math.max(-1, Math.min(1, (s.top + s.height / 2 - mid) / span));
        s.el.style.setProperty('--p', p.toFixed(4));
      }
    };

    const request = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(frame);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const s = sections.find((x) => x.el === entry.target);
          if (!s) continue;
          // zoomul de intrare (scale în CSS) se reia la fiecare intrare
          s.el.classList.toggle('in-view', entry.isIntersecting);
          if (entry.isIntersecting) live.add(s);
          else {
            live.delete(s);
            s.el.style.setProperty('--p', entry.boundingClientRect.top > 0 ? '1' : '-1');
          }
        }
        request();
      },
      { rootMargin: '12% 0px' }
    );

    measure();
    for (const s of sections) io.observe(s.el);
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener(
      'resize',
      () => {
        measure();
        request();
      },
      { passive: true }
    );
    // pozițiile se schimbă când imaginile lazy își iau locul
    window.addEventListener('load', () => {
      measure();
      request();
    });
    request();
  };

  /* ---------------------------------------------------------------- boot */

  const finish = () => {
    if (finished) return;
    finished = true;
    ready = true;
    root.classList.remove('is-loading');
    root.classList.add('is-loaded');

    if (loader) {
      loader.classList.add('is-done');
      loader.setAttribute('aria-hidden', 'true');
      setTimeout(() => {
        loader.hidden = true;
      }, 1000);
    }

    startReveals();
    startHeroDrift();
    startParallax();

    // Warm the remaining artwork once the page is interactive.
    const warm = () => layerImages().slice(1).forEach(preload);
    if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 4000 });
    else setTimeout(warm, 2500);
  };

  markTargets();
  requestAnimationFrame(paint);

  (async () => {
    await Promise.all([domReady().then(trackedAssets), fontsReady()]);
    ready = true;
    await wait(420); // let the bar run up to 100%

    shown = 1;
    if (fill) fill.style.width = '100%';
    if (pct) pct.textContent = '100%';
    if (msg) msg.textContent = 'ACCES APROBAT';
    stamp?.classList.add('is-in');

    await wait(HOLD_AFTER_READY); // the requested 2s dwell
    finish();
  })();
})();
