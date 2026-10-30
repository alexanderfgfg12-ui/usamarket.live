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
    document.getElementById('newsGrid').innerHTML = '<div style="color: red; text-align: center;">⚠️ No news available</div>';
  }
}

function renderNews(articles) {
  const grid = document.getElementById('newsGrid');
  if (!articles || articles.length === 0) {
    grid.innerHTML = '<div style="text-align: center;">No news available</div>';
    return;
  }

  grid.innerHTML = articles.map((a) => `
    <article class="news-card" style="cursor: pointer; display: flex; flex-direction: column;" onclick="window.location.href='news/${a.id}.html'">
      ${a.image ? `<img src="${a.image}" style="width:100%; height:180px; object-fit:cover; border-radius:8px; margin-bottom:12px;" alt="${a.title}">` : ''}
      <span class="news-source">📰 ${a.source || 'US Market Live'}</span>
      <h3>${a.title}</h3>
      <p>${a.description || ''}</p>
      <div style="margin-top: auto; padding-top: 10px;">
        <span class="read-more">Read Article →</span>
      </div>
    </article>
  `).join('');
}

document.getElementById('year').textContent = new Date().getFullYear();
loadNews();
