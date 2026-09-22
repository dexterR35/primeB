/* Cookie consent — gates Google Tag Manager behind an explicit choice.
   GTM_ID is a dummy placeholder; replace it with the real container ID
   before launch. GTM is the only tracker: configure GA4/Meta/TikTok tags
   inside GTM itself instead of adding more scripts here, to avoid
   double-counting the same events. */
(() => {
  'use strict';

  const GTM_ID = 'GTM-XXXXXXX';
  const STORAGE_KEY = 'cookie-consent';
  let gtmLoaded = false;

  function readConsent() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  function writeConsent(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch (error) {
      // Private mode / blocked storage: the choice just won't persist across visits.
    }
  }

  function loadGTM() {
    if (gtmLoaded || !GTM_ID || GTM_ID === 'GTM-XXXXXXX') return;
    gtmLoaded = true;

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
    document.head.appendChild(script);
  }

  function initBanner() {
    const banner = document.getElementById('cookie-banner');
    if (!banner) return;

    const acceptButton = banner.querySelector('[data-cookie-accept]');
    const declineButton = banner.querySelector('[data-cookie-decline]');

    function show() {
      banner.hidden = false;
      requestAnimationFrame(() => banner.classList.add('is-open'));
    }

    function hide() {
      banner.classList.remove('is-open');
      window.setTimeout(() => {
        banner.hidden = true;
      }, 350);
    }

    acceptButton?.addEventListener('click', () => {
      writeConsent('accepted');
      hide();
      loadGTM();
    });

    declineButton?.addEventListener('click', () => {
      writeConsent('declined');
      hide();
    });

    const consent = readConsent();
    if (consent === 'accepted') {
      loadGTM();
    } else if (consent !== 'declined') {
      show();
    }
  }

  initBanner();
})();
