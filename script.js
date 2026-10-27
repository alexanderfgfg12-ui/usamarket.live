let allNews = [];

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
    renderNews(allNews);
  } catch (err) {
    console.error('Failed to load news:', err);
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
    <article class="news-card" data-index="${i}">
      <span class="news-source">📰 ${escapeHtml(a.source || 'US Market Live')}</span>
      <h3><a href="#" data-index="${i}">${escapeHtml(a.title)}</a></h3>
      <p>${escapeHtml(a.description || '')}</p>
      <div class="news-meta">
        <a href="#" data-index="${i}" class="read-more">Read More →</a>
      </div>
    </article>
  `).join('');
}

function openArticle(index) {
  const article = allNews[index];
  if (!article) return;

  document.getElementById('modalTitle').textContent = article.title;
  document.getElementById('modalMeta').innerHTML = `<span>📰 ${escapeHtml(article.source)}</span>`;
  
  document.getElementById('modalText').innerHTML = article.content ? article.content : `<p>${escapeHtml(article.description)}</p>`;
  
  document.getElementById('modalAnalysis').innerHTML = '';
  
  const modalFooter = document.getElementById('modalFooter');
  if (modalFooter) {
    modalFooter.innerHTML = article.id 
      ? `<a href="news/${article.id}.html" style="background: #e11d48; color: white; padding: 10px 15px; border-radius: 5px; text-decoration: none;">Open Full Page</a>` 
      : '';
  }

  document.getElementById('articleModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeArticle() {
  document.getElementById('articleModal').classList.remove('active');
  document.body.style.overflow = '';
}

document.addEventListener('click', e => {
  const link = e.target.closest('a[data-index]');
  if (link) {
    e.preventDefault();
    openArticle(parseInt(link.dataset.index));
    return;
  }
  if (e.target.id === 'modalClose' || e.target.id === 'articleModal') {
    closeArticle();
  }
});

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

document.getElementById('year').textContent = new Date().getFullYear();
loadNews();
