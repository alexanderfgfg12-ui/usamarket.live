let allNews = [];

async function loadNews() {
  try {
    const res = await fetch('news-data.json?t=' + Date.now());
    if (!res.ok) throw new Error('No data');
    const data = await res.json();

    // تحديث وقت آخر تحديث
    const lastUpdateEl = document.getElementById('lastUpdate');
    if (lastUpdateEl) {
      lastUpdateEl.textContent = new Date(data.updated).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    }

    allNews = data.articles || [];
    renderNews(allNews);
  } catch (err) {
    console.error('Failed to load news:', err);
    const grid = document.getElementById('newsGrid');
    if (grid) grid.innerHTML = '<div style="color: white; text-align: center;">⚠️ No news available</div>';
  }
}

function renderNews(articles) {
  const grid = document.getElementById('newsGrid');
  if (!articles || articles.length === 0) {
    grid.innerHTML = '<div style="color: white; text-align: center;">No news available</div>';
    return;
  }

  // عرض الأخبار في بطاقات أنيقة مع الصور
  grid.innerHTML = articles.map((a) => `
    <article class="news-card" style="cursor: pointer; display: flex; flex-direction: column;" onclick="window.location.href='news/${a.id}.html'">
      ${a.image ? `<img src="${a.image}" style="width:100%; height:180px; object-fit:cover; border-radius:8px; margin-bottom:12px;" alt="${a.title}">` : ''}
      <span class="news-source" style="color: #0047FF; font-weight: bold; font-size: 0.85rem;">📰 ${a.source || 'US Market Live'}</span>
      <h3 style="color: #fff; margin: 8px 0; font-size: 1.2rem;">${a.title}</h3>
      <p style="color: #A0AABF; font-size: 0.95rem; flex-grow: 1;">${a.description || ''}</p>
      <div style="margin-top: auto; padding-top: 10px;">
        <span style="color: #00C853; font-weight: bold;">Read Article →</span>
      </div>
    </article>
  `).join('');
}

// تشغيل الدالة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  
  loadNews();
});
