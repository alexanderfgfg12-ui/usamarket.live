async function loadNews() {
  try {
    const res = await fetch('news-data.json?t=' + Date.now());
    const data = await res.json();
    
    // عرض وقت التحديث
    const lastUpdateEl = document.getElementById('lastUpdate');
    if (lastUpdateEl) {
      lastUpdateEl.textContent = new Date(data.updated).toLocaleString('en-US');
    }

    const grid = document.getElementById('newsGrid');
    if (!data.articles || data.articles.length === 0) {
      grid.innerHTML = '<div class="no-news">No news available</div>';
      return;
    }

    // عرض الأخبار كروابط مباشرة لصفحات HTML
    grid.innerHTML = data.articles.map(a => `
      <article class="news-card" style="cursor: pointer;" onclick="window.location.href='news/${a.id}.html'">
        <span class="news-source">📰 ${a.source || 'US Market Live'}</span>
        <h3 style="color: #00e5ff;">${a.title}</h3>
        <p>${a.description || ''}</p>
        <div class="news-meta">
          <span style="color: #e11d48; font-weight: bold;">Read Article →</span>
        </div>
      </article>
    `).join('');

  } catch (err) {
    console.error('Error:', err);
    document.getElementById('newsGrid').innerHTML = '<div class="no-news">Error loading news</div>';
  }
}

// تشغيل الدالة عند تحميل الصفحة
document.getElementById('year').textContent = new Date().getFullYear();
loadNews();
