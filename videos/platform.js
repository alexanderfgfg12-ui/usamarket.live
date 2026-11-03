(function () {
  'use strict';

  const isArabic = document.documentElement.lang === 'ar';
  const toolbar = document.querySelector('.video-toolbar');
  const cards = [...document.querySelectorAll('.video-card')];
  const dialog = document.querySelector('[data-video-dialog]');
  const player = dialog?.querySelector('[data-video-player]');
  const caption = dialog?.querySelector('[data-video-caption]');
  const closeButton = dialog?.querySelector('[data-video-close]');

  function stopPlayback() {
    if (player) player.replaceChildren();
    if (caption) caption.textContent = '';
    if (dialog?.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }

  function playVideo(trigger) {
    const id = (trigger.dataset.videoId || '').trim();
    if (!id || !player || !dialog) return;

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

    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  document.addEventListener('click', function (event) {
    const trigger = event.target.closest && event.target.closest('[data-video-id]');
    if (!trigger) return;
    event.preventDefault();
    playVideo(trigger);
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