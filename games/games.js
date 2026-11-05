(()=>{'use strict';
const $=s=>document.querySelector(s), canvas=$('#game-canvas'),ctx=canvas.getContext('2d'),panel=$('#player'),title=$('#player-title'),scoreEl=$('#score'),bestEl=$('#best'),message=$('#game-message'),instructions=$('#game-instructions');
let game='racer',running=false,paused=false,score=0,best=0,raf=0,last=0,keys={},state={};
const bestKey=id=>'um_arcade_best_'+id;
function setScore(n){score=Math.max(0,Math.floor(n));scoreEl.textContent=score.toLocaleString();if(score>best){best=score;bestEl.textContent=best.toLocaleString();try{localStorage.setItem(bestKey(game),best)}catch(e){}}}
function loadBest(){try{best=+(localStorage.getItem(bestKey(game))||0)}catch(e){best=0}bestEl.textContent=best.toLocaleString();setScore(0)}
function reset(){state={};if(game==='racer'){state.x=450;state.y=430;state.obstacles=[];state.t=0;state.speed=4;state.stripe=0}else if(game==='galaxy'){state.x=450;state.y=455;state.shots=[];state.enemies=[];state.spawn=0;state.cool=0;state.t=0}else{state.board=Array(16).fill(0);state.moves=0;state.over=false;addTile();addTile()}}
function start(){if(window.__umExtraGameActive)return;cancelAnimationFrame(raf);reset();setScore(0);running=true;paused=false;message.textContent='Good luck. Beat your best!';last=0;raf=requestAnimationFrame(loop);draw()}
function end(msg){running=false;cancelAnimationFrame(raf);message.textContent=msg+' Final score: '+score.toLocaleString()+'. Press START to try again.'}
function loop(ts){if(!running||paused)return;const dt=Math.min((ts-last||16)/16.67,2);last=ts;update(dt);draw();raf=requestAnimationFrame(loop)}
function update(d){if(game==='racer'){state.t+=d;state.speed=Math.min(10,4+state.t/450);state.stripe+=state.speed*d;if(keys.left||keys.ArrowLeft||keys.a||keys.A)state.x-=6*d;if(keys.right||keys.ArrowRight||keys.d||keys.D)state.x+=6*d;state.x=Math.max(280,Math.min(620,state.x));if(Math.random()<.025*d*state.speed)state.obstacles.push({x:300+Math.random()*300,y:-50,w:40,h:65});state.obstacles.forEach(o=>o.y+=state.speed*1.6*d);state.obstacles=state.obstacles.filter(o=>o.y<560);for(const o of state.obstacles){if(Math.abs(o.x-state.x)<40&&Math.abs(o.y-state.y)<55){end('CRASH!');break}}setScore(score+state.speed*d*.55)}
if(game==='galaxy'){state.t+=d;if(keys.left||keys.ArrowLeft||keys.a||keys.A)state.x-=7*d;if(keys.right||keys.ArrowRight||keys.d||keys.D)state.x+=7*d;state.x=Math.max(28,Math.min(872,state.x));state.cool-=d;if((keys.up||keys.ArrowUp||keys[' '])&&state.cool<=0){state.shots.push({x:state.x,y:state.y-22});state.cool=12}state.shots.forEach(s=>s.y-=10*d);state.shots=state.shots.filter(s=>s.y>-10);state.spawn-=d;if(state.spawn<=0){state.enemies.push({x:30+Math.random()*840,y:-20,r:14+Math.random()*7,v:1.5+Math.random()*1.7});state.spawn=Math.max(17,55-score/100)}state.enemies.forEach(e=>e.y+=e.v*d);for(const e of state.enemies){if(Math.hypot(e.x-state.x,e.y-state.y)<25){end('SHIP DESTROYED');break}for(const s of state.shots){if(Math.hypot(e.x-s.x,e.y-s.y)<e.r+5){e.dead=true;s.dead=true;setScore(score+100)}}}state.shots=state.shots.filter(s=>!s.dead);state.enemies=state.enemies.filter(e=>!e.dead&&e.y<550);setScore(score+0.1*d)}
}
function draw(){ctx.clearRect(0,0,900,520);if(game==='racer')drawRacer();if(game==='galaxy')drawGalaxy();if(game==='mind')drawMind()}
function drawRacer(){
 const g=ctx.createLinearGradient(0,0,0,520);g.addColorStop(0,'#102b43');g.addColorStop(.55,'#071426');g.addColorStop(1,'#0b1b2c');ctx.fillStyle=g;ctx.fillRect(0,0,900,520);
 ctx.fillStyle='#173b4b';ctx.fillRect(0,0,220,520);ctx.fillRect(680,0,220,520);
 for(let i=0;i<18;i++){let y=(i*47+state.stripe*2)%560-30;ctx.fillStyle=i%2?'#275364':'#1c4655';ctx.fillRect(38,y,4,20);ctx.fillRect(858,y,4,20)}
 ctx.fillStyle='#1c2a39';ctx.beginPath();ctx.moveTo(300,0);ctx.lineTo(600,0);ctx.lineTo(760,520);ctx.lineTo(140,520);ctx.fill();
 ctx.strokeStyle='#c6ff4d';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(300,0);ctx.lineTo(140,520);ctx.moveTo(600,0);ctx.lineTo(760,520);ctx.stroke();
 ctx.strokeStyle='#dce9f4';ctx.lineWidth=5;ctx.setLineDash([30,28]);ctx.lineDashOffset=-state.stripe;ctx.beginPath();ctx.moveTo(450,0);ctx.lineTo(450,520);ctx.stroke();ctx.setLineDash([]);
 state.obstacles.forEach(o=>car(o.x,o.y,'#f05268'));car(state.x,state.y,'#c6ff4d');
 ctx.fillStyle='#dceaf5';ctx.font='800 15px Inter';ctx.fillText('DISTANCE  '+Math.floor(score),24,36);
 ctx.fillStyle='#c6ff4d';ctx.fillRect(24,49,Math.min(190,score/5),4);
}
function car(x,y,color){
 ctx.save();ctx.shadowColor=color;ctx.shadowBlur=18;ctx.fillStyle='#030912';ctx.beginPath();ctx.ellipse(x,y+27,27,8,0,0,Math.PI*2);ctx.fill();
 const grad=ctx.createLinearGradient(x-20,y,x+20,y);grad.addColorStop(0,color);grad.addColorStop(.5,'#f4fbff');grad.addColorStop(1,color);ctx.fillStyle=grad;
 ctx.beginPath();ctx.moveTo(x-19,y+25);ctx.lineTo(x-17,y-23);ctx.quadraticCurveTo(x,y-43,x+17,y-23);ctx.lineTo(x+19,y+25);ctx.quadraticCurveTo(x,y+34,x-19,y+25);ctx.fill();
 ctx.shadowBlur=0;ctx.fillStyle='#102b43';ctx.beginPath();ctx.moveTo(x-12,y-12);ctx.quadraticCurveTo(x,y-28,x+12,y-12);ctx.lineTo(x+10,y+5);ctx.lineTo(x-10,y+5);ctx.fill();
 ctx.fillStyle='#fff';ctx.fillRect(x-14,y+18,7,5);ctx.fillRect(x+7,y+18,7,5);ctx.restore();
}
function drawGalaxy(){
 const g=ctx.createLinearGradient(0,0,0,520);g.addColorStop(0,'#05091c');g.addColorStop(1,'#14234a');ctx.fillStyle=g;ctx.fillRect(0,0,900,520);
 for(let i=0;i<125;i++){let x=(i*127+Math.floor(state.t*(i%3+1)))%900,y=(i*71+Math.floor(state.t*(i%4+1)*1.5))%520;ctx.fillStyle=i%7?'#7899c8':'#c6ff4d';ctx.globalAlpha=.35+(i%5)*.13;ctx.fillRect(x,y,i%7?2:3,i%7?2:3)}ctx.globalAlpha=1;
 ctx.strokeStyle='#45d9ff22';ctx.lineWidth=1;for(let i=0;i<6;i++){ctx.beginPath();ctx.arc(450,240,70+i*48+Math.sin(state.t/20+i)*5,0,Math.PI*2);ctx.stroke()}
 ctx.fillStyle='#45d9ff';ctx.shadowColor='#45d9ff';ctx.shadowBlur=16;state.shots.forEach(s=>{ctx.fillRect(s.x-3,s.y-11,6,20);ctx.fillRect(s.x-7,s.y-5,14,4)});ctx.shadowBlur=0;
 state.enemies.forEach(e=>{ctx.save();ctx.translate(e.x,e.y);ctx.shadowColor='#ff557d';ctx.shadowBlur=16;ctx.fillStyle='#ed5a78';ctx.beginPath();ctx.moveTo(0,-e.r);ctx.lineTo(e.r,0);ctx.lineTo(0,e.r);ctx.lineTo(-e.r,0);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#43172f';ctx.fillRect(-7,-3,4,5);ctx.fillRect(3,-3,4,5);ctx.restore()});
 ctx.fillStyle='#c6ff4d';ctx.shadowColor='#45d9ff';ctx.shadowBlur=22;ctx.beginPath();ctx.moveTo(state.x,state.y-24);ctx.lineTo(state.x-21,state.y+19);ctx.lineTo(state.x,state.y+10);ctx.lineTo(state.x+21,state.y+19);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
 ctx.fillStyle='#dceaff';ctx.font='800 15px Inter';ctx.fillText('DEFEND THE GALAXY',22,32);
}
function addTile(){let empty=state.board.map((v,i)=>v?null:i).filter(v=>v!==null);if(empty.length)state.board[empty[Math.floor(Math.random()*empty.length)]]=Math.random()<.88?2:4}
function drawMind(){
 const bg=ctx.createLinearGradient(0,0,900,520);bg.addColorStop(0,'#10172d');bg.addColorStop(1,'#22204a');ctx.fillStyle=bg;ctx.fillRect(0,0,900,520);
 ctx.fillStyle='#f1f5fb';ctx.font='800 24px Inter';ctx.fillText('MIND GRID  ·  MERGE MATCHING NUMBERS',28,48);
 ctx.fillStyle='#9fb0c7';ctx.font='15px Inter';ctx.fillText('Use arrows or swipe. Merge matching tiles and reach 2048.',28,78);
 const size=92,gap=12,left=286,top=110;state.board.forEach((v,i)=>{let x=left+(i%4)*(size+gap),y=top+Math.floor(i/4)*(size+gap);
 ctx.fillStyle='#0a1023';ctx.beginPath();ctx.roundRect(x-2,y+4,size+4,size+4,12);ctx.fill();
 const colors=['#253a5a','#3f5f8d','#5d6f9e','#8b6e9f','#bd8857','#d4ae4b','#b8d45a'];let level=v?Math.min(6,Math.floor(Math.log2(v))-1):0;
 const tile=ctx.createLinearGradient(x,y,x+size,y+size);tile.addColorStop(0,v?colors[level]:'#1a2942');tile.addColorStop(1,v?'#172b45':'#101c31');ctx.fillStyle=tile;ctx.beginPath();ctx.roundRect(x,y,size,size,10);ctx.fill();
 if(v){ctx.strokeStyle='#ffffff22';ctx.strokeRect(x+5,y+5,size-10,size-10);ctx.fillStyle=v>=512?'#0c1e34':'#fff';ctx.font='800 '+(v>999?22:30)+'px Inter';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(v,x+size/2,y+size/2);ctx.textAlign='left';ctx.textBaseline='alphabetic'}
 });
 ctx.fillStyle='#c6ff4d';ctx.font='800 16px Inter';ctx.fillText('MOVES  '+state.moves,28,480);ctx.fillStyle='#9fb0c7';ctx.fillText('TARGET  2048',28,505);
 if(state.over){ctx.fillStyle='#071426dd';ctx.fillRect(0,0,900,520);ctx.fillStyle='white';ctx.font='800 38px Inter';ctx.textAlign='center';ctx.fillText('NO MORE MOVES',450,260);ctx.textAlign='left'}
}
function slide(dir){if(game!=='mind'||!running||paused||state.over)return;let b=state.board.slice(),changed=false;for(let n=0;n<4;n++){let ids=dir==='left'||dir==='right'?[0,1,2,3].map(c=>n*4+(dir==='left'?c:3-c)):[0,1,2,3].map(r=>(dir==='up'?r:3-r)*4+n);let vals=ids.map(i=>b[i]).filter(Boolean),out=[];for(let j=0;j<vals.length;j++){if(vals[j]===vals[j+1]){out.push(vals[j]*2);setScore(score+vals[j]*2);j++}else out.push(vals[j])}while(out.length<4)out.push(0);ids.forEach((id,k)=>{if(b[id]!==out[k])changed=true;b[id]=out[k]})}if(changed){state.board=b;state.moves++;addTile();if(!state.board.includes(0)&&!canMove()){state.over=true;end('GRID LOCKED')}else if(state.board.includes(2048))end('2048 REACHED')} }
function canMove(){for(let r=0;r<4;r++)for(let c=0;c<4;c++){let v=state.board[r*4+c];if(!v||c<3&&v===state.board[r*4+c+1]||r<3&&v===state.board[(r+1)*4+c])return true}return false}
document.querySelectorAll('[data-game]').forEach(btn=>btn.addEventListener('click',()=>{window.__umExtraGameActive=false;game=btn.dataset.game;panel.hidden=false;title.textContent=game==='racer'?'NEON RACER':game==='galaxy'?'GALAXY DEFENDER':'MIND GRID';instructions.textContent=game==='racer'?'Steer with ← → or A / D. Avoid traffic.':game==='galaxy'?'Move with ← → and fire with ↑ or SPACE.':'Use arrow keys or swipe to merge equal tiles.';panel.scrollIntoView({behavior:'smooth',block:'start'});loadBest();start()}));
$('#close-game').addEventListener('click',()=>{running=false;cancelAnimationFrame(raf);panel.hidden=true;document.querySelector('#game-library').scrollIntoView({behavior:'smooth'})});
$('#start-game').addEventListener('click',start);$('#pause-game').addEventListener('click',()=>{if(window.__umExtraGameActive||!running)return;paused=!paused;if(paused){cancelAnimationFrame(raf);message.textContent='Paused. Press PAUSE to resume.'}else{last=0;message.textContent='Back in action!';raf=requestAnimationFrame(loop)}});
window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault();keys[e.key]=true;keys[e.key.toLowerCase()]=true;if(game==='mind'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))slide(({ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'})[e.key])});
window.addEventListener('keyup',e=>{keys[e.key]=false;keys[e.key.toLowerCase()]=false});
document.querySelectorAll('[data-key]').forEach(b=>{const k=b.dataset.key;b.addEventListener('pointerdown',e=>{e.preventDefault();keys[k]=true;if(game==='mind')slide(k)});['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,()=>keys[k]=false))});
let touchX=0,touchY=0;canvas.addEventListener('touchstart',e=>{touchX=e.touches[0].clientX;touchY=e.touches[0].clientY},{passive:true});canvas.addEventListener('touchend',e=>{if(game!=='mind')return;let dx=e.changedTouches[0].clientX-touchX,dy=e.changedTouches[0].clientY-touchY;if(Math.max(Math.abs(dx),Math.abs(dy))>25)slide(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up')},{passive:true});
$('#year').textContent=new Date().getFullYear();loadBest();
})();