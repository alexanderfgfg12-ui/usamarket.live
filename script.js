let allNews = [];
let lastNewsTitle = '';

async function loadNews() {
  try {
    const res = await fetch('news-data.json?t=' + Date.now());
    if (!res.ok) throw new Error('No data');
    const data = await res.json();

    document.getElementById('lastUpdate').textContent =
      new Date(data.updated).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });

    allNews = data.articles || [];
    renderFeatured(allNews[0]);
    renderNews(allNews);
    loadMarketData();
  } catch (err) {
    console.error('Failed to load news:', err);
    document.getElementById('newsGrid').innerHTML = '<div class="no-news">⚠️ No news available</div>';
  }
}

function renderFeatured(article) {
  if (!article) return;
  document.getElementById('featured').innerHTML = `
    <div class="featured-card" data-index="0">
      <span class="featured-tag">🔥 TOP STORY</span>
      <h2><a href="#" data-index="0">${escapeHtml(article.title)}</a></h2>
      <p>${escapeHtml(article.description)}</p>
      ${article.analysis ? `<div class="featured-analysis">💡 ${escapeHtml(article.analysis)}</div>` : ''}
      <div class="featured-meta">
        <span>📰 ${escapeHtml(article.source)}</span>
        <span>🕒 ${formatDate(article.pubDate)}</span>
      </div>
    </div>
  `;
}

function renderNews(articles) {
  const grid = document.getElementById('newsGrid');
  if (!articles || articles.length === 0) {
    grid.innerHTML = '<div class="no-news">No news available</div>';
    return;
  }

  grid.innerHTML = articles.slice(1, 30).map((a, i) => `
    <article class="news-card" data-category="${a.category || 'all'}" data-index="${i + 1}">
      <span class="news-source">📰 ${escapeHtml(a.source)}</span>
      <h3><a href="#" data-index="${i + 1}">${escapeHtml(a.title)}</a></h3>
      <p>${escapeHtml(a.description)}</p>
      ${a.analysis ? `<div class="news-analysis">💡 ${escapeHtml(a.analysis)}</div>` : ''}
      <div class="news-meta">
        <span>🕒 ${formatDate(a.pubDate)}</span>
        <a href="#" data-index="${i + 1}" class="read-more">Read Analysis →</a>
      </div>
    </article>
  `).join('');
}

// ===== Modal (النافذة المنبثقة) =====
function openArticle(index) {
  const article = allNews[index];
  if (!article) return;

  document.getElementById('modalTitle').textContent = article.title;
  document.getElementById('modalMeta').innerHTML = `
    <span class="news-source">📰 ${escapeHtml(article.source)}</span>
    <span>🕒 ${formatDate(article.pubDate)}</span>
  `;
  
  // السطر الأهم: عرض المحتوى الكامل (content) داخل الموقع نفسه
  document.getElementById('modalText').innerHTML = article.content ? article.content : `<p>${escapeHtml(article.description)}</p>`;
  
  document.getElementById('modalAnalysis').innerHTML = article.analysis
    ? `<strong>💡 Analysis:</strong> ${escapeHtml(article.analysis)}`
    : '';
  
  const modalFooter = document.getElementById('modalFooter');
  if (modalFooter) {
    // إذا كان هناك صفحة داخلية (مجلد news)، نضع زراً لفتحها
    const articleUrl = article.id ? `news/${article.id}.html` : null;
    
    modalFooter.innerHTML = `
      ${articleUrl ? `<a href="${articleUrl}" class="btn-source" style="background: #e11d48; color: white; margin-right: 10px; text-decoration: none; display: inline-block; padding: 10px 15px; border-radius: 5px; font-weight: bold;">Open Full Page</a>` : ''}
      <a href="${article.link}" target="_blank" rel="noopener" class="btn-source" style="background: transparent; border: 1px solid #555; color: #ccc;">Read at Source (${article.source}) →</a>
    `;
  }

  document.getElementById('articleModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeArticle() {
  document.getElementById('articleModal').classList.remove('active');
  document.body.style.overflow = '';
}

// ربط النقرات
document.addEventListener('click', e => {
  const link = e.target.closest('a[data-index], .featured-card');
  if (link) {
    e.preventDefault();
    const index = parseInt(link.dataset.index || '0');
    openArticle(index);
    return;
  }
  if (e.target.id === 'modalClose' || e.target.id === 'articleModal') {
    closeArticle();
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeArticle();
});

// ===== Helpers =====
function formatDate(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// ===== Market Data =====
async function loadMarketData() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true');
    const data = await res.json();
    if (data.bitcoin) {
      const p = data.bitcoin.usd.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
      const c = data.bitcoin.usd_24h_change;
      document.getElementById('t-btc').innerHTML = `${p} <span style="color:${c >= 0 ? '#22c55e' : '#ef4444'};font-size:0.8rem">${c >= 0 ? '▲' : '▼'} ${Math.abs(c).toFixed(2)}%</span>`;
    }
    if (data.ethereum) {
      const p = data.ethereum.usd.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
      const c = data.ethereum.usd_24h_change;
      document.getElementById('t-eth').innerHTML = `${p} <span style="color:${c >= 0 ? '#22c55e' : '#ef4444'};font-size:0.8rem">${c >= 0 ? '▲' : '▼'} ${Math.abs(c).toFixed(2)}%</span>`;
    }
  } catch (err) {}
}

// ===== Filters =====
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

// ===== Notifications =====
document.getElementById('notifyBtn').addEventListener('click', async () => {
  if (!('Notification' in window)) { alert('Notifications not supported'); return; }
  const p = await Notification.requestPermission();
  if (p === 'granted') {
    document.getElementById('notifyBtn').classList.add('active');
  }
});

// ===== Newsletter =====
document.getElementById('newsletterForm').addEventListener('submit', e => {
  e.preventDefault();
  const email = document.getElementById('newsletterEmail').value;
  const msg = document.getElementById('newsletterMsg');
  if (!email.includes('@')) {
    msg.textContent = '❌ Please enter a valid email';
    msg.style.color = '#ef4444';
    return;
  }
  msg.textContent = '✅ Subscribed successfully!';
  msg.style.color = '#22c55e';
  document.getElementById('newsletterEmail').value = '';
});

// ===== Back to top =====
const backBtn = document.getElementById('backToTop');
window.addEventListener('scroll', () => backBtn.classList.toggle('visible', window.scrollY > 500));
backBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// ===== SW =====
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// ===== Init =====
document.getElementById('year').textContent = new Date().getFullYear();
loadNews();
setInterval(loadNews, 5 * 60 * 1000);
setInterval(loadMarketData, 60 * 1000);
