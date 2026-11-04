(function(){
'use strict';
const params=new URLSearchParams(location.search),id=params.get('id')||'';
const status=document.getElementById('watchStatus'),content=document.getElementById('watchContent');
const player=document.getElementById('cinemaPlayer');
const adTags=[
'https://expensive-pollution.com/dcm/F.zGdhGaNAvjZIGiUn/Xe/m/9Ou/ZYUYlNksPoTac/1-OcT/Mx1WMmjyEYteNTz/UV5VMPzCUzy/NlSrZIsLa/Wt1Ap/d/DI0rxG',
'https://expensive-pollution.com/dNmgFazLd.GdNnvTZKGKUH/Teemt9Cu/Z_U_l/kWPATScW1/O/TnM/1LM/jEEPtnNKzsUy5IM/zAUkyZNSQY'
];
let adStarted=false,adManager=null,adTimer=null,loaderPromise=null;
document.getElementById('year').textContent=new Date().getFullYear();
function loadIma(){
 if(window.google&&window.google.ima)return Promise.resolve();
 if(loaderPromise)return loaderPromise;
 loaderPromise=new Promise((resolve,reject)=>{
  const s=document.createElement('script');s.src='https://imasdk.googleapis.com/js/sdkloader/ima3.js';s.async=true;
  s.onload=()=>window.google&&window.google.ima?resolve():reject(new Error('IMA unavailable'));
  s.onerror=reject;document.head.appendChild(s);
 });
 return loaderPromise;
}
function playContent(){
 if(adTimer)clearTimeout(adTimer);adTimer=null;
 if(adManager){try{adManager.destroy();}catch(_){}adManager=null;}
 player.play().catch(()=>{});
}
function startHilltopPreroll(){
 if(adStarted)return;adStarted=true;player.pause();
 const shell=player.parentElement;
 let overlay=shell.querySelector('.cinema-ima-overlay');
 if(!overlay){overlay=document.createElement('div');overlay.className='cinema-ima-overlay';overlay.style.cssText='position:absolute;inset:0;z-index:5;display:none;background:#000';shell.style.position='relative';shell.appendChild(overlay);}
 const fallback=()=>{overlay.style.display='none';playContent();};
 loadIma().then(()=>{
  const ima=window.google.ima;
  let display,loader,index=0,settled=false;
  try{display=new ima.AdDisplayContainer(overlay,player);display.initialize();loader=new ima.AdsLoader(display);}catch(_){fallback();return;}
  const requestNext=()=>{
   if(index>=adTags.length){try{loader.destroy();}catch(_){}fallback();return;}
   settled=false;overlay.style.display='block';
   if(adTimer)clearTimeout(adTimer);
   adTimer=setTimeout(()=>finish(true),9000);
   try{
    const req=new ima.AdsRequest();req.adTagUrl=adTags[index++];
    const w=Math.max(1,shell.clientWidth||640),h=Math.max(1,Math.round(w*9/16));
    req.linearAdSlotWidth=w;req.linearAdSlotHeight=h;req.nonLinearAdSlotWidth=w;req.nonLinearAdSlotHeight=Math.round(h/3);
    loader.requestAds(req);
   }catch(_){finish(true);}
  };
  function finish(tryNext){
   if(settled)return;settled=true;if(adTimer)clearTimeout(adTimer);adTimer=null;
   if(adManager){try{adManager.destroy();}catch(_){}adManager=null;}
   if(tryNext)requestNext();else fallback();
  }
  loader.addEventListener(ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,e=>{
   if(settled)return;
   try{
    adManager=e.getAdsManager(player);
    adManager.addEventListener(ima.AdErrorEvent.Type.AD_ERROR,()=>finish(true));
    adManager.addEventListener(ima.AdEvent.Type.CONTENT_RESUME_REQUESTED,()=>finish(false));
    adManager.addEventListener(ima.AdEvent.Type.ALL_ADS_COMPLETED,()=>finish(false));
    adManager.init(Math.max(1,shell.clientWidth||640),Math.max(1,Math.round((shell.clientWidth||640)*9/16)),ima.ViewMode.NORMAL);
    adManager.start();
   }catch(_){finish(true);}
  });
  loader.addEventListener(ima.AdErrorEvent.Type.AD_ERROR,()=>finish(true));
  requestNext();
 }).catch(fallback);
}
player.addEventListener('play',()=>{if(!adStarted)startHilltopPreroll();});
if(!/^[a-z0-9][a-z0-9-]{1,79}$/i.test(id)){status.textContent='Invalid title address.';return;}
fetch('/api/cinema/catalog?id='+encodeURIComponent(id),{headers:{accept:'application/json'}})
.then(r=>{if(!r.ok)throw new Error('This title is not available.');return r.json();})
.then(({item})=>{
 if(!item||!item.playbackUrl)throw new Error('This title has no approved playback source.');
 document.title=item.title+' | USAMARKET CINEMA';
 document.getElementById('watchTitle').textContent=item.title;
 document.getElementById('watchCategory').textContent=item.category;
 document.getElementById('watchMeta').textContent=[item.year,item.duration].filter(Boolean).join(' · ');
 document.getElementById('watchDescription').textContent=item.description||'';
 document.getElementById('watchLicense').textContent='Licence: '+item.license;
 document.getElementById('watchEvidence').href=item.rightsEvidence;
 player.poster=item.poster||'';player.src=item.playbackUrl;
 status.hidden=true;content.hidden=false;
}).catch(e=>{status.textContent=e.message||'Unable to load this title.';});
})();