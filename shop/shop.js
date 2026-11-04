(()=>{'use strict';
const $=id=>document.getElementById(id);let products=[],page=1;const PAGE_SIZE=24;
const safeUrl=value=>{try{const u=new URL(value,location.origin);return ['https:','http:'].includes(u.protocol)?u.href:''}catch{return ''}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=(v,c='USD')=>{if(v===null||v===undefined||v==='')return '';const n=Number(v);if(!Number.isFinite(n))return '';try{return new Intl.NumberFormat(undefined,{style:'currency',currency:c}).format(n)}catch{return n.toFixed(2)+' '+c}};
function hashId(value){let h=2166136261;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0').slice(0,8)}
function card(p){const link=safeUrl(p.affiliateUrl),img=safeUrl(p.image),slug=String(p.title||'product').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,75);const detail='/shop/p/'+slug+'-'+hashId(p.id||p.affiliateUrl)+'.html?id='+encodeURIComponent(p.id||p.affiliateUrl);return '<article class="product"><a class="photo" href="'+esc(detail)+'" aria-label="View '+esc(p.title)+' details">'+(img?'<img loading="lazy" decoding="async" src="'+esc(img)+'" alt="'+esc(p.title)+'">':'<span class="no-photo">Image coming soon</span>')+'</a><div class="pbody"><span class="source">'+esc(p.source||'Partner pick')+'</span><h2><a class="product-title-link" href="'+esc(detail)+'">'+esc(p.title)+'</a></h2>'+(p.description?'<p class="desc">'+esc(p.description.slice(0,115))+'</p>':'')+'<div class="price">'+money(p.price,p.currency||'USD')+(p.oldPrice?'<span class="old">'+money(p.oldPrice,p.currency||'USD')+'</span>':'')+'</div><a class="cta" href="'+esc(link)+'" target="_blank" rel="sponsored nofollow noopener">Shop this product <span aria-hidden="true">↗</span></a></div></article>'}
function enableSlowShelfMotion(section){
 const shelf=section.querySelector('.shelf');
 if(!shelf||shelf.dataset.motionReady)return;
 const originals=[...shelf.children];
 if(originals.length<2)return;
 const originalWidth=shelf.scrollWidth;
 if(originalWidth<=shelf.clientWidth+4)return;
 const clones=originals.map(node=>{const clone=node.cloneNode(true);clone.setAttribute('aria-hidden','true');clone.querySelectorAll('a,button,input,select,textarea,[tabindex]').forEach(el=>el.setAttribute('tabindex','-1'));return clone});
 clones.forEach(node=>shelf.appendChild(node));
 shelf.dataset.motionReady='true';
 let paused=false,last=0,frame=0;
 const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const speed=18; // pixels per second: deliberately slow, gentle movement
 const pause=()=>{paused=true;last=0};
 const resume=()=>{paused=false;last=0};
 section.addEventListener('pointerenter',pause);
 section.addEventListener('pointerleave',resume);
 section.addEventListener('focusin',pause);
 section.addEventListener('focusout',resume);
 section.addEventListener('touchstart',pause,{passive:true});
 section.addEventListener('touchend',()=>{setTimeout(resume,1400)},{passive:true});
 const tick=now=>{
  if(!reduce&&!paused&&!document.hidden){
   if(last){shelf.scrollLeft+=(Math.min(now-last,50)/1000)*speed;if(shelf.scrollLeft>=originalWidth)shelf.scrollLeft-=originalWidth;}
   last=now;
  }else last=0;
  frame=requestAnimationFrame(tick);
 };
 if(!reduce)frame=requestAnimationFrame(tick);
 document.addEventListener('visibilitychange',()=>{last=0});
 section.querySelectorAll('[data-scroll]').forEach(btn=>btn.addEventListener('click',()=>{pause();setTimeout(resume,1800)}));
}
function render(){const q=$('q').value.trim().toLocaleLowerCase(),cat=$('category').value,sort=$('sort').value;let list=products.filter(p=>(!cat||p.category===cat)&&(!q||[p.title,p.description,p.brand,p.category,p.source].join(' ').toLocaleLowerCase().includes(q)));if(sort==='price-asc')list.sort((a,b)=>(a.price==null?Infinity:Number(a.price))-(b.price==null?Infinity:Number(b.price)));if(sort==='price-desc')list.sort((a,b)=>(b.price==null?-Infinity:Number(b.price))-(a.price==null?-Infinity:Number(a.price)));if(sort==='newest')list.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));$('count').textContent=list.length.toLocaleString()+' '+(list.length===1?'product':'products');if(!list.length){$('products').innerHTML='<div class="empty"><strong>No products found</strong><span>Try another search or choose a different category.</span></div>';$('pagination').innerHTML='';return}const groups=cat?[{name:cat,items:list}]:[...new Set(list.map(p=>p.category||'Featured'))].map(name=>({name,items:list.filter(p=>(p.category||'Featured')===name)})).sort((a,b)=>a.name.localeCompare(b.name));$('products').className='catalogues';$('products').innerHTML=groups.map((g,i)=>'<section class="catalogue" aria-label="'+esc(g.name)+'"><div class="catalogue-head"><div><span class="catalogue-kicker">US MARKET LIVE • COLLECTION</span><h2>'+esc(g.name)+'</h2><span class="catalogue-total">'+g.items.length.toLocaleString()+' products</span></div><div class="shelf-arrows"><button type="button" aria-label="Scroll '+esc(g.name)+' left" data-scroll="-1">‹</button><button type="button" aria-label="Scroll '+esc(g.name)+' right" data-scroll="1">›</button></div></div><div class="shelf" id="shelf-'+i+'">'+g.items.map(card).join('')+'</div></section>').join('');$('products').querySelectorAll('.catalogue').forEach(section=>section.querySelectorAll('[data-scroll]').forEach(btn=>btn.addEventListener('click',()=>section.querySelector('.shelf').scrollBy({left:Number(btn.dataset.scroll)*Math.min(760,section.querySelector('.shelf').clientWidth*.85),behavior:'smooth'})));enableSlowShelfMotion(section);});$('pagination').innerHTML='';}
function categories(){const select=$('category'),current=select.value;select.innerHTML='<option value="">All categories</option>';[...new Set(products.map(p=>p.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b)).forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;select.append(o)});select.value=current}
async function fetchJson(url,timeoutMs,cacheMode='no-store'){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);try{const response=await fetch(url,{cache:cacheMode,headers:{accept:'application/json'},signal:controller.signal});if(!response.ok)throw new Error('HTTP '+response.status);return await response.json()}finally{clearTimeout(timer)}}
const CACHE_NAME='usamarket-shop-v2';
const cacheKey=url=>new URL(url,location.href).href;
async function cachedJson(url,timeoutMs=15000){
 try{if('caches' in window){const cache=await caches.open(CACHE_NAME),hit=await cache.match(cacheKey(url));if(hit)return await hit.json();}}
 catch(e){console.warn('Shop cache read skipped',e)}
 return fetchJson(url,timeoutMs);
}
async function saveCachedJson(url,data){
 try{if('caches' in window){const cache=await caches.open(CACHE_NAME);await cache.put(cacheKey(url),new Response(JSON.stringify(data),{headers:{'content-type':'application/json','cache-control':'max-age=21600'}}));}}
 catch(e){console.warn('Shop cache write skipped',e)}
}
function showUnavailable(message){$('count').textContent='No products available';$('status').textContent=message;$('products').innerHTML='<div class="empty"><strong>Products are not available yet</strong><span>'+esc(message)+'</span></div>';$('pagination').innerHTML=''}
function paintCatalogue(list,manifest){
 const unique=new Set();products=list.filter(p=>{if(!p||!p.title||!safeUrl(p.affiliateUrl))return false;const key=String(p.affiliateUrl).toLowerCase();if(unique.has(key))return false;unique.add(key);return true});
 if(!products.length)return false;
 categories();render();
 $('updated').textContent=manifest?.updatedAt?'Catalogue updated '+new Date(manifest.updatedAt).toLocaleDateString():'';
 $('status').textContent=products.length.toLocaleString()+' products ready';
 return true;
}
async function downloadCatalogue(manifest,onBatch=()=>{}){
 if(!Array.isArray(manifest.batches)||!manifest.batches.length)throw new Error('Catalogue manifest has no batches');
 const settled=await Promise.allSettled(manifest.batches.map(async name=>{
  const url='/shop/'+encodeURIComponent(name)+'?v='+encodeURIComponent(manifest.updatedAt||'');
  const data=await fetchJson(url,20000);if(!Array.isArray(data.products))throw new Error('Invalid product batch '+name);
  await saveCachedJson(url,data);onBatch(name,data.products);return {name,products:data.products};
 }));
 const products=[],failed=[];
 settled.forEach((result,index)=>{
  if(result.status==='fulfilled')products.push(...result.value.products);
  else failed.push({name:manifest.batches[index],reason:result.reason});
 });
 return {products,failed};
}
async function load(){
 $('year').textContent=new Date().getFullYear();
 const manifestUrl='/shop/products-manifest.json';
 let cachedManifest=null,cachedProducts=[];
 // 1) Render every usable cached batch immediately; one damaged cache entry must not block the others.
 try{
  if('caches' in window){
   const cache=await caches.open(CACHE_NAME),hit=await cache.match(cacheKey(manifestUrl));
   if(hit){cachedManifest=await hit.json();if(Array.isArray(cachedManifest.batches)){
    const chunks=await Promise.allSettled(cachedManifest.batches.map(async name=>{
     const url='/shop/'+encodeURIComponent(name)+'?v='+encodeURIComponent(cachedManifest.updatedAt||'');
     const response=await cache.match(cacheKey(url));if(!response)return [];
     const data=await response.json();return Array.isArray(data.products)?data.products:[];
    }));
    cachedProducts=chunks.flatMap(result=>result.status==='fulfilled'?result.value:[]);
   }}
  }
 }catch(e){console.warn('Cached catalogue unavailable',e)}
 if(cachedProducts.length){paintCatalogue(cachedProducts,cachedManifest);$('status').textContent=products.length.toLocaleString()+' products · instant cached view';}
 else $('status').textContent='Loading products for the first visit…';
 // 2) Refresh in the background. Each successful batch is rendered as soon as it arrives.
 try{
  const manifest=await fetchJson(manifestUrl+'?check='+Date.now(),12000);
  const sameVersion=cachedManifest&&cachedManifest.updatedAt===manifest.updatedAt&&cachedProducts.length>0&&(!manifest.totalProducts||cachedProducts.length>=manifest.totalProducts);
  if(sameVersion){$('status').textContent=products.length.toLocaleString()+' products ready';return;}
  $('status').textContent=cachedProducts.length?'Checking for new products in background…':'Loading the first product batch…';
  const freshProducts=[];
  const result=await downloadCatalogue(manifest,(name,batch)=>{
   freshProducts.push(...batch);
   paintCatalogue(freshProducts,manifest);
   $('status').textContent=products.length.toLocaleString()+' products loaded · fetching remaining batches…';
  });
  if(!result.products.length)throw new Error('Every product batch failed to load');
  // Keep successful batches available even when another source file is temporarily unavailable.
  await saveCachedJson(manifestUrl,manifest);
  if(result.failed.length){
   $('status').textContent=products.length.toLocaleString()+' products loaded · '+result.failed.length+' batch(es) unavailable; refresh to retry';
   console.warn('Some shop batches failed',result.failed);
  }else{
   paintCatalogue(result.products,manifest);
   $('status').textContent=products.length.toLocaleString()+' products ready';
  }
 }catch(e){
  console.warn('Catalogue refresh failed; keeping any available products.',e);
  if(!products.length){showUnavailable('The product catalogue is temporarily unavailable. Please refresh shortly.');return;}
  $('status').textContent=products.length.toLocaleString()+' saved products · update will retry later';
 }
}
['q','category','sort'].forEach(id=>$(id).addEventListener(id==='q'?'input':'change',()=>{page=1;render()}));load().catch(e=>showUnavailable('The shop encountered an error: '+(e.message||'please refresh the page.')));
})();