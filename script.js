let allNews = [];

async function loadNews() {
  try {
    const res = await fetch('news-data.json?t=' + Date.now());
    if (!res.ok) throw new Error('No data');
    const data = await res.json();

    document.getElementById('lastUpdate').textContent = new Date(data.updated).toLocaleString('en-US');
    allNews = data.articles || [];
    renderNews(allNews);
  } catch (err) {
    document.getElementById('newsGrid').innerHTML = '<div class="no-news">⚠️ No news available</div>';
  }
}

function renderNews(articles) {
  const grid = document.getElementById('newsGrid');
  if (!articles || articles.length === 0) {
    grid.innerHTML = '<div class="no-news">No news available</div>';
    return;
  }

  grid.innerHTML = articles.map((a, i) => `
    <article class="news-card" style="cursor: pointer; display: flex; flex-direction: column;" onclick="window.location.href='news/${a.id}.html'">
      ${a.image ? `<img src="${a.image}" style="width:100%; height:200px; object-fit:cover; border-radius:8px; margin-bottom:12px;" alt="${a.title}">` : ''}
      <span class="news-source" style="font-size:0.8rem; color:#00e5ff;">📰 ${a.source}</span>
      <h3 style="color:#fff; margin-top:5px;">${a.title}</h3>
      <p style="color:#9ca3af;">${a.description}</p>
      <div class="news-meta" style="margin-top:auto; padding-top:10px;">
        <span style="color: #e11d48; font-weight: bold;">Read Article →</span>
      </div>
    </article>
  `).join('');
}

document.getElementById('year').textContent = new Date().getFullYear();
loadNews();
