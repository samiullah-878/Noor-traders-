// One delegated handler covers main screens and dynamically created account pickers.
export function installSearchFocus(){
 let active=null,frame=0,timers=[];
 const viewport=()=>window.visualViewport;
 function cancel(){cancelAnimationFrame(frame);frame=0;timers.forEach(clearTimeout);timers=[];}
 function align(){
  frame=0;const input=active;
  if(!input?.isConnected||document.activeElement!==input)return;
  const vv=viewport(),offset=vv?.offsetTop||0,height=vv?.height||window.innerHeight;
  const dialog=input.closest('dialog');
  if(dialog){
   dialog.classList.add('search-dialog');
   dialog.style.setProperty('--search-viewport-top',offset+8+'px');
   dialog.style.setProperty('--search-viewport-height',Math.max(150,height-16)+'px');
   const body=input.closest('#dialogBody');
   if(body){const top=input.closest('label')||input;body.scrollTop+=top.getBoundingClientRect().top-body.getBoundingClientRect().top-8;}
  }else{
   const room=input.closest('.workspace');
   if(room){const top=input.getBoundingClientRect().top-room.getBoundingClientRect().top;room.classList.add('search-room');room.style.setProperty('--search-room-height',Math.ceil(top+height+24)+'px');}
   const top=input.closest('.toolbar')||input.closest('label')||input;
   const delta=top.getBoundingClientRect().top-offset-8;
   if(Math.abs(delta)>2)window.scrollTo(window.scrollX,Math.max(0,window.scrollY+delta));
  }
 }
 function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(align);}
 function start(input){cancel();active=input;schedule();for(const ms of [180,420])timers.push(setTimeout(schedule,ms));}
 document.addEventListener('focusin',e=>{if(e.target.matches?.('input[type="search"]'))start(e.target);else{cancel();active=null}});
 document.addEventListener('focusout',e=>{if(e.target===active){cancel();active=null}});
 document.addEventListener('input',e=>{if(e.target===active)schedule()});
 viewport()?.addEventListener('resize',schedule);window.addEventListener('resize',schedule);
 // Do not drag the user back up while they are deliberately scrolling results.
 document.addEventListener('touchmove',cancel,{passive:true});
 document.addEventListener('wheel',cancel,{passive:true});
 function reset(){cancel();active=null;document.querySelectorAll('.search-room').forEach(el=>{el.classList.remove('search-room');el.style.removeProperty('--search-room-height')});document.querySelectorAll('.search-dialog').forEach(el=>{el.classList.remove('search-dialog');el.style.removeProperty('--search-viewport-top');el.style.removeProperty('--search-viewport-height')});}
 document.addEventListener('close',reset,true);
 return {reset};
}
