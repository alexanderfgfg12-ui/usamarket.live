(function () {
  'use strict';

  const isArabic = document.documentElement.lang === 'ar';
  const toolbar = document.querySelector('.video-toolbar');
  let cards = [...document.querySelectorAll('.video-card')];
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

    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }

    // The SDK is loaded before this file. Initialize synchronously in the
    // user's click gesture so mobile browsers permit IMA ad playback.
    const ima = window.google?.ima;
    if (!ima) {
      showContentVideo(trigger, token);
      return;
    }

    let displayContainer;
    let adsLoader;
    try {
      displayContainer = new ima.AdDisplayContainer(adContainer, contentVideo);
      displayContainer.initialize();
      adsLoader = new ima.AdsLoader(displayContainer);
    } catch (_) {
      showContentVideo(trigger, token);
      return;
    }

    let tagIndex = 0;
    let attemptSettled = false;
    const requestNextTag = () => {
      if (token !== playbackToken) return;
      if (adAttemptTimer) clearTimeout(adAttemptTimer);
      if (tagIndex >= hilltopAdTags.length) {
        try { adsLoader.destroy(); } catch (_) {}
        showContentVideo(trigger, token);
        return;
      }
      attemptSettled = false;
      const currentTag = hilltopAdTags[tagIndex++];
      adAttemptTimer = setTimeout(() => settleAttempt(true), 9000);
      try {
        const request = new ima.AdsRequest();
        request.adTagUrl = currentTag;
        const slotWidth = Math.max(1, Math.round(stage.getBoundingClientRect().width || player.clientWidth || 640));
        const slotHeight = Math.max(1, Math.round(stage.getBoundingClientRect().height || slotWidth * 9 / 16));
        request.linearAdSlotWidth = slotWidth;
        request.linearAdSlotHeight = slotHeight;
        request.nonLinearAdSlotWidth = slotWidth;
        request.nonLinearAdSlotHeight = Math.max(1, Math.round(slotHeight / 3));
        adsLoader.requestAds(request);
      } catch (_) { settleAttempt(true); }
    };

    function settleAttempt(tryFallback) {
      if (attemptSettled || token !== playbackToken) return;
      attemptSettled = true;
      if (adAttemptTimer) clearTimeout(adAttemptTimer);
      adAttemptTimer = null;
      if (activeAdsManager) {
        try { activeAdsManager.destroy(); } catch (_) {}
        activeAdsManager = null;
      }
      if (tryFallback) requestNextTag();
      else showContentVideo(trigger, token);
    }

    adsLoader.addEventListener(ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, (event) => {
      if (adAttemptTimer) clearTimeout(adAttemptTimer);
      adAttemptTimer = null;
      if (attemptSettled || token !== playbackToken) {
        try { event.getAdsManager(contentVideo).destroy(); } catch (_) {}
        return;
      }
      try {
        activeAdsManager = event.getAdsManager(contentVideo);
        activeAdsManager.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, () => settleAttempt(true));
        activeAdsManager.addEventListener(ima.AdEvent.Type.CONTENT_RESUME_REQUESTED, () => settleAttempt(false));
        activeAdsManager.addEventListener(ima.AdEvent.Type.ALL_ADS_COMPLETED, () => settleAttempt(false));
        const rect = stage.getBoundingClientRect();
        activeAdsManager.init(Math.max(1, Math.round(rect.width)), Math.max(1, Math.round(rect.height)), ima.ViewMode.NORMAL);
        activeAdsManager.start();
      } catch (_) { settleAttempt(true); }
    });
    adsLoader.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, () => settleAttempt(true));
    requestNextTag();
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
  let buttons = [...(toolbar?.querySelectorAll('[data-video-filter]') || [])];
  let category = 'all';

  cards.forEach(function (card) {
    const text = card.innerText.toLowerCase();
    card.dataset.category = /stock|invest|share|أسهم|استثمار/.test(text)
      ? 'investing'
      : /monetary|fed|policy|نقدية|فيدرالي/.test(text)
        ? 'economy'
        : 'all';
  });


  // Dynamic YouTube library. The API key remains in the Worker secret.
  const firstGrid = document.querySelector('.video-grid');
  const dynamicGrid = document.createElement('div');
  dynamicGrid.className = 'video-grid video-dynamic-grid';
  dynamicGrid.setAttribute('aria-live', 'polite');
  if (firstGrid?.parentNode) firstGrid.parentNode.insertBefore(dynamicGrid, firstGrid.nextSibling);
  const loadMore = document.createElement('button');
  loadMore.type = 'button'; loadMore.className = 'video-filter video-load-more';
  loadMore.textContent = isArabic ? 'تحميل المزيد من الفيديوهات' : 'Load more videos';
  if (dynamicGrid.parentNode) dynamicGrid.parentNode.insertBefore(loadMore, dynamicGrid.nextSibling);
  const categoryLabels = isArabic
    ? { all:'الكل', economy:'الاقتصاد', investing:'الاستثمار', ai:'الذكاء الاصطناعي', crypto:'العملات الرقمية', business:'الأعمال', education:'العلوم والتعليم' }
    : { all:'All', economy:'Economy', investing:'Investing', ai:'AI & Tech', crypto:'Crypto', business:'Business', education:'Science & Education' };
  Object.entries(categoryLabels).forEach(([key,label]) => {
    if (buttons.some(b => b.dataset.videoFilter === key)) return;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'video-filter'; button.dataset.videoFilter = key;
    button.textContent = label; toolbar?.append(button); buttons.push(button);
  });
  let nextPageToken = '', requestBusy = false, exhausted = false, dynamicIds = new Set(), activeRequest = 0;
  function makeVideoCard(video) {
    const article = document.createElement('article'); article.className = 'video-card'; article.dataset.category = category;
    const play = document.createElement('button'); play.type = 'button'; play.className = 'video-frame video-play-card';
    play.dataset.videoId = video.id; play.dataset.videoTitle = video.title;
    play.setAttribute('aria-label', (isArabic ? 'تشغيل: ' : 'Play: ') + video.title);
    const img = document.createElement('img'); img.src = video.thumbnail || ('https://i.ytimg.com/vi/' + video.id + '/hqdefault.jpg'); img.alt = ''; img.loading = 'lazy';
    const overlay = document.createElement('span'); overlay.className = 'video-play-overlay'; overlay.textContent = '▶';
    const label = document.createElement('span'); label.className = 'video-play-label'; label.textContent = isArabic ? 'شاهد الآن' : 'Watch here';
    play.append(img, overlay, label);
    const body = document.createElement('div'); body.className = 'video-card-body';
    const source = document.createElement('span'); source.className = 'video-source'; source.textContent = video.channel;
    const title = document.createElement('h2'); title.textContent = video.title;
    const desc = document.createElement('p'); desc.textContent = video.description;
    const credit = document.createElement('span'); credit.className = 'video-source-credit';
    credit.textContent = isArabic ? 'المصدر وحقوق النشر: الناشر الأصلي · يُعرض الفيديو هنا' : 'Source & credit: Original publisher · embedded here';
    body.append(source, title, desc, credit); article.append(play, body); return article;
  }
  async function loadVideos(reset = false) {
    if (requestBusy || (exhausted && !reset)) return;
    if (reset) { activeRequest++; nextPageToken = ''; exhausted = false; dynamicIds.clear(); dynamicGrid.replaceChildren(); }
    const requestId = activeRequest; requestBusy = true; loadMore.disabled = true;
    loadMore.textContent = isArabic ? 'جارٍ تحميل الفيديوهات...' : 'Loading videos...';
    const params = new URLSearchParams({ lang: isArabic ? 'ar' : 'en', category, q: input?.value?.trim() || '' });
    if (nextPageToken) params.set('pageToken', nextPageToken);
    try {
      const response = await fetch('/api/videos?' + params, { headers: { accept: 'application/json' } });
      const data = await response.json();
      if (requestId !== activeRequest) return;
      if (!response.ok) throw new Error(data.message || data.error || 'Video service unavailable');
      (data.videos || []).forEach(video => {
        if (!video.id || dynamicIds.has(video.id)) return;
        dynamicIds.add(video.id); const card = makeVideoCard(video); dynamicGrid.append(card); cards.push(card);
      });
      nextPageToken = data.nextPageToken || ''; exhausted = !nextPageToken; applyFilters();
      loadMore.hidden = exhausted && !dynamicGrid.children.length;
      loadMore.textContent = exhausted ? (isArabic ? 'لا توجد نتائج إضافية حالياً' : 'No more results right now') : (isArabic ? 'تحميل المزيد من الفيديوهات' : 'Load more videos');
    } catch (error) {
      loadMore.hidden = false; loadMore.textContent = isArabic ? 'تعذر التحميل — أعد المحاولة' : 'Could not load — retry'; loadMore.title = error.message;
    } finally {
      if (requestId === activeRequest) { requestBusy = false; loadMore.disabled = false; }
    }
  }

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
      loadVideos(true);
      applyFilters();
    });
  });
  loadMore.addEventListener('click', () => loadVideos(false));
  let searchTimer;
  input?.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => loadVideos(true), 500); });
  loadVideos(true);
  applyFilters();
})();