/* US Market Live — accessible back-to-top button */
(()=>{if(document.getElementById('um-back-to-top'))return;
const button=document.createElement('button');
button.id='um-back-to-top';button.type='button';button.className='';button.textContent='↑';
button.setAttribute('aria-label',document.documentElement.lang==='ar'?'العودة إلى أعلى الصفحة':'Back to top');
button.setAttribute('title',document.documentElement.lang==='ar'?'العودة إلى أعلى الصفحة':'Back to top');
button.addEventListener('click',()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));
document.body.appendChild(button);
let ticking=false;
const update=()=>{button.classList.toggle('is-visible',window.scrollY>320);ticking=false;};
window.addEventListener('scroll',()=>{if(!ticking){window.requestAnimationFrame(update);ticking=true;}},{passive:true});
update();
})();