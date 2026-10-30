let allNews = [];
let currentCategory = 'all';

async function loadNews() {
  try {
    const res = await fetch('news-data.json?t=' + Date.now());
    const data = await res.json();
    document.getElementById('lastUpdate').textContent = new Date(data.updated).toLocaleString('en-US');
    allNews = data.articles || [];
    renderNews(allNews);
  } catch (err) {
    document.getElementById('newsGrid').innerHTML = '<div style="text-align:center; padding:20px;">Error loading news.</div>';
  }
}

function renderNews(articles) {
  const grid = document.getElementById('newsGrid');
  if (!articles || articles.length === 0) {
    grid.innerHTML = '<div style="text-align:center; padding:20px;">No results found.</div>';
    return;
  }

  grid.innerHTML = articles.map((a) => `
    <article class="news-card" style="cursor: pointer;" onclick="window.location.href='news/${a.id}.html'">
      ${a.image ? `<img src="${a.image}" loading="lazy" style="width:100%; height:180px; object-fit:cover; border-radius:8px; margin-bottom:12px;" alt="${a.title}">` : ''}
      <span class="news-source">📰 ${a.category ? a.category.toUpperCase() : 'MARKET'}</span>
      <h3>${a.title}</h3>
      <p>${a.description || ''}</p>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 10px;">
        <span class="read-more">Read Article →</span>
        <div style="display: flex; gap: 5px;" onclick="event.stopPropagation();">
          <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(a.title)}&url=https://usamarket.live/news/${a.id}.html" target="_blank" style="background:#000; color:#fff; padding:5px 10px; border-radius:4px; font-size:0.8rem; text-decoration:none;">𝕏</a>
          <a href="https://api.whatsapp.com/send?text=${encodeURIComponent(a.title)}%20https://usamarket.live/news/${a.id}.html" target="_blank" style="background:#25D366; color:#fff; padding:5px 10px; border-radius:4px; font-size:0.8rem; text-decoration:none;">💬</a>
        </div>
      </div>
    </article>
  `).join('');
}

function filterCategory(category, event) {
  if (event) event.preventDefault();
  currentCategory = category;
  document.querySelectorAll('.cat-btn').forEach(btn => btn.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');

  if (category === 'all') {
    renderNews(allNews);
  } else {
    const filtered = allNews.filter(a => a.category === category);
    renderNews(filtered);
  }
}

function filterNews() {
  const query = document.getElementById('searchInput').value.toLowerCase();
  const filtered = allNews.filter(a => a.title.toLowerCase().includes(query) || a.description.toLowerCase().includes(query));
  renderNews(filtered);
}

async function loadMarketData() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
    const data = await res.json();
    if (data.bitcoin) document.getElementById('t-btc').innerText = `₿ BTC: $${data.bitcoin.usd.toLocaleString()}`;
    if (data.ethereum) document.getElementById('t-eth').innerText = `Ξ ETH: $${data.ethereum.usd.toLocaleString()}`;
  } catch (err) {}
}

window.addEventListener('scroll', () => {
  const btn = document.getElementById('backToTop');
  if (btn) {
    if (window.scrollY > 300) {
      btn.style.display = 'block';
    } else {
      btn.style.display = 'none';
    }
  }
});

document.getElementById('year').textContent = new Date().getFullYear();
loadNews();
loadMarketData();
setInterval(loadMarketData, 60000);
