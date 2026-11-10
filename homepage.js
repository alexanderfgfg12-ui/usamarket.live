(() => {
  const $ = (selector) => document.querySelector(selector);
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let articles = [];
  let activeFilter = 'all';
  const categoryLabel = (value) => ({markets:'Markets',economy:'Economy',technology:'Technology',crypto:'Crypto',business:'Business',finance:'Finance',world:'World'}[String(value||'').toLowerCase()] || String(value||'News'));
  const articleURL = (item) => item.path || ('/news/' + encodeURIComponent(item.id) + '.html');
  const imageMarkup = (item) => item.image ? '<img src="' + escapeHTML(item.image) + '" alt="' + escapeHTML(item.title) + '" loading="lazy" decoding="async">' : '';
  const metaMarkup = (item) => '<div class="um-meta"><span>▣ ' + escapeHTML(item.pubDate ? new Date(item.pubDate).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : 'Latest') + '</span><span>US Market Live</span></div>';
  function renderLead(){
    const primary = $('#leadPrimary'), secondary = $('#leadSecondary');
    if(!articles.length){primary.innerHTML='<div class="um-loading">No featured stories are available right now.</div>';return;}
    const [main,...rest] = articles.slice(0,3);
    primary.innerHTML='<a class="um-lead-primary" href="'+articleURL(main)+'">'+imageMarkup(main)+'<div class="um-lead-copy"><span class="um-tag">'+escapeHTML(categoryLabel(main.category))+'</span><h1>'+escapeHTML(main.title)+'</h1>'+metaMarkup(main)+'</div></a>';
    secondary.innerHTML=rest.map(item=>'<a class="um-lead-card" href="'+articleURL(item)+'">'+imageMarkup(item)+'<div class="um-lead-copy"><span class="um-tag">'+escapeHTML(categoryLabel(item.category))+'</span><h2>'+escapeHTML(item.title)+'</h2>'+metaMarkup(item)+'</div></a>').join('');
  }
  function renderNews(list){
    const grid=$('#newsGrid');
    if(!list.length){grid.innerHTML='<div class="um-loading">No stories match this search. Try another topic.</div>';return;}
    grid.innerHTML=list.map(item=>'<article class="um-news-card"><a href="'+articleURL(item)+'">'+imageMarkup(item)+'</a><div class="um-news-card-body"><span class="um-tag">'+escapeHTML(categoryLabel(item.category))+'</span><h3><a href="'+articleURL(item)+'">'+escapeHTML(item.title)+'</a></h3><p>'+escapeHTML(item.description||'')+'</p><time>'+escapeHTML(item.pubDate?new Date(item.pubDate).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'Latest')+'</time></div></article>').join('');
  }
  function filterList(){
    const query=String($('#searchInput')?.value||'').trim().toLowerCase();
    const filtered=articles.filter(item=>{
      const category=String(item.category||'').toLowerCase();
      const categoryMatch=activeFilter==='all'||category===activeFilter||(activeFilter==='markets'&&['stocks','finance','commodities','forex','real-estate'].includes(category));
      const textMatch=!query||[item.title,item.description,item.category].some(value=>String(value||'').toLowerCase().includes(query));
      return categoryMatch&&textMatch;
    });
    renderNews(filtered);
  }
  async function loadNews(){
    const sources = await Promise.allSettled([
      fetch('/news-data.json',{cache:'no-cache'}).then(response=>{
        if(!response.ok) throw new Error('Static news feed unavailable');
        return response.json();
      }),
      fetch('/api/news?lang=en',{cache:'no-store'}).then(response=>{
        if(!response.ok) throw new Error('Live news API unavailable');
        return response.json();
      })
    ]);
    const staticData = sources[0].status === 'fulfilled' ? sources[0].value : null;
    const liveData = sources[1].status === 'fulfilled' ? sources[1].value : null;
    const staticArticles = Array.isArray(staticData)
      ? staticData
      : (Array.isArray(staticData?.articles) ? staticData.articles : []);
    const liveArticles = Array.isArray(liveData?.articles) ? liveData.articles : [];
    const seen = new Set();
    articles = [...liveArticles,...staticArticles]
      .filter(item=>item&&item.id&&item.title)
      .filter(item=>{
        const key=String(item.link||item.title).toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,'');
        if(!key||seen.has(key))return false;
        seen.add(key);return true;
      })
      .sort((a,b)=>new Date(b.pubDate||0)-new Date(a.pubDate||0));
    if(!articles.length){
      $('#leadPrimary').innerHTML='<div class="um-loading">Top stories could not be loaded. Please refresh in a moment.</div>';
      $('#newsGrid').innerHTML='<div class="um-loading">News is temporarily unavailable.</div>';
      console.error('Both static and live news feeds are unavailable:',sources);
      return;
    }
    const updateDates=[staticData?.updated,liveData?.updatedAt]
      .map(value=>value?new Date(value):null)
      .filter(value=>value&&!Number.isNaN(value.getTime()));
    const updated=updateDates.length?new Date(Math.max(...updateDates.map(value=>value.getTime()))):null;
    $('#lastUpdate').textContent=updated?updated.toLocaleString('en-US'):'—';
    renderLead();filterList();
    if(sources.some(source=>source.status==='rejected')){
      console.warn('USAMarket is displaying available news while one feed is unavailable:',sources);
    }
  }
  async function loadCrypto(){
    try{
      const response=await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd',{cache:'no-store'});
      if(!response.ok)throw new Error('Crypto price request failed');
      const data=await response.json();
      if(data.bitcoin?.usd)$('#t-btc').textContent='$'+Number(data.bitcoin.usd).toLocaleString('en-US',{maximumFractionDigits:2});
      if(data.ethereum?.usd)$('#t-eth').textContent='$'+Number(data.ethereum.usd).toLocaleString('en-US',{maximumFractionDigits:2});
    }catch(error){$('#t-btc').textContent='Unavailable';$('#t-eth').textContent='Unavailable';}
  }
  document.addEventListener('click',event=>{
    const link=event.target.closest('[data-filter]');
    if(!link)return;
    event.preventDefault();activeFilter=link.dataset.filter||'all';filterList();
    const target=$('#latest');if(target)target.scrollIntoView({behavior:'smooth',block:'start'});
  });
  $('#searchInput')?.addEventListener('input',filterList);
  $('#viewAllNews')?.addEventListener('click',event=>{event.preventDefault();activeFilter='all';if($('#searchInput'))$('#searchInput').value='';filterList();});
  const year=$('#year');if(year)year.textContent=String(new Date().getFullYear());
  loadNews();loadCrypto();
  window.setInterval(loadCrypto,60000);
})();