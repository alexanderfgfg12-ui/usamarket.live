(function(){
'use strict';
const cards=[...document.querySelectorAll('.video-card')];
const toolbar=document.querySelector('.video-toolbar');
const dialog=document.querySelector('[data-video-dialog]');
const player=document.querySelector('[data-video-player]');
const caption=document.querySelector('[data-video-caption]');
const closeButton=document.querySelector('[data-video-close]');
const isArabic=document.documentElement.lang==='ar';
function closePlayer(){if(player)player.innerHTML='';if(dialog?.open)dialog.close();}
function openPlayer(id,title){
 if(!dialog||!player)return;
 const frame=document.createElement('iframe');
 frame.src='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id)+'?autoplay=1&rel=0'+(isArabic?'&cc_load_policy=1&cc_lang_pref=ar':'');
 frame.title=title||'US Market Live video';
 frame.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
 frame.referrerPolicy='strict-origin-when-cross-origin';
 frame.allowFullscreen=true;
 player.replaceChildren(frame);
 if(caption)caption.textContent=title||'';
 if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
}
document.addEventListener('click',event=>{
 const trigger=event.target.closest('[data-video-id]');
 if(trigger){event.preventDefault();openPlayer(trigger.dataset.videoId,trigger.dataset.videoTitle);return;}
 if(event.target.closest('[data-video-close]'))closePlayer();
});
dialog?.addEventListener('click',event=>{if(event.target===dialog)closePlayer();});
dialog?.addEventListener('close',()=>{if(player)player.innerHTML='';});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&dialog?.open)closePlayer();});
const input=toolbar?.querySelector('[data-video-search]');
const buttons=[...(toolbar?.querySelectorAll('[data-video-filter]')||[])];
let category='all';
cards.forEach(card=>{const t=card.innerText.toLowerCase();card.dataset.category=/stock|invest|share|أسهم|استثمار/.test(t)?'investing':/monetary|fed|policy|نقدية|فيدرالي/.test(t)?'economy':'all';});
function apply(){
 const q=(input?.value||'').trim().toLowerCase();let shown=0;
 cards.forEach(card=>{const ok=(!q||card.innerText.toLowerCase().includes(q))&&(category==='all'||card.dataset.category===category);card.hidden=!ok;if(ok)shown++;});
 let empty=document.querySelector('.video-empty');
 if(!shown&&!empty){empty=document.createElement('div');empty.className='video-empty';empty.textContent=isArabic?'لا توجد فيديوهات تطابق البحث.':'No videos match your search.';document.querySelector('.video-grid')?.append(empty);}
 if(shown&&empty)empty.remove();
}
input?.addEventListener('input',apply);
buttons.forEach(btn=>btn.addEventListener('click',()=>{category=btn.dataset.videoFilter;buttons.forEach(b=>b.classList.toggle('active',b===btn));apply();}));
apply();
})();