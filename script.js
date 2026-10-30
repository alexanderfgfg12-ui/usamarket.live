let allNews = [];

// 1. جلب الأخبار
async function loadNews() {
  try {
    const res = await fetch('news-data.json?t=' + Date.now());
    const data = await res.json();
    document.getElementById('lastUpdate').textContent = new Date(data.updated).toLocaleString('en-US');
    allNews = data.articles || [];
    renderNews(allNews);
  } catch (err) {
    document.getElementById('newsGrid').innerHTML = 'Error loading news.';
  }
}

// 2. عرض الأخبار
function renderNews(articles) {
  const grid = document.getElementById('newsGrid');
  if (!articles || articles.length === 0) {
    grid.innerHTML = '<div style="text-align:center;">No results found.</div>';
    return;
  }

  grid.innerHTML = articles.map((a) => `
    <article class="news-card" style="cursor: pointer;" onclick="window.location.href='news/${a.id}.html'">
      ${a.image ? `<img src="${a.image}" style="width:100%; height:180px; object-fit:cover; border-radius:8px; margin-bottom:12px;" alt="${a.title}">` : ''}
      <span class="news-source">📰 ${a.source}</span>
      <h3>${a.title}</h3>
      <p>${a.description || ''}</p>
      <span class="read-more">Read →</span>
    </article>
  `).join('');
}

// 3. تفعيل البحث
function filterNews() {
  const query = document.getElementById('searchInput').value.toLowerCase();
  const filtered = allNews.filter(a => a.title.toLowerCase().includes(query) || a.description.toLowerCase().includes(query));
  renderNews(filtered);
}

// 4. جلب الأسعار الحية (BTC, ETH)
async function loadMarketData() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
    const data = await res.json();
    if (data.bitcoin) document.getElementById('t-btc').innerText = `₿ BTC: $${data.bitcoin.usd.toLocaleString()}`;
    if (data.ethereum) document.getElementById('t-eth').innerText = `Ξ ETH: $${data.ethereum.usd.toLocaleString()}`;
    document.getElementById('t-spx').innerText = `📈 S&P 500: 5,200`; // قيمة افتراضية
  } catch (err) {}
}

document.getElementById('year').textContent = new Date().getFullYear();
loadNews();
loadMarketData();
setInterval(loadMarketData, 60000); // تحديث الأسعار كل دقيقة
