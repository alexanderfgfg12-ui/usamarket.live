(function () {
  'use strict';

  const isArabic = document.documentElement.lang === 'ar';
  const toolbar = document.querySelector('.video-toolbar');
  const cards = [...document.querySelectorAll('.video-card')];
  const dialog = document.querySelector('[data-video-dialog]');
  const player = dialog?.querySelector('[data-video-player]');
  const caption = dialog?.querySelector('[data-video-caption]');
  const closeButton = dialog?.querySelector('[data-video-close]');

  let activeAdsManager = null;
  let adAttemptTimer = null;
  let playbackToken = 0;
  let imaLoaderPromise = null;

  const hilltopAdTags = [
    'https://expensive-pollution.com/dcm/F.zGdhGaNAvjZIGiUn/Xe/m/9Ou/ZYUYlNksPoTac/1-OcT/Mx1WMmjyEYteNTz/UV5VMPzCUzy/NlSrZIsLa/Wt1Ap/d/DI0rxG',
    'https://expensive-pollution.com/dNmgFazLd.GdNnvTZKGKUH/Teemt9Cu/Z_U_l/kWPATScW1/O/TnM/1LM/jEEPtnNKzsUy5IM/zAUkyZNSQY'
  ];

  function loadImaSdk() {
    if (window.google?.ima) return Promise.resolve();
    if (imaLoaderPromise) return imaLoaderPromise;
    imaLoaderPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://imasdk.googleapis.com/js/sdkloader/ima3.js';
      script.async = true;
      script.onload = () => window.google?.ima ? resolve() : reject(new Error('IMA SDK unavailable'));
      script.onerror = () => reject(new Error('IMA SDK failed to load'));
      document.head.appendChild(script);
    });
    return imaLoaderPromise;
  }

  function showContentVideo(trigger, token) {
    if (token !== playbackToken || !player || !dialog) return;
    if (adAttemptTimer) clearTimeout(adAttemptTimer);
    adAttemptTimer = null;
    if (activeAdsManager) {
      try { activeAdsManager.destroy(); } catch (_) {}
      activeAdsManager = null;
    }

    const id = (trigger.dataset.videoId || '').trim();
    if (!id) return;
    const title = trigger.dataset.videoTitle || trigger.getAttribute('aria-label') || 'US Market Live video';
    const frame = document.createElement('iframe');
    const params = new URLSearchParams({ autoplay: '1', rel: '0', playsinline: '1' });
    if (isArabic) {
      params.set('cc_load_policy', '1');
      params.set('cc_lang_pref', 'ar');
    }
    frame.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?' + params.toString();
    frame.title = title;
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.allowFullscreen = true;
    player.replaceChildren(frame);
    if (caption) caption.textContent = title;
  }

  function startPreroll(trigger) {
    const token = ++playbackToken;
    const id = (trigger.dataset.videoId || '').trim();
    if (!id || !player || !dialog) return;

    const title = trigger.dataset.videoTitle || trigger.getAttribute('aria-label') || 'US Market Live video';
    if (caption) caption.textContent = isArabic ? 'جارٍ تحميل الإعلان...' : 'Loading advertisement...';

    const stage = document.createElement('div');
    stage.className = 'ima-ad-stage';
    const contentVideo = document.createElement('video');
    contentVideo.className = 'ima-content-video';
    contentVideo.setAttribute('playsinline', '');
    contentVideo.preload = 'none';
    contentVideo.setAttribute('aria-label', title);
    const adContainer = document.createElement('div');
    adContainer.className = 'ima-ad-container';
    stage.append(contentVideo, adContainer);
    player.replaceChildren(stage);

    function tryTag(tagIndex) {
      if (token !== playbackToken) return;
      if (tagIndex >= hilltopAdTags.length) {
        showContentVideo(trigger, token);
        return;
      }
      loadImaSdk().then(() => {
        if (token !== playbackToken) return;
        const ima = window.google.ima;
        const displayContainer = new ima.AdDisplayContainer(adContainer, contentVideo);
        // IMA requires this call to occur directly from the user's play gesture.
        try { displayContainer.initialize(); } catch (_) {}
        const adsLoader = new ima.AdsLoader(displayContainer);
        let settled = false;
        const fallback = () => {
          if (settled || token !== playbackToken) return;
          settled = true;
          if (adAttemptTimer) clearTimeout(adAttemptTimer);
          adAttemptTimer = null;
          try { adsLoader.destroy(); } catch (_) {}
          tryTag(tagIndex + 1);
        };
        adAttemptTimer = setTimeout(fallback, 9000);

        adsLoader.addEventListener(ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, (event) => {
          if (settled || token !== playbackToken) {
            try { event.getAdsManager(contentVideo).destroy(); } catch (_) {}
            return;
          }
          try {
            activeAdsManager = event.getAdsManager(contentVideo);
            activeAdsManager.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, fallback);
            activeAdsManager.addEventListener(ima.AdEvent.Type.CONTENT_RESUME_REQUESTED, () => {
              if (settled || token !== playbackToken) return;
              settled = true;
              showContentVideo(trigger, token);
            });
            activeAdsManager.addEventListener(ima.AdEvent.Type.ALL_ADS_COMPLETED, () => {
              if (!settled && token === playbackToken) {
                settled = true;
                showContentVideo(trigger, token);
              }
            });
            activeAdsManager.init(640, 360, ima.ViewMode.NORMAL);
            activeAdsManager.start();
          } catch (_) { fallback(); }
        });
        adsLoader.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, fallback);
        const request = new ima.AdsRequest();
        request.adTagUrl = tag;
        request.linearAdSlotWidth = Math.max(320, player.clientWidth || 640);
        request.linearAdSlotHeight = Math.max(180, Math.round(request.linearAdSlotWidth * 9 / 16));
        request.nonLinearAdSlotWidth = request.linearAdSlotWidth;
        request.nonLinearAdSlotHeight = Math.round(request.linearAdSlotHeight / 3);
        try { adsLoader.requestAds(request); } catch (_) { fallback(); }
      }).catch(() => {
        if (tagIndex + 1 < hilltopAdTags.length) tryTag(tagIndex + 1);
        else showContentVideo(trigger, token);
      });
    }

    tryTag(0);
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function stopPlayback() {
    playbackToken++;
    if (adAttemptTimer) clearTimeout(adAttemptTimer);
    adAttemptTimer = null;
    if (activeAdsManager) {
      try { activeAdsManager.destroy(); } catch (_) {}
      activeAdsManager = null;
    }
    if (player) player.replaceChildren();
    if (caption) caption.textContent = '';
    if (dialog?.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }

  document.addEventListener('click', function (event) {
    const trigger = event.target.closest && event.target.closest('[data-video-id]');
    if (!trigger) return;
    event.preventDefault();
    startPreroll(trigger);
  });

  closeButton?.addEventListener('click', stopPlayback);
  dialog?.addEventListener('click', function (event) {
    if (event.target === dialog) stopPlayback();
  });
  dialog?.addEventListener('close', function () {
    if (player) player.replaceChildren();
  });

  const input = toolbar?.querySelector('[data-video-search]');
  const buttons = [...(toolbar?.querySelectorAll('[data-video-filter]') || [])];
  let category = 'all';

  cards.forEach(function (card) {
    const text = card.innerText.toLowerCase();
    card.dataset.category = /stock|invest|share|أسهم|استثمار/.test(text)
      ? 'investing'
      : /monetary|fed|policy|نقدية|فيدرالي/.test(text)
        ? 'economy'
        : 'all';
  });

  function applyFilters() {
    const query = (input?.value || '').trim().toLowerCase();
    let shown = 0;
    cards.forEach(function (card) {
      const visible = (!query || card.innerText.toLowerCase().includes(query)) &&
        (category === 'all' || card.dataset.category === category);
      card.hidden = !visible;
      if (visible) shown++;
    });
    let empty = document.querySelector('.video-empty');
    if (!shown && !empty) {
      empty = document.createElement('div');
      empty.className = 'video-empty';
      empty.textContent = isArabic ? 'لا توجد فيديوهات تطابق البحث.' : 'No videos match your search.';
      document.querySelector('.video-grid')?.append(empty);
    } else if (shown && empty) {
      empty.remove();
    }
  }

  input?.addEventListener('input', applyFilters);
  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      category = button.dataset.videoFilter;
      buttons.forEach(item => item.classList.toggle('active', item === button));
      applyFilters();
    });
  });
  applyFilters();
})();