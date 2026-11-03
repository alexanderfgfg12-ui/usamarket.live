(function(){
'use strict';
const isArabic=document.documentElement.lang==='ar';
const toolbar=document.querySelector('.video-toolbar');
const cards=[...document.querySelectorAll('.video-card')];
function stopInline(wrapper){
 const original=wrapper._originalButton;
 if(original)wrapper.replaceWith(original);
}
function playInline(trigger){
 const id=trigger.dataset.videoId;
 const title=trigger.dataset.videoTitle||'US Market Live video';
 if(!id)return;
 const wrapper=document.createElement('div');
 wrapper.className='video-frame video-inline-player';
 wrapper.setAttribute('aria-label',title);
 const frame=document.createElement('iframe');
 frame.src='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id)+'?autoplay=1&rel=0'+(isArabic?'&cc_load_policy=1&cc_lang_pref=ar':'');
 frame.title=title;
 frame.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
 frame.referrerPolicy='strict-origin-when-cross-origin';
 frame.allowFullscreen=true;
 const close=document.createElement('button');
 close.type='button';close.className='video-inline-close';close.textContent=isArabic?'إيقاف الفيديو':'Stop video';
 close.setAttribute('aria-label',isArabic?'إيقاف الفيديو':'Stop video');
 wrapper.append(frame,close);
 wrapper._originalButton=trigger.cloneNode(true);
 trigger.replaceWith(wrapper);
}
document.addEventListener('click',event=>{
 const stop=event.target.closest('.video-inline-close');
 if(stop){stopInline(stop.closest('.video-inline-player'));return;}
 const trigger=event.target.closest('[data-video-id]');
 if(trigger){event.preventDefault();playInline(trigger);}
});
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