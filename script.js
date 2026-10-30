let allNews = [];
let currentCategory = 'all';

// دالة الترجمة المباشرة (تترجم الصفحة الحالية أينما كانت)
window.changeLanguage = function() {
  const lang = document.getElementById('languageSelect').value;
  if (lang === 'en') {
    window.location.href = window.location.href.split('#')[0]; // العودة للإنجليزية
  } else {
    // استخدام خوادم جوجل لترجمة الرابط الحالي
    window.location.href = `https://usamarket-live.translate.goog${window.location.pathname}?_x_tr_sl=en&_x_tr_tl=${lang}&_x_tr_hl=en`;
  }
};

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
        <div style="display: flex; gap: 8px;" onclick="event.stopPropagation();">
          <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(a.title)}&url=https://usamarket.live/news/${a.id}.html" target="_blank" style="background:#000; color:#fff; width:30px; height:30px; border-radius:50%; display:flex; justify-content:center; align-items:center; text-decoration:none;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </a>
          <a href="https://api.whatsapp.com/send?text=${encodeURIComponent(a.title)}%20https://usamarket.live/news/${a.id}.html" target="_blank" style="background:#25D366; color:#fff; width:30px; height:30px; border-radius:50%; display:flex; justify-content:center; align-items:center; text-decoration:none;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
          </a>
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
    btn.style.display = window.scrollY > 300 ? 'block' : 'none';
  }
});

document.getElementById('year').textContent = new Date().getFullYear();
loadNews();
loadMarketData();
setInterval(loadMarketData, 60000);
