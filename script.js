let allNews = [];
let lastNewsTitle = '';

// ============ تحميل الأخبار ============
async function loadNews() {
  try {
    const res = await fetch('news-data.json?t=' + Date.now());
    if (!res.ok) throw new Error('No data');
    const data = await res.json();

    const t = translations[getCurrentLang()] || translations.ar;
    const dateLocale = { ar: 'ar-EG', en: 'en-US', fr: 'fr-FR', es: 'es-ES', de: 'de-DE', tr: 'tr-TR', zh: 'zh-CN' }[getCurrentLang()] || 'en-US';

    document.getElementById('lastUpdate').textContent =
      new Date(data.updated).toLocaleString(dateLocale, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });

    // إشعار بالخبر الجديد
    if (data.articles[0] && lastNewsTitle && data.articles[0].title !== lastNewsTitle) {
      showToast(t['notification.new'], data.articles[0].title.substring(0, 60) + '...');
      if (Notification.permission === 'granted') {
        new Notification(t['notification.newNews'], {
          body: data.articles[0].title.substring(0, 100),
          icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📈</text></svg>'
        });
      }
    }
    if (data.articles[0]) lastNewsTitle = data.articles[0].title;

    renderFeatured(data.articles[0]);
    renderNews(data.articles);
    loadMarketData();
  } catch (err) {
    console.error('Failed to load news:', err);
    document.getElementById('newsGrid').innerHTML =
      '<div class="no-news">⚠️</div>';
  }
}

// ============ عرض الخبر المميز ============
function renderFeatured(article) {
  if (!article) return;
  const t = translations[getCurrentLang()] || translations.ar;
  const container = document.getElementById('featured');
  container.innerHTML = `
    <div class="featured-card">
      <span class="featured-tag">${t['featured.tag'] || '🔥'}</span>
      <h2><a href="${article.link}" target="_blank" rel="noopener">${escapeHtml(article.title)}</a></h2>
      <p>${escapeHtml(article.description || '')}</p>
      <div class="featured-meta">
        <span>📰 ${escapeHtml(article.source)}</span>
        <span>🕒 ${formatDate(article.pubDate)}</span>
      </div>
    </div>
  `;
}

// ============ عرض قائمة الأخبار ============
function renderNews(articles) {
  const grid = document.getElementById('newsGrid');
  const t = translations[getCurrentLang()] || translations.ar;

  if (!articles || articles.length === 0) {
    grid.innerHTML = '<div class="no-news">لا توجد أخبار حالياً</div>';
    return;
  }

  grid.innerHTML = articles.slice(1, 30).map(a => `
    <article class="news-card" data-category="${a.category || 'all'}">
      <span class="news-source">📰 ${escapeHtml(a.source)}</span>
      <h3><a href="${a.link}" target="_blank" rel="noopener">${escapeHtml(a.title)}</a></h3>
      <p>${escapeHtml(a.description || '')}</p>
      <div class="news-meta">
        <span>🕒 ${formatDate(a.pubDate)}</span>
        <a href="${a.link}" target="_blank" rel="noopener" class="read-more">${t['news.readMore'] || '→'}</a>
      </div>
    </article>
  `).join('');
}

// ============ أدوات مساعدة ============
function formatDate(dateStr) {
  if (!dateStr) return '';
  const lang = getCurrentLang();
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const labels = {
    ar: ['دقيقة', 'ساعة', 'يوم', 'منذ'],
    en: ['min', 'hour', 'day', 'ago'],
    fr: ['min', 'heure', 'jour', 'il y a'],
    es: ['min', 'hora', 'día', 'hace'],
    de: ['Min', 'Std', 'Tag', 'vor'],
    tr: ['dk', 'sa', 'gün', 'önce'],
    zh: ['分钟', '小时', '天', '前']
  };
  const l = labels[lang] || labels.en;
  if (lang === 'ar') {
    if (mins < 60) return `منذ ${mins} ${l[0]}`;
    if (hours < 24) return `منذ ${hours} ${l[1]}`;
    if (days < 7) return `منذ ${days} ${l[2]}`;
    return new Date(dateStr).toLocaleDateString('ar-EG');
  }
  if (mins < 60) return `${mins} ${l[0]} ${l[3]}`;
  if (hours < 24) return `${hours} ${l[1]} ${l[3]}`;
  if (days < 7) return `${days} ${l[2]} ${l[3]}`;
  return new Date(dateStr).toLocaleDateString();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

// ============ بيانات السوق الحية ============
async function loadMarketData() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true');
    const data = await res.json();

    if (data.bitcoin) {
      const price = data.bitcoin.usd.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
      const change = data.bitcoin.usd_24h_change;
      document.getElementById('t-btc').innerHTML = `${price} <span style="color:${change >= 0 ? '#22c55e' : '#ef4444'};font-size:0.8rem">${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%</span>`;
    }
    if (data.ethereum) {
      const price = data.ethereum.usd.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
      const change = data.ethereum.usd_24h_change;
      document.getElementById('t-eth').innerHTML = `${price} <span style="color:${change >= 0 ? '#22c55e' : '#ef4444'};font-size:0.8rem">${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%</span>`;
    }
  } catch (err) { console.log('Market data failed'); }
}

// ============ فلترة الأخبار ============
document.addEventListener('click', e => {
  if (e.target.classList.contains('filter-btn')) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    const filter = e.target.dataset.filter;
    document.querySelectorAll('.news-card').forEach(card => {
      card.style.display = (filter === 'all' || card.dataset.category === filter) ? 'flex' : 'none';
    });
  }
});

// ============ تبديل اللغة ============
document.getElementById('langSelect').addEventListener('change', e => {
  applyLanguage(e.target.value);
  renderFeatured(allNews[0]);
  renderNews(allNews);
});

// ============ الإشعارات ============
document.getElementById('notifyBtn').addEventListener('click', async () => {
  const t = translations[getCurrentLang()] || translations.ar;
  if (!('Notification' in window)) {
    showToast('❌', 'الإشعارات غير مدعومة', true);
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    showToast('🔔', t['notification.enabled']);
    document.getElementById('notifyBtn').classList.add('active');
    new Notification(t['notification.newNews'], {
      body: 'US Market Live',
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📈</text></svg>'
    });
  } else {
    showToast('❌', t['notification.denied'], true);
  }
});

// ============ النشرة البريدية ============
document.getElementById('newsletterForm').addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('newsletterEmail').value;
  const msgEl = document.getElementById('newsletterMsg');
  const t = translations[getCurrentLang()] || translations.ar;

  if (!email || !email.includes('@')) {
    msgEl.textContent = t['newsletter.error'];
    msgEl.style.color = '#ef4444';
    return;
  }

  // حفظ في localStorage (بديل مؤقت لعدم وجود backend)
  const subs = JSON.parse(localStorage.getItem('newsletter_subs') || '[]');
  if (!subs.includes(email)) subs.push(email);
  localStorage.setItem('newsletter_subs', JSON.stringify(subs));

  msgEl.textContent = t['newsletter.success'];
  msgEl.style.color = '#22c55e';
  document.getElementById('newsletterEmail').value = '';
  showToast('📧', t['newsletter.success']);
});

// ============ Toast ============
function showToast(title, body, isError = false) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast' + (isError ? ' error' : '');
  toast.innerHTML = `<strong>${title}</strong>${body}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
}

// ============ Back to Top ============
const backBtn = document.getElementById('backToTop');
window.addEventListener('scroll', () => {
  backBtn.classList.toggle('visible', window.scrollY > 500);
});
backBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// ============ تسجيل Service Worker (PWA) ============
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(err => console.log('SW failed', err));
}

// ============ التهيئة ============
document.getElementById('year').textContent = new Date().getFullYear();

// تحديد اللغة الأولية
const initialLang = getCurrentLang();
applyLanguage(initialLang);

// تحميل الأخبار
loadNews();
setInterval(loadNews, 5 * 60 * 1000);
setInterval(loadMarketData, 60 * 1000);
