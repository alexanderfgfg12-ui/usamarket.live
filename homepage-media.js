(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const videos = [
    {id:'rfbhwB2a6Qo',title:'Monetary Policy: The Fed and You',source:'Federal Reserve Education',category:'Markets'},
    {id:'wOfQPn9Jwpo',title:'Monetary Policy Explained',source:'Federal Reserve Education',category:'Markets'},
    {id:'xHQJBNO0yQc',title:'Conducting Monetary Policy',source:'Federal Reserve Education',category:'Markets'},
    {id:'Yq_FoufpKsI',title:'Get Into Stocks: Understanding Shares and Risk',source:'Federal Reserve Education',category:'Investing'},
    {id:'kDFrmMfjRHk',title:'The Basics of Investing',source:'Investor.gov',category:'Investing'}
  ];
  function setupVideos(){
    const grid=$('#homeVideoCards'),dialog=$('#homeVideoDialog'),player=$('#homeVideoPlayer');
    if(!grid||!dialog||!player)return;
    grid.innerHTML=videos.slice(0,4).map(v=>'<button class="um-video-card" type="button" data-video-id="'+v.id+'" aria-label="Play '+esc(v.title)+'"><span class="um-video-thumb" style="background-image:url(https://i.ytimg.com/vi/'+v.id+'/hqdefault.jpg)"></span><strong>'+esc(v.title)+'</strong><small>'+esc(v.source)+'</small></button>').join('');
    grid.addEventListener('click',e=>{
      const button=e.target.closest('[data-video-id]');if(!button)return;
      const id=button.dataset.videoId;
      player.innerHTML='<iframe src="https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id)+'?autoplay=1&rel=0" title="Usamarket video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>';
      if(typeof dialog.showModal==='function')dialog.showModal();else window.open('https://www.youtube.com/watch?v='+encodeURIComponent(id),'_blank','noopener');
    });
    const close=()=>{player.innerHTML='';dialog.close();};
    $('.um-video-close',dialog)?.addEventListener('click',close);
    dialog.addEventListener('click',e=>{if(e.target===dialog)close();});
    dialog.addEventListener('close',()=>{player.innerHTML='';});
  }
  function price(p){const n=Number(p.price);if(!Number.isFinite(n))return '';try{return new Intl.NumberFormat('en-US',{style:'currency',currency:p.currency||'USD'}).format(n)}catch{return '$'+n.toFixed(2)}}
  function setupProducts(){
    const track=$('#homeProductTrack');if(!track)return;
    let timer=null,paused=false;
    const render=items=>{
      const unique=[],seen=new Set();
      for(const p of items){if(!p?.title||!p?.image||!p?.affiliateUrl||seen.has(p.affiliateUrl))continue;seen.add(p.affiliateUrl);unique.push(p);if(unique.length===12)break;}
      if(!unique.length)throw new Error('No displayable products');
      track.innerHTML=unique.map(p=>'<a class="um-home-product" href="/shop/" aria-label="Browse '+esc(p.title)+' in the store"><img src="'+esc(p.image)+'" alt="'+esc(p.title)+'" loading="lazy" decoding="async"><div class="um-home-product-copy"><strong>'+esc(p.title)+'</strong><span class="um-home-product-price">'+esc(price(p))+'</span></div></a>').join('');
      // Auto-scroll the shelf; pause whenever a visitor interacts with it.
      const step=()=>{if(paused||document.hidden)return;const max=track.scrollWidth-track.clientWidth;if(max<10)return;if(track.scrollLeft>=max-8)track.scrollTo({left:0,behavior:'smooth'});else track.scrollBy({left:Math.max(170,track.clientWidth*.72),behavior:'smooth'});};
      timer=window.setInterval(step,4200);
      track.addEventListener('mouseenter',()=>paused=true);track.addEventListener('mouseleave',()=>paused=false);
      track.addEventListener('focusin',()=>paused=true);track.addEventListener('focusout',()=>paused=false);
      track.addEventListener('touchstart',()=>paused=true,{passive:true});track.addEventListener('touchend',()=>{window.setTimeout(()=>paused=false,1800)},{passive:true});
      document.addEventListener('visibilitychange',()=>{if(document.hidden)paused=true;else paused=false;});
      document.querySelectorAll('[data-product-scroll]').forEach(button=>button.addEventListener('click',()=>{paused=true;track.scrollBy({left:Number(button.dataset.productScroll)*Math.max(180,track.clientWidth*.8),behavior:'smooth'});window.setTimeout(()=>paused=false,2200);}));
    };
    (async()=>{
      try{
        const response=await fetch('/shop/products-manifest.json',{cache:'no-cache'});if(!response.ok)throw new Error('manifest unavailable');
        const manifest=await response.json();if(!Array.isArray(manifest.batches)||!manifest.batches.length)throw new Error('empty manifest');
        const batchResponse=await fetch('/shop/'+encodeURIComponent(manifest.batches[0])+'?v='+encodeURIComponent(manifest.updatedAt||''),{cache:'default'});
        if(!batchResponse.ok)throw new Error('product batch unavailable');
        const data=await batchResponse.json();render(Array.isArray(data.products)?data.products:[]);
      }catch(error){track.innerHTML='<a class="um-shelf-loading" href="/shop/">Explore all products in the store →</a>';console.warn('Homepage product shelf:',error);}
    })();
  }
  setupVideos();setupProducts();
})();