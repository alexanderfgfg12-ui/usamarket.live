(()=>{'use strict';
const $=s=>document.querySelector(s),canvas=$('#game-canvas'),ctx=canvas.getContext('2d'),panel=$('#player'),title=$('#player-title'),scoreEl=$('#score'),bestEl=$('#best'),message=$('#game-message'),hint=$('#game-instructions');
const names={snake:'PULSE SNAKE',breakout:'BRICKSTORM',stack:'STACK SHIFT',memory:'MEMORY MATRIX',lander:'LUNAR LANDER',portal:'PORTAL DASH'};
const help={snake:'Arrow keys or swipe to steer. Avoid walls and your own trail.',breakout:'← → or A / D to move the paddle. Keep the ball alive.',stack:'Press SPACE, tap or click to drop each moving platform.',memory:'Tap or click two tiles to find matching symbols.',lander:'← → to steer. Hold ↑ or SPACE to fire the landing engine.',portal:'SPACE, ↑ or tap to jump over the barriers.'};
let id='',active=false,pause=false,score=0,best=0,frame=0,last=0,keys={},s={};
const storeKey=k=>'um_arcade_best_'+k;
function scoreTo(n){score=Math.max(0,Math.floor(n));scoreEl.textContent=score.toLocaleString();if(score>best){best=score;bestEl.textContent=best.toLocaleString();try{localStorage.setItem(storeKey(id),best)}catch(e){}}}
function food(){return{x:1+Math.floor(Math.random()*28),y:1+Math.floor(Math.random()*18)}}
function reset(){
 s={t:0};
 if(id==='snake')Object.assign(s,{body:[{x:9,y:9},{x:8,y:9},{x:7,y:9}],dir:{x:1,y:0},next:{x:1,y:0},food:food(),tick:0});
 if(id==='breakout'){s.paddle=450;s.ball={x:450,y:430,vx:3.2,vy:-4.2};s.bricks=[];for(let r=0;r<5;r++)for(let c=0;c<10;c++)s.bricks.push({x:105+c*70,y:75+r*27,w:61,h:17,on:true,row:r});s.lives=3}
 if(id==='stack')Object.assign(s,{blocks:[{x:330,w:240,y:440}],x:80,w:240,dir:1,speed:3.2,level:1});
 if(id==='memory'){let a=['✦','◆','●','▲','☼','⬟','♥','✚'];s.tiles=[...a,...a].sort(()=>Math.random()-.5);s.open=[];s.done=[];s.moves=0;s.wait=0}
 if(id==='lander')Object.assign(s,{x:180,y:110,vx:0,vy:0,fuel:100,landed:false});
 if(id==='portal')Object.assign(s,{y:420,vy:0,ground:true,obs:[],spawn:30,speed:5});
}
function stop(msg){active=false;cancelAnimationFrame(frame);message.textContent=msg+' Score: '+score+'. Press START to try again.'}
function start(){cancelAnimationFrame(frame);reset();scoreTo(0);active=true;pause=false;last=0;message.textContent='Good luck!';frame=requestAnimationFrame(loop);draw()}
function loop(t){if(!active||pause)return;let d=Math.min((t-last||16)/16.67,2);last=t;update(d);draw();if(active)frame=requestAnimationFrame(loop)}
function update(d){s.t+=d;
 if(id==='snake'){s.tick+=d;if(s.tick>5.5){s.tick=0;s.dir=s.next;let h={x:s.body[0].x+s.dir.x,y:s.body[0].y+s.dir.y};if(h.x<0||h.x>=30||h.y<0||h.y>=20||s.body.some(p=>p.x===h.x&&p.y===h.y)){stop('TRAIL COLLISION');return}s.body.unshift(h);if(h.x===s.food.x&&h.y===s.food.y){scoreTo(score+10);s.food=food()}else s.body.pop()}}
 if(id==='breakout'){let b=s.ball;b.x+=b.vx*d;b.y+=b.vy*d;if(b.x<12||b.x>888)b.vx*=-1;if(b.y<12)b.vy=Math.abs(b.vy);if(keys.left||keys.ArrowLeft||keys.a)s.paddle-=8*d;if(keys.right||keys.ArrowRight||keys.d)s.paddle+=8*d;s.paddle=Math.max(60,Math.min(840,s.paddle));if(b.vy>0&&b.y>455&&b.y<474&&Math.abs(b.x-s.paddle)<65){b.vy=-Math.abs(b.vy);b.vx+=(b.x-s.paddle)*.035}for(let q of s.bricks)if(q.on&&b.x>q.x&&b.x<q.x+q.w&&b.y>q.y&&b.y<q.y+q.h){q.on=false;b.vy*=-1;scoreTo(score+10);break}if(b.y>525){s.lives--;if(s.lives<=0)stop('CORE LOST');else{b.x=450;b.y=430;b.vx=(Math.random()-.5)*4+2;b.vy=-4;message.textContent='Ball recovered — '+s.lives+' lives left.'}}if(!s.bricks.some(q=>q.on))stop('ALL BLOCKS CLEARED')}
 if(id==='stack'){s.x+=s.dir*s.speed*d;if(s.x<80||s.x+s.w>820)s.dir*=-1}
 if(id==='memory'&&s.wait>0){s.wait-=d;if(s.wait<=0)s.open=[]}
 if(id==='lander'&&!s.landed){let thrust=keys.up||keys.ArrowUp||keys[' '];if(thrust&&s.fuel>0){s.vy-=.13*d;s.fuel-=.22*d}if(keys.left||keys.ArrowLeft)s.vx-=.06*d;if(keys.right||keys.ArrowRight)s.vx+=.06*d;s.vy+=.055*d;s.vx*=.995;s.x+=s.vx*d;s.y+=s.vy*d;if(s.x<20||s.x>880)s.vx*=-.7;if(s.y>455){if(s.x>365&&s.x<535&&s.vy<1.8&&Math.abs(s.vx)<1.5){s.landed=true;scoreTo(1000+Math.floor(s.fuel*5));stop('PERFECT LANDING!')}else stop('HARD LANDING')}}
 if(id==='portal'){if((keys.up||keys.ArrowUp||keys[' ']||keys.w)&&s.ground){s.vy=-11;s.ground=false} s.vy+=.55*d;s.y+=s.vy*d;if(s.y>=420){s.y=420;s.vy=0;s.ground=true}s.speed=Math.min(11,5+score/450);s.spawn-=d;if(s.spawn<=0){s.obs.push({x:930,w:25+Math.random()*20,h:35+Math.random()*48});s.spawn=48+Math.random()*38}s.obs.forEach(o=>o.x-=s.speed*d);s.obs=s.obs.filter(o=>o.x>-50);for(let o of s.obs)if(o.x<155&&o.x+o.w>110&&s.y>420-o.h+20)stop('GATE HIT');scoreTo(score+.3*d)}
}
function draw(){ctx.clearRect(0,0,900,520);ctx.fillStyle='#08172b';ctx.fillRect(0,0,900,520);({snake:drawSnake,breakout:drawBreakout,stack:drawStack,memory:drawMemory,lander:drawLander,portal:drawPortal}[id])()}
function label(t,x,y,size=18,color='#d9e7f5'){ctx.fillStyle=color;ctx.font='bold '+size+'px Inter,Arial';ctx.fillText(t,x,y)}
function drawSnake(){
 const bg=ctx.createLinearGradient(0,30,0,490);bg.addColorStop(0,'#0b2639');bg.addColorStop(1,'#102e3e');ctx.fillStyle=bg;ctx.fillRect(40,30,820,460);
 ctx.strokeStyle='#24475b';ctx.lineWidth=1;for(let x=40;x<=860;x+=27){ctx.beginPath();ctx.moveTo(x,30);ctx.lineTo(x,490);ctx.stroke()}for(let y=30;y<=490;y+=23){ctx.beginPath();ctx.moveTo(40,y);ctx.lineTo(860,y);ctx.stroke()}
 ctx.shadowColor='#ffca63';ctx.shadowBlur=20;ctx.fillStyle='#ffca63';ctx.beginPath();ctx.arc(40+s.food.x*27+13,30+s.food.y*23+11,9,0,7);ctx.fill();ctx.shadowBlur=0;
 s.body.forEach((p,i)=>{ctx.fillStyle=i?'#32a99c':'#c6ff4d';ctx.shadowColor=i?'#32a99c':'#c6ff4d';ctx.shadowBlur=i?7:16;ctx.beginPath();ctx.roundRect(42+p.x*27,32+p.y*23,23,19,6);ctx.fill()});ctx.shadowBlur=0;label('ENERGY '+score,24,22,15,'#c6ff4d')
}
function drawBreakout(){
 const bg=ctx.createLinearGradient(0,40,0,470);bg.addColorStop(0,'#15264b');bg.addColorStop(1,'#08172b');ctx.fillStyle=bg;ctx.fillRect(0,40,900,430);
 s.bricks.forEach(b=>{if(b.on){ctx.fillStyle=['#ff6b75','#ffb454','#d8df65','#55c9b4','#6ba9ff'][b.row];ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=9;ctx.beginPath();ctx.roundRect(b.x,b.y,b.w,b.h,5);ctx.fill()}});
 ctx.shadowBlur=0;ctx.fillStyle='#c6ff4d';ctx.shadowColor='#c6ff4d';ctx.shadowBlur=18;ctx.beginPath();ctx.roundRect(s.paddle-58,465,116,13,7);ctx.fill();
 ctx.fillStyle='#fff';ctx.shadowColor='#45d9ff';ctx.shadowBlur=20;ctx.beginPath();ctx.arc(s.ball.x,s.ball.y,9,0,7);ctx.fill();ctx.shadowBlur=0;label('LIVES '+s.lives,25,35,15,'#c6ff4d')
}
function drop(){if(id!=='stack'||!active)return;let p=s.blocks[s.blocks.length-1],l=Math.max(p.x,s.x),r=Math.min(p.x+p.w,s.x+s.w),w=r-l;if(w<16){stop('TOWER COLLAPSED');return}s.blocks.push({x:l,w,y:440-s.blocks.length*34});s.w=w;s.level++;s.x=s.dir>0?80:820-w;s.speed+=.22;scoreTo(score+w);if(s.blocks.length>12)stop('TOWER MASTER!')}
function drawStack(){
 const bg=ctx.createLinearGradient(0,0,0,520);bg.addColorStop(0,'#102344');bg.addColorStop(1,'#071426');ctx.fillStyle=bg;ctx.fillRect(0,0,900,520);
 for(let i=0;i<12;i++){ctx.strokeStyle='#45d9ff16';ctx.beginPath();ctx.moveTo(i*90,0);ctx.lineTo(i*90,520);ctx.stroke()}
 ctx.fillStyle='#122943';ctx.fillRect(0,455,900,65);s.blocks.forEach((b,i)=>{ctx.fillStyle=['#42d9cf','#8b79ff','#ffb45f','#c6ff4d'][i%4];ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=12;ctx.beginPath();ctx.roundRect(b.x,b.y,b.w,31,5);ctx.fill()});
 ctx.fillStyle='#ff6b91';ctx.shadowColor='#ff6b91';ctx.shadowBlur=18;ctx.beginPath();ctx.roundRect(s.x,440-s.blocks.length*34,s.w,31,5);ctx.fill();ctx.shadowBlur=0;label('FLOOR '+s.level,25,35,16,'#c6ff4d');label('DROP: SPACE / TAP',25,65,14,'#9db3ca')
}
function drawMemory(){
 const bg=ctx.createLinearGradient(0,0,900,520);bg.addColorStop(0,'#111a3c');bg.addColorStop(1,'#291d50');ctx.fillStyle=bg;ctx.fillRect(0,0,900,520);
 let w=145,h=105,g=13,l=111,t=55;s.tiles.forEach((v,i)=>{let x=l+(i%4)*(w+g),y=t+Math.floor(i/4)*(h+g),show=s.open.includes(i)||s.done.includes(i);
 const grad=ctx.createLinearGradient(x,y,x+w,y+h);grad.addColorStop(0,show?'#476b91':'#283b67');grad.addColorStop(1,show?'#203b5b':'#111d3c');ctx.fillStyle=grad;ctx.shadowColor=show?'#c6ff4d':'#050a1a';ctx.shadowBlur=show?12:5;ctx.beginPath();ctx.roundRect(x,y,w,h,12);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle=show?'#c6ff4d66':'#ffffff18';ctx.stroke();label(show?v:'?',x+w/2-12,y+h/2+13,34,show?'#c6ff4d':'#8da6d0')});
 label('MOVES '+s.moves,25,505,16,'#c6ff4d')
}
function pick(x,y){if(id!=='memory'||!active||pause||s.wait>0)return;let c=Math.floor((x-111)/158),r=Math.floor((y-55)/118),i=r*4+c;if(c<0||c>3||r<0||r>3||s.done.includes(i)||s.open.includes(i))return;s.open.push(i);if(s.open.length===2){s.moves++;let [a,b]=s.open;if(s.tiles[a]===s.tiles[b]){s.done.push(a,b);s.open=[];scoreTo(score+100);if(s.done.length===16)stop('MATRIX CLEARED!')}else s.wait=38}}
function drawLander(){
 const bg=ctx.createLinearGradient(0,0,0,520);bg.addColorStop(0,'#111a36');bg.addColorStop(1,'#33334c');ctx.fillStyle=bg;ctx.fillRect(0,0,900,520);
 for(let i=0;i<90;i++){ctx.fillStyle='#a8bad4';ctx.globalAlpha=.25+(i%4)*.15;ctx.fillRect((i*131)%900,(i*79)%370,2,2)}ctx.globalAlpha=1;
 ctx.fillStyle='#c6ff4d';ctx.shadowColor='#c6ff4d';ctx.shadowBlur=18;ctx.beginPath();ctx.roundRect(365,462,170,7,4);ctx.fill();ctx.shadowBlur=0;
 ctx.save();ctx.translate(s.x,s.y);ctx.rotate(Math.max(-.45,Math.min(.45,s.vx*.08)));ctx.fillStyle='#d6e2ef';ctx.beginPath();ctx.moveTo(0,-22);ctx.lineTo(-17,15);ctx.lineTo(-10,20);ctx.lineTo(10,20);ctx.lineTo(17,15);ctx.closePath();ctx.fill();ctx.fillStyle='#4b7d9c';ctx.fillRect(-7,-5,14,11);
 if(keys.up||keys.ArrowUp||keys[' ']){ctx.fillStyle='#ffad54';ctx.shadowColor='#ffad54';ctx.shadowBlur=15;ctx.beginPath();ctx.moveTo(-7,18);ctx.lineTo(0,36+Math.random()*8);ctx.lineTo(7,18);ctx.fill()}ctx.restore();label('FUEL '+Math.floor(s.fuel)+'%',25,35,15,'#c6ff4d');label('LAND ON THE GREEN PAD',25,65,14,'#9fb0c7')
}
function drawPortal(){
 const bg=ctx.createLinearGradient(0,0,0,520);bg.addColorStop(0,'#101b42');bg.addColorStop(1,'#07364b');ctx.fillStyle=bg;ctx.fillRect(0,0,900,520);
 for(let i=0;i<12;i++){let x=(i*103-(s.t*2))%950;ctx.fillStyle='#45d9ff18';ctx.beginPath();ctx.arc(x,140+(i%4)*55,18+(i%3)*9,0,Math.PI*2);ctx.fill()}
 ctx.fillStyle='#122b40';ctx.fillRect(0,450,900,70);ctx.fillStyle='#c6ff4d';ctx.shadowColor='#c6ff4d';ctx.shadowBlur=15;ctx.fillRect(0,450,900,3);ctx.shadowBlur=0;
 ctx.fillStyle='#46d8ff';ctx.shadowColor='#46d8ff';ctx.shadowBlur=18;ctx.beginPath();ctx.roundRect(110,s.y-35,42,35,7);ctx.fill();ctx.shadowBlur=0;
 s.obs.forEach(o=>{ctx.fillStyle='#ff6a85';ctx.shadowColor='#ff6a85';ctx.shadowBlur=13;ctx.beginPath();ctx.roundRect(o.x,450-o.h,o.w,o.h,6);ctx.fill()});ctx.shadowBlur=0;label('DISTANCE '+Math.floor(score),25,35,15,'#c6ff4d')
}
function setDirection(k){let d=({ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1}})[k];if(d&&(d.x!==-s.dir.x||d.y!==-s.dir.y))s.next=d}
document.querySelectorAll('[data-extra-game]').forEach(b=>b.addEventListener('click',()=>{id=b.dataset.extraGame;window.__umExtraGameActive=true;panel.hidden=false;title.textContent=names[id];hint.textContent=help[id];panel.scrollIntoView({behavior:'smooth',block:'start'});try{best=+(localStorage.getItem(storeKey(id))||0)}catch(e){best=0}bestEl.textContent=best.toLocaleString();start()}));
window.addEventListener('keydown',e=>{if(!id||panel.hidden)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault();keys[e.key]=true;keys[e.key.toLowerCase()]=true;if(id==='snake')setDirection(e.key);if(id==='stack'&&(e.key===' '||e.key==='Enter'))drop()});
window.addEventListener('keyup',e=>{keys[e.key]=false;keys[e.key.toLowerCase()]=false});
canvas.addEventListener('click',e=>{if(!id||panel.hidden)return;let r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*900/r.width,y=(e.clientY-r.top)*520/r.height;if(id==='memory')pick(x,y);if(id==='stack')drop()});
let sx=0,sy=0;canvas.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY},{passive:true});canvas.addEventListener('touchend',e=>{if(!id||panel.hidden)return;let dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(id==='snake'&&Math.max(Math.abs(dx),Math.abs(dy))>20)setDirection(Math.abs(dx)>Math.abs(dy)?dx>0?'ArrowRight':'ArrowLeft':dy>0?'ArrowDown':'ArrowUp');if(id==='portal'&&s.ground){keys.up=true;setTimeout(()=>keys.up=false,100)}},{passive:true});
const oldStart=$('#start-game').onclick;$('#start-game').addEventListener('click',()=>{if(!panel.hidden&&id)start()});
$('#pause-game').addEventListener('click',()=>{if(!id||panel.hidden||!active)return;pause=!pause;if(pause){cancelAnimationFrame(frame);message.textContent='Paused. Press PAUSE to resume.'}else{last=0;frame=requestAnimationFrame(loop);message.textContent='Back in action!'}});
$('#close-game').addEventListener('click',()=>{active=false;cancelAnimationFrame(frame);id=''});
const originalButtons=document.querySelectorAll('[data-game]');originalButtons.forEach(b=>b.addEventListener('click',()=>{id='';active=false}));
$('#year').textContent=new Date().getFullYear();
})();