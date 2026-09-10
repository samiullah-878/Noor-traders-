import {normalizeTasks,escapeHtml as e} from './task-model.js';

export function notificationKey(task) { return task.id+'::'+task.submissionId; }
export function submissionNotices(tasks) {
  return normalizeTasks(tasks).filter(t=>t.id&&t.submissionId&&t.photoIds.length).sort((a,b)=>b.submittedAt-a.submittedAt||a.id.localeCompare(b.id)).slice(0,100);
}
export function createNotificationFeed() {
  let baseline=false,known=new Set();
  return {
    update(tasks,fromCache=false){
      const notices=submissionNotices(tasks),keys=new Set(notices.map(notificationKey));let added=[];
      // Reopening the app restores the inbox without replaying old phone alarms.
      if(!fromCache){if(baseline)added=notices.filter(t=>!known.has(notificationKey(t)));known=keys;baseline=true}
      return {notices,added};
    },
    reset(){baseline=false;known=new Set()}
  };
}

export function installTaskNotifications({service,onOpen,document:doc=document}) {
  const win=doc.defaultView,nav=win.navigator,feed=createNotificationFeed();
  let session=null,epoch=0,unsub=null,seen=new Set(),notices=[],enabled=false,pendingOpen=null,toastTask='',lastFocus=null;
  const modal=doc.createElement('div');modal.id='ntNoticeDialog';modal.className='nt-tasks nt-dialog';modal.hidden=true;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','تصویری رپورٹ کی اطلاعات');doc.body.appendChild(modal);
  const toast=doc.createElement('div');toast.id='ntNoticeToast';toast.className='nt-tasks nt-notice-toast';toast.hidden=true;toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');doc.body.appendChild(toast);
  for(const target of [doc.getElementById('userBar'),doc.querySelector('#staffTasks .nt-toolbar')])if(target){const b=doc.createElement('button');b.type='button';b.className='nt-notice-bell';b.setAttribute('data-notice-open','');b.innerHTML='🔔 اطلاعات <span data-notice-count>0</span>';target.appendChild(b)}
  const preference=uid=>'nt-task-phone-alerts:'+uid;
  function unread(t){return !seen.has(notificationKey(t))}
  function isOwner(){return session?.role==='owner'}
  function setText(text){const el=modal.querySelector('[data-notice-state]');if(el)el.textContent=text}
  function close(){modal.hidden=true;lastFocus?.focus?.()}
  function render(){
    const count=notices.filter(unread).length+(isOwner()?(win.noorStaffUpgrades?.suggestionCount?.()||0):0);
    doc.querySelectorAll('[data-notice-count]').forEach(el=>{el.textContent=String(count);el.classList.toggle('has-unread',count>0)});
    if(modal.hidden||!isOwner())return;
    const list=modal.querySelector('[data-notice-list]');
    list.innerHTML=notices.map(t=>`<article class="nt-notice-row ${unread(t)?'unread':''}"><h3>${e(t.staffName||t.phone)} نے ${t.photoIds.length} تصاویر بھیجی ہیں</h3><p>${e(t.title)}</p><small>${t.submittedAt?e(new Date(t.submittedAt).toLocaleString('ur-PK',{timeZone:'Asia/Karachi'})):'تازہ تصویری رپورٹ'} • ${unread(t)?'نئی اطلاع':'دیکھی گئی'}</small><div class="nt-actions"><button type="button" class="nt-primary" data-notice-task="${e(t.id)}">تصاویر کھولیں</button></div></article>`).join('')||'<p class="nt-empty">جب ملازم کام کی تصاویر جمع کرے گا تو اس کا نام اور اطلاع یہاں آئے گی۔</p>';
    const suggestions=modal.querySelector('[data-staff-suggestions]');if(suggestions)suggestions.innerHTML=win.noorStaffUpgrades?.suggestionHtml?.()||'';
    const toggle=modal.querySelector('[data-notice-enable]');toggle.textContent=enabled?'فون الرٹ بند کریں':'فون پر الرٹ چالو کریں';
  }
  function show(){if(!isOwner())return;lastFocus=doc.activeElement;modal.innerHTML=`<div class="nt-dialog-card"><div class="nt-toolbar"><h3>🔔 اسٹاف کی اطلاعات</h3><button type="button" class="nt-close" data-notice-close aria-label="بند کریں">×</button></div><div class="nt-actions"><button type="button" data-notice-enable></button><button type="button" data-notice-read-all>سب دیکھی گئیں</button></div><p class="nt-notice-help">ایپ کھلی اور انٹرنیٹ سے منسلک ہو تو نئی تصاویر کی اطلاع فوراً آتی ہے۔ فون الرٹ کے لیے Allow کریں۔ مکمل بند ایپ میں فون الرٹ نہیں آئے گا؛ دوبارہ کھولنے پر رپورٹ یہاں مل جائے گی۔</p><p data-notice-state class="nt-msg" role="status"></p><div data-staff-suggestions></div><div data-notice-list></div><small>ہر کام کی تازہ جمع شدہ رپورٹ، آخری 100 اطلاعات۔</small></div>`;modal.hidden=false;render();modal.querySelector('[data-notice-close]').focus()}
  async function toggle(){
    if(!isOwner())return;const ticket=epoch;
    if(enabled){enabled=false;try{win.localStorage.removeItem(preference(session.uid))}catch{}render();setText('فون الرٹ بند ہیں؛ ایپ کی اطلاعات آتی رہیں گی۔');return}
    if(!win.Notification||!nav.serviceWorker){setText('اس براؤزر میں فون الرٹ دستیاب نہیں۔ ایپ کے اندر اطلاع آتی رہے گی۔');return}
    const button=modal.querySelector('[data-notice-enable]');button.disabled=true;
    try{
      // Permission is requested only by this explicit owner button.
      const permission=await win.Notification.requestPermission();if(ticket!==epoch)return;
      if(permission!=='granted'){setText('فون الرٹ کی اجازت نہیں ملی۔ Chrome کی Site settings میں Notifications کو Allow کریں۔');return}
      const registration=await nav.serviceWorker.getRegistration();if(ticket!==epoch)return;
      if(!registration?.active){setText('پہلے Sync / Update Now کرکے ایپ دوبارہ کھولیں، پھر فون الرٹ چالو کریں۔');return}
      enabled=true;try{win.localStorage.setItem(preference(session.uid),'1')}catch{}
      render();setText('فون الرٹ چالو ہیں۔ مالک کی ایپ کھلی اور انٹرنیٹ سے منسلک رکھیں۔');
    }catch{if(ticket===epoch)setText('فون الرٹ چالو نہیں ہو سکے۔ ایپ کے اندر اطلاع آتی رہے گی۔')}
    finally{if(ticket===epoch)button.disabled=false}
  }
  async function signal(added){
    if(!isOwner()||!added.length)return;const ticket=epoch,ownerUid=session.uid,t=added[0];toastTask=t.id;
    const body=`${t.staffName||t.phone} نے ${t.photoIds.length} تصاویر بھیجی ہیں — ${t.title}`;
    toast.innerHTML=`<div><b>📷 نئی تصویری رپورٹ</b><p>${e(body)}${added.length>1?` • ${added.length} نئی رپورٹس`:''}</p></div><button type="button" data-notice-toast-open>دیکھیں</button><button type="button" data-notice-toast-close aria-label="بند کریں">×</button>`;toast.hidden=false;
    if(!enabled||win.Notification?.permission!=='granted'||!nav.serviceWorker)return;
    try{
      const registration=await nav.serviceWorker.getRegistration();if(ticket!==epoch||!isOwner()||!registration?.active)return;
      await registration.showNotification('Noor Traders — نئی تصویری رپورٹ',{body,tag:'nt-task:'+ownerUid+':'+notificationKey(t),dir:'rtl',lang:'ur',renotify:false,data:{type:'NT_TASK_NOTIFICATION',taskId:t.id,ownerUid,submissionId:t.submissionId}});
    }catch{if(ticket===epoch)setText('فون پر الرٹ نہیں دکھ سکا؛ نئی اطلاع ایپ میں موجود ہے۔')}
  }
  async function markTasksRead(rows){
    if(!isOwner())return;const ticket=epoch,keys=rows.filter(t=>t.submissionId).map(notificationKey).filter(k=>!seen.has(k));if(!keys.length)return;
    try{await service.markNotificationsRead(keys);if(ticket!==epoch)return;keys.forEach(k=>seen.add(k));render()}
    catch{if(ticket===epoch)setText('اطلاع کی پڑھی ہوئی حالت محفوظ نہیں ہوئی۔ دوبارہ کوشش کریں۔')}
  }
  async function openTask(id){if(!isOwner())return;close();toast.hidden=true;await onOpen(id)}
  function checkPending(){if(pendingOpen&&isOwner()&&pendingOpen.ownerUid===session.uid&&notices.some(t=>t.id===pendingOpen.taskId)){const id=pendingOpen.taskId;pendingOpen=null;void openTask(id)}}
  const params=new URL(win.location.href).searchParams;
  if(params.get('noticeTask')&&params.get('noticeOwner')){
    pendingOpen={taskId:params.get('noticeTask'),ownerUid:params.get('noticeOwner')};
    const url=new URL(win.location.href);url.searchParams.delete('noticeTask');url.searchParams.delete('noticeOwner');win.history.replaceState(win.history.state,'',url);
  }
  nav.serviceWorker?.addEventListener('message',event=>{const d=event.data;if(d?.type==='NT_STAFF_SUGGESTION'&&isOwner()&&d.ownerUid===session.uid){show();return}if(d?.type==='NT_TASK_NOTIFICATION'&&typeof d.taskId==='string'&&typeof d.ownerUid==='string'){pendingOpen={taskId:d.taskId,ownerUid:d.ownerUid};checkPending()}});
  doc.addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b)return;if(b.hasAttribute('data-notice-open'))show();else if(b.hasAttribute('data-notice-close'))close();else if(b.hasAttribute('data-notice-enable'))void toggle();else if(b.hasAttribute('data-notice-read-all')){void markTasksRead(notices);void win.noorStaffUpgrades?.markSuggestionsRead?.().catch(()=>setText('رائے کی پڑھی ہوئی حالت محفوظ نہیں ہوئی۔'))}else if(b.dataset.noticeTask)void openTask(b.dataset.noticeTask);else if(b.hasAttribute('data-notice-toast-open')){if(toastTask)void openTask(toastTask);else {toast.hidden=true;show()}}else if(b.hasAttribute('data-notice-toast-close'))toast.hidden=true});
  doc.addEventListener('keydown',ev=>{if(modal.hidden)return;if(ev.key==='Escape')close();if(ev.key==='Tab'){const buttons=[...modal.querySelectorAll('button:not([disabled])')],first=buttons[0],last=buttons.at(-1);if(ev.shiftKey&&doc.activeElement===first){ev.preventDefault();last.focus()}else if(!ev.shiftKey&&doc.activeElement===last){ev.preventDefault();first.focus()}}});
  async function suggestionNotice(r){
    if(!isOwner())return;const ticket=epoch,ownerUid=session.uid;toastTask='';
    const body=`${r.staffName||r.phone} نے کام بہتر بنانے کے لیے رائے بھیجی ہے`;
    toast.innerHTML=`<div lang="ur" dir="rtl"><b>💡 نئی رائے</b><p>${e(body)}</p></div><button type="button" data-notice-toast-open>رائے پڑھیں</button><button type="button" data-notice-toast-close aria-label="بند کریں">×</button>`;toast.hidden=false;
    if(!enabled||win.Notification?.permission!=='granted'||!nav.serviceWorker)return;
    try{const registration=await nav.serviceWorker.getRegistration();if(ticket!==epoch||!isOwner()||!registration?.active)return;await registration.showNotification('Noor Traders — نئی رائے',{body,tag:'nt-suggestion:'+ownerUid+':'+r.id,dir:'rtl',lang:'ur',data:{type:'NT_STAFF_SUGGESTION',ownerUid}})}catch{}
  }
  const api={
    refresh:render,suggestionNotice,
    start(next){api.stop();if(next.role!=='owner')return;session={role:'owner',uid:next.uid||next.user?.uid};const ticket=epoch;try{enabled=win.localStorage.getItem(preference(session.uid))==='1'}catch{}try{unsub=service.listenNotificationReads(keys=>{if(ticket!==epoch)return;seen=new Set(keys);render()},()=>{if(ticket===epoch)setText('اطلاعات کی پڑھی ہوئی حالت لوڈ نہیں ہوئی۔ Refresh کرکے دوبارہ کوشش کریں۔')})}catch{setText('اطلاعات کا رابطہ نہیں ہوا۔ Refresh کریں۔')}render()},
    update(rows,fromCache=false){if(!isOwner())return;const result=feed.update(rows,fromCache);notices=result.notices;render();const added=result.added.filter(unread);if(added.length)void signal(added);checkPending()},
    markTaskRead(task){return markTasksRead([task])},
    stop(){const oldUid=session?.uid;epoch++;unsub?.();unsub=null;session=null;notices=[];seen=new Set();enabled=false;feed.reset();modal.hidden=true;modal.innerHTML='';toast.hidden=true;toast.innerHTML='';render();if(oldUid&&nav.serviceWorker)void nav.serviceWorker.getRegistration().then(r=>r?.getNotifications?.()).then(list=>(list||[]).filter(n=>n.data?.ownerUid===oldUid).forEach(n=>n.close())).catch(()=>{})},
    show
  };
  return api;
}
