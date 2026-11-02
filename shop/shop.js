(()=>{'use strict';
const $=id=>document.getElementById(id);let products=[],page=1;const PAGE_SIZE=24;
const safeUrl=value=>{try{const u=new URL(value,location.origin);return ['https:','http:'].includes(u.protocol)?u.href:''}catch{return ''}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=(v,c='USD')=>{if(v===null||v===undefined||v==='')return '';const n=Number(v);if(!Number.isFinite(n))return '';try{return new Intl.NumberFormat(undefined,{style:'currency',currency:c}).format(n)}catch{return n.toFixed(2)+' '+c}};
function hashId(value){let h=2166136261;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0').slice(0,8)}
function card(p){const link=safeUrl(p.affiliateUrl),img=safeUrl(p.image),detail='/shop/product.html?id='+encodeURIComponent(p.id||p.affiliateUrl);return '<article class="product"><a class="photo" href="'+esc(detail)+'" aria-label="View '+esc(p.title)+' details">'+(img?'<img loading="lazy" decoding="async" src="'+esc(img)+'" alt="'+esc(p.title)+'">':'<span class="no-photo">Image coming soon</span>')+'</a><div class="pbody"><span class="source">'+esc(p.source||'Partner pick')+'</span><h2><a class="product-title-link" href="'+esc(detail)+'">'+esc(p.title)+'</a></h2>'+(p.description?'<p class="desc">'+esc(p.description.slice(0,115))+'</p>':'')+'<div class="price">'+money(p.price,p.currency||'USD')+(p.oldPrice?'<span class="old">'+money(p.oldPrice,p.currency||'USD')+'</span>':'')+'</div><a class="cta" href="'+esc(link)+'" target="_blank" rel="sponsored nofollow noopener">Shop this product <span aria-hidden="true">↗</span></a></div></article>'}
function render(){const q=$('q').value.trim().toLocaleLowerCase(),cat=$('category').value,sort=$('sort').value;let list=products.filter(p=>(!cat||p.category===cat)&&(!q||[p.title,p.description,p.brand,p.category,p.source].join(' ').toLocaleLowerCase().includes(q)));if(sort==='price-asc')list.sort((a,b)=>(a.price==null?Infinity:Number(a.price))-(b.price==null?Infinity:Number(b.price)));if(sort==='price-desc')list.sort((a,b)=>(b.price==null?-Infinity:Number(b.price))-(a.price==null?-Infinity:Number(a.price)));if(sort==='newest')list.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));$('count').textContent=list.length.toLocaleString()+' '+(list.length===1?'product':'products');if(!list.length){$('products').innerHTML='<div class="empty"><strong>No products found</strong><span>Try another search or choose a different category.</span></div>';$('pagination').innerHTML='';return}const groups=cat?[{name:cat,items:list}]:[...new Set(list.map(p=>p.category||'Featured'))].map(name=>({name,items:list.filter(p=>(p.category||'Featured')===name)})).sort((a,b)=>a.name.localeCompare(b.name));$('products').className='catalogues';$('products').innerHTML=groups.map((g,i)=>'<section class="catalogue" aria-label="'+esc(g.name)+'"><div class="catalogue-head"><div><span class="catalogue-kicker">US MARKET LIVE • COLLECTION</span><h2>'+esc(g.name)+'</h2><span class="catalogue-total">'+g.items.length.toLocaleString()+' products</span></div><div class="shelf-arrows"><button type="button" aria-label="Scroll '+esc(g.name)+' left" data-scroll="-1">‹</button><button type="button" aria-label="Scroll '+esc(g.name)+' right" data-scroll="1">›</button></div></div><div class="shelf" id="shelf-'+i+'">'+g.items.map(card).join('')+'</div></section>').join('');$('products').querySelectorAll('.catalogue').forEach(section=>section.querySelectorAll('[data-scroll]').forEach(btn=>btn.addEventListener('click',()=>section.querySelector('.shelf').scrollBy({left:Number(btn.dataset.scroll)*Math.min(760,section.querySelector('.shelf').clientWidth*.85),behavior:'smooth'}))));$('pagination').innerHTML='';}
function categories(){const select=$('category'),current=select.value;select.innerHTML='<option value="">All categories</option>';[...new Set(products.map(p=>p.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b)).forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;select.append(o)});select.value=current}
async function fetchJson(url,timeoutMs){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);try{const response=await fetch(url,{cache:'no-store',headers:{accept:'application/json'},signal:controller.signal});if(!response.ok)throw new Error('HTTP '+response.status);return await response.json()}finally{clearTimeout(timer)}}
function showUnavailable(message){$('count').textContent='No products available';$('status').textContent=message;$('products').innerHTML='<div class="empty"><strong>Products are not available yet</strong><span>'+esc(message)+'</span></div>';$('pagination').innerHTML=''}
async function load(){
 $('year').textContent=new Date().getFullYear();
 $('status').textContent='Loading the saved catalogue…';
 // Render the already-published catalogue first. The customer never waits for Admitad.
 let manifest;
 try{
  manifest=await fetchJson('/shop/products-manifest.json?v=1',12000);
  if(Array.isArray(manifest.batches)&&manifest.batches.length){
   const loaded=[];
   const chunkSize=6;
   for(let offset=0;offset<manifest.batches.length;offset+=chunkSize){
    const names=manifest.batches.slice(offset,offset+chunkSize);
    const chunks=await Promise.all(names.map(async name=>{
     const batch=await fetchJson('/shop/'+encodeURIComponent(name)+'?v='+encodeURIComponent(manifest.updatedAt||''),15000);
     if(!Array.isArray(batch.products))throw new Error('Invalid product batch '+name);
     return batch.products;
    }));
    loaded.push(...chunks.flat());
   }
   products=loaded;
  }else throw new Error('Catalogue manifest has no batches');
 }catch(e){
  console.warn('Saved catalogue unavailable; trying legacy catalogue.',e);
  try{const legacy=await fetchJson('/shop/products.json?v=3',12000);products=Array.isArray(legacy.products)?legacy.products:[];manifest=legacy;}
  catch(err){showUnavailable('The saved catalogue is temporarily unavailable. Please refresh shortly.');return;}
 }
 const unique=new Set();
 products=products.filter(p=>{if(!p||!p.title||!safeUrl(p.affiliateUrl))return false;const key=String(p.affiliateUrl).toLowerCase();if(unique.has(key))return false;unique.add(key);return true});
 if(!products.length){showUnavailable('The saved catalogue contains no valid products.');return}
 categories();render();
 $('updated').textContent=manifest.updatedAt?'Catalogue updated '+new Date(manifest.updatedAt).toLocaleDateString():'';
 $('status').textContent=products.length.toLocaleString()+' products ready';
 // Refresh only a small first page in the background; never block the shop on a feed refresh.
 refreshLiveInBackground();
}
async function refreshLiveInBackground(){
 try{
  const data=await fetchJson('/api/admitad/products?page=1&limit=100',12000);
  if(!data||!Array.isArray(data.products)||!data.products.length)return;
  const seen=new Set(products.map(p=>String(p.affiliateUrl||'').toLowerCase()));
  const additions=data.products.filter(p=>p&&p.title&&safeUrl(p.affiliateUrl)&&!seen.has(String(p.affiliateUrl).toLowerCase()));
  if(!additions.length)return;
  products=products.concat(additions);
  categories();render();
  $('status').textContent=products.length.toLocaleString()+' products available (catalogue + live updates)';
  $('updated').textContent='Live products checked '+new Date().toLocaleTimeString();
 }catch(e){console.warn('Background live refresh skipped; saved catalogue remains available.',e)}
}
['q','category','sort'].forEach(id=>$(id).addEventListener(id==='q'?'input':'change',()=>{page=1;render()}));load().catch(e=>showUnavailable('The shop encountered an error: '+(e.message||'please refresh the page.')));
})();