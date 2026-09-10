import {installTaskNotifications} from './task-notifications.js';
import {MAX_PHOTOS,MAX_PHOTO_CHARS,STATUS,escapeHtml as e,workDate,selectTasks,taskTotals,reportDocument,requireValue} from './task-model.js';

export async function compressTaskPhoto(file) {
  requireValue(file&&/^image\//.test(file.type),'صرف تصویر منتخب کریں۔');
  requireValue(file.size<=25*1024*1024,'ایک تصویر 25 MB سے کم ہونی چاہیے۔');
  const url=URL.createObjectURL(file),im=new Image();
  try {
    await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=()=>reject(new Error('یہ تصویر نہیں کھل رہی۔ JPG یا PNG استعمال کریں۔'));im.src=url});
    requireValue(im.naturalWidth&&im.naturalHeight,'تصویر خالی ہے۔');
    const canvas=document.createElement('canvas');let edge=1280;
    for(let attempt=0;attempt<5;attempt++){
      const scale=Math.min(1,edge/Math.max(im.naturalWidth,im.naturalHeight));canvas.width=Math.max(1,Math.round(im.naturalWidth*scale));canvas.height=Math.max(1,Math.round(im.naturalHeight*scale));
      const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(im,0,0,canvas.width,canvas.height);
      for(const quality of [.8,.65,.5]){const data=canvas.toDataURL('image/jpeg',quality);if(data.length<=MAX_PHOTO_CHARS)return data}
      edge=Math.round(edge*.7);
    }
    throw new Error('تصویر بہت بڑی ہے۔ چھوٹی تصویر منتخب کریں۔');
  } finally {URL.revokeObjectURL(url)}
}

export function installTaskUI({service,getStaff,getAttendance,getSalary=()=>null,getCurrentStaff,document:doc=document,compress=compressTaskPhoto}) {
  let session=null,tasks=[],unsub=null,epoch=0,ready=false,fromCache=false,loadError='',profilePhone='',dialogEpoch=0,reportEpoch=0;
  const $=id=>doc.getElementById(id);
  const notifications=installTaskNotifications({service,document:doc,onOpen:async id=>{doc.defaultView.goScreen?.('staffTasks');return open(id)}});
  const mainModal=doc.createElement('div');mainModal.id='ntTaskDialog';mainModal.className='nt-tasks nt-dialog';mainModal.hidden=true;mainModal.setAttribute('role','dialog');mainModal.setAttribute('aria-modal','true');mainModal.setAttribute('aria-label','Task details');doc.body.appendChild(mainModal);
  const reportModal=doc.createElement('div');reportModal.id='ntTaskReport';reportModal.className='nt-tasks nt-dialog';reportModal.hidden=true;reportModal.setAttribute('role','dialog');reportModal.setAttribute('aria-modal','true');reportModal.setAttribute('aria-label','PDF report');doc.body.appendChild(reportModal);
  const imageModal=doc.createElement('div');imageModal.id='ntTaskImage';imageModal.className='nt-tasks nt-dialog';imageModal.style.zIndex='100003';imageModal.hidden=true;imageModal.setAttribute('role','dialog');imageModal.setAttribute('aria-modal','true');imageModal.setAttribute('aria-label','Picture');doc.body.appendChild(imageModal);
  let previousFocus=null,reportFocus=null,imageFocus=null;
  function closeDialog(){dialogEpoch++;mainModal.hidden=true;mainModal.innerHTML='';previousFocus?.focus?.()}
  function closeReport(){reportEpoch++;reportModal.hidden=true;reportModal.innerHTML='';reportFocus?.focus?.()}
  function closeImage(){imageModal.hidden=true;imageModal.innerHTML='';imageFocus?.focus?.()}
  function showImage(src){imageFocus=doc.activeElement;imageModal.innerHTML=`<div class="nt-dialog-card"><div class="nt-toolbar"><b>تصویر</b><button type="button" class="nt-close" data-close-image aria-label="بند کریں">×</button></div><img class="nt-full-image" src="${src}" alt="کام کی تصویر"></div>`;imageModal.hidden=false;imageModal.querySelector('button').focus()}
  function dialog(title,html){previousFocus=doc.activeElement;dialogEpoch++;mainModal.innerHTML=`<div class="nt-dialog-card"><div class="nt-toolbar"><h3>${e(title)}</h3><button type="button" class="nt-close" data-close-task aria-label="بند کریں">×</button></div>${html}<div class="nt-msg" role="status" aria-live="polite" id="ntDialogMessage"></div></div>`;mainModal.hidden=false;mainModal.querySelector('input:not([disabled]),select,textarea,button')?.focus();return dialogEpoch}
  function message(text,error=false){const el=$('ntDialogMessage');if(el){el.textContent=text;el.className='nt-msg '+(error?'error':'success')}}
  function errorText(err){return ['permission-denied','unauthenticated'].includes(err?.code)?'اجازت نہیں ملی۔ مالک سے اکاؤنٹ اور نئی Firestore Rules چیک کروائیں۔':['unavailable','failed-precondition'].includes(err?.code)?'انٹرنیٹ سے رابطہ کرکے دوبارہ کوشش کریں۔':err?.message||'کام محفوظ نہیں ہوا۔ دوبارہ کوشش کریں۔'}
  function notice(text,error=false){const id=session?.role==='owner'?'ntOwnerTaskNotice':'ntStaffTaskNotice';if($(id)){$(id).textContent=text;$(id).className='nt-msg '+(error?'error':'success')}}
  function ensureReady(){requireValue(session&&ready&&!loadError,'کام ابھی لوڈ نہیں ہوئے۔ انٹرنیٹ چیک کرکے دوبارہ کوشش کریں۔')}
  const stats=rows=>{const s=taskTotals(rows);return `<div class="nt-stats"><div>کل کام<b>${s.total}</b></div><div>منظوری باقی<b>${s.pending}</b></div><div>منظور شدہ پوائنٹس<b>${s.points}</b></div></div><div class="nt-progress-line"><span>منظور شدہ کام</span><b>${s.approved} / ${s.total}</b></div><div class="nt-progress-track" role="progressbar" aria-label="منظور شدہ کام" aria-valuenow="${s.approved}" aria-valuemin="0" aria-valuemax="${Math.max(1,s.total)}"><span style="width:${s.total?Math.round(s.approved/s.total*100):0}%"></span></div>`};
  function cards(rows){return rows.map(t=>`<article class="nt-card"><span class="nt-state ${e(t.status)}">${e(STATUS[t.status]||t.status)}</span><h3>${e(t.title)}</h3><small>${e(t.staffName)} • ${e(t.date||'تاریخ مقرر نہیں')}</small><p>${e(t.details)}</p>${t.ownerNote?`<p class="nt-note">مالک: ${e(t.ownerNote)}</p>`:''}<p><b>پوائنٹس: ${t.status==='approved'?Number(t.points):0} / ${Number(t.maxPoints)}</b> • ${t.photoIds?.length||0} تصاویر</p><button type="button" class="${session.role==='staff'&&['assigned','changes_requested'].includes(t.status)?'nt-primary':''}" data-task-open="${e(t.id)}">${session.role==='staff'&&['assigned','changes_requested'].includes(t.status)?'📷 کام / تصاویر جمع کریں':session.role==='owner'&&t.status==='submitted'?'تصاویر دیکھیں اور OK کریں':'تفصیل اور تصاویر'}</button></article>`).join('')||(session.role==='staff'?'<p class="nt-empty">ابھی کوئی کام نہیں۔ مالک پہلے Staff List میں آپ کی پروفائل کھول کر نیا کام دے، پھر یہاں تصاویر بھیجنے کا بٹن آئے گا۔</p>':'<p class="nt-empty">ابھی کوئی کام نہیں۔ اوپر نیا کام دیں، یا ملازم کی پروفائل سے کام شامل کریں۔</p>')}
  function filter(){return {phone:$('ntTaskStaffFilter')?.value||'',status:$('ntTaskStatusFilter')?.value||'',from:$('ntTaskFrom')?.value||'',to:$('ntTaskTo')?.value||''}}
  function render(){
    if(!session)return;
    const state=loadError?errorText(loadError):!ready?'کام لوڈ ہو رہے ہیں…':fromCache?'محفوظ شدہ ڈیٹا دکھایا جا رہا ہے۔ نئی تبدیلی کے لیے انٹرنیٹ ضروری ہے۔':'';
    const prefix=session.role==='owner'?'Owner':'Staff';if($('nt'+prefix+'TaskState'))$('nt'+prefix+'TaskState').textContent=state;
    if(session.role==='owner'){
      const sel=$('ntTaskStaffFilter');if(sel){const value=sel.value,people=new Map([...getStaff().map(s=>[s.phone||s.id,s.name]),...tasks.map(t=>[t.phone,t.staffName])]);sel.innerHTML='<option value="">تمام ملازمین</option>'+[...people].map(([phone,name])=>`<option value="${e(phone)}">${e(name)} • ${e(phone)}</option>`).join('');sel.value=value}
      try{const rows=selectTasks(tasks,filter());if($('ntOwnerTaskStats'))$('ntOwnerTaskStats').innerHTML=stats(rows);if($('ntOwnerTaskList'))$('ntOwnerTaskList').innerHTML=cards(rows)}catch(err){notice(errorText(err),true)}
      renderProfile();
    }else{
      if($('ntQuickUpload'))$('ntQuickUpload').disabled=!ready||!!loadError;
      if(!ready){if($('ntStaffTaskStats'))$('ntStaffTaskStats').innerHTML='';if($('ntStaffTaskList'))$('ntStaffTaskList').innerHTML='';return;}
      if($('ntStaffTaskStats'))$('ntStaffTaskStats').innerHTML=stats(tasks);
      if($('ntStaffTaskList'))$('ntStaffTaskList').innerHTML=cards(selectTasks(tasks));
    }
    doc.defaultView.renderSalaryV101?.();
    doc.defaultView.renderStaffSalaryV101?.();
  }
  function renderProfile(){
    const slot=$('ownerProfileTasksV99');if(!slot||session?.role!=='owner'||!profilePhone)return;
    const rows=selectTasks(tasks,{phone:profilePhone});slot.innerHTML=`<div class="nt-toolbar"><h3>کام، تصاویر اور پوائنٹس</h3><div class="nt-actions"><button class="nt-primary" type="button" data-task-assign="${e(profilePhone)}">＋ نیا کام دیں</button><button type="button" data-task-profile-report="${e(profilePhone)}">📄 تصاویر والی PDF</button></div></div>${!ready?'<p>کام لوڈ ہو رہے ہیں…</p>':stats(rows)+`<div class="nt-cards">${cards(rows)}</div>`}`;
  }
  function assign(phone='') {
    try{
      ensureReady();requireValue(session.role==='owner','صرف مالک نیا کام دے سکتا ہے۔');
      const staff=getStaff().filter(s=>s.active!==false&&s.loginEnabled!==false),options=staff.map(s=>`<option value="${e(s.phone||s.id)}" ${(s.phone||s.id)===phone?'selected':''}>${e(s.name)} • ${e(s.phone||s.id)}</option>`).join('');
      const token=dialog('ملازم کو نیا کام دیں',`<form id="ntAssignForm"><label>ملازم<select name="phone" required>${options}</select></label><label>کام کا نام<input name="title" required maxlength="160" placeholder="مثلاً شیلف صاف کرکے سامان ترتیب دیں"></label><label>کام کی تفصیل<textarea name="details" rows="3" maxlength="2000"></textarea></label><div class="nt-filters"><label>کام کی تاریخ<input name="date" type="date" required value="${workDate()}"></label><label>زیادہ سے زیادہ پوائنٹس<input name="maxPoints" type="number" value="10" min="0" max="1000" step="1" required></label></div><button class="nt-primary" type="submit">کام محفوظ کرکے ملازم کو دیں</button></form>`);
      $('ntAssignForm').onsubmit=async ev=>{ev.preventDefault();const form=ev.currentTarget,btn=form.querySelector('[type=submit]');btn.disabled=true;message('کام محفوظ ہو رہا ہے…');try{const input=Object.fromEntries(new FormData(form));await service.assign(input);if(token!==dialogEpoch)return;closeDialog();notice('نیا کام ملازم کے پینل پر بھیج دیا گیا۔')}catch(err){if(token===dialogEpoch)message(errorText(err),true)}finally{if(token===dialogEpoch)btn.disabled=false}};
    }catch(err){notice(errorText(err),true)}
  }
  function quickUpload(){
    try{ensureReady();requireValue(session.role==='staff','یہ بٹن اسٹاف کے لیے ہے۔');const available=selectTasks(tasks).filter(t=>['assigned','changes_requested'].includes(t.status));
      if(available.length===1){void open(available[0].id);return}
      if(!available.length){notice(tasks.length?'آپ کے کام جمع یا منظور ہو چکے ہیں۔ مزید تصاویر کے لیے مالک سے نیا کام یا دوبارہ جمع کرنے کی اجازت لیں۔':'مالک پہلے آپ کی پروفائل سے نیا کام دے۔ اس کے بعد یہاں تصاویر لگا سکیں گے۔');return}
      dialog('کس کام کی تصاویر بھیجنی ہیں؟','<p>نیچے اپنا کام منتخب کریں۔</p><div class="nt-cards">'+cards(available)+'</div>');
    }catch(err){notice(errorText(err),true)}
  }
  async function open(id) {
    try{
      ensureReady();const task=structuredClone(tasks.find(t=>t.id===id));requireValue(task,'کام نہیں ملا۔');
      const canSubmit=session.role==='staff'&&['assigned','changes_requested'].includes(task.status),canReview=session.role==='owner'&&task.status==='submitted';
      const token=dialog(task.title,`<p>${e(task.staffName)} • ${e(task.date||'تاریخ مقرر نہیں')}</p><p class="nt-note">${e(task.details)}</p><p><span class="nt-state ${e(task.status)}">${e(STATUS[task.status])}</span> • پوائنٹس: ${task.status==='approved'?Number(task.points):0} / ${Number(task.maxPoints)}</p><p class="nt-note">ملازم: ${e(task.staffNote||'—')}<br>مالک: ${e(task.ownerNote||'—')}</p><div id="ntSavedPhotos" class="nt-photos"></div>${canSubmit?`<form id="ntSubmitForm"><p>کام مکمل کرکے کیمرے سے 1 سے ${MAX_PHOTOS} تصاویر لیں۔ گیلری سے تصویر شامل نہیں کی جا سکتی۔ ہر تصویر الگ کھول کر دیکھی جا سکتی ہے۔</p><div class="nt-actions"><label class="nt-camera-btn" id="ntCameraBtn">📷 کیمرہ کھول کر تصویر لیں<input id="ntCameraPhoto" type="file" accept="image/*" capture="environment" hidden></label></div><div id="ntDraftPhotos" class="nt-photos"></div><small id="ntPhotoCount">0 / ${MAX_PHOTOS} تصاویر</small><label>کام کے بارے میں نوٹ<textarea id="ntStaffNote" maxlength="2000" rows="3"></textarea></label><button class="nt-primary" type="submit" id="ntSubmitPhotos" disabled>تصاویر مالک کو بھیجیں</button></form>`:canReview?`<form id="ntReviewForm"><label>دینے والے پوائنٹس (0–${Number(task.maxPoints)})<input id="ntReviewPoints" type="number" min="0" max="${Number(task.maxPoints)}" step="1" value="${Number(task.maxPoints)}" required></label><label>مالک کا نوٹ<textarea id="ntOwnerNote" rows="3" maxlength="2000"></textarea></label><div class="nt-actions"><button type="submit" class="nt-primary" disabled>✓ OK — منظور کریں</button><button type="button" id="ntRequestChanges" disabled>دوبارہ کام / تصاویر مانگیں</button></div></form>`:''}`);
      if(task.photoIds?.length){message('تصاویر لوڈ ہو رہی ہیں…');const photos=await service.photos(task);if(token!==dialogEpoch)return;$('ntSavedPhotos').innerHTML=[...photos.values()].map((src,i)=>`<div class="nt-photo"><img src="${src}" data-task-image alt="کام کی تصویر ${i+1}" tabindex="0" role="button"></div>`).join('');message('')}
      if(token!==dialogEpoch)return;
      if(canSubmit)wireSubmission(task,token);
      if(canReview)wireReview(task,token);
      if(session?.role==='owner')void notifications.markTaskRead(task);
      return true;
    }catch(err){message(errorText(err),true);return false}
  }
  function wireSubmission(task,token){
    const photos=[];let preparing=false,saving=false;
    const refresh=()=>{if(token!==dialogEpoch)return;$('ntPhotoCount').textContent=`${photos.length} / ${MAX_PHOTOS} تصاویر`;$('ntDraftPhotos').innerHTML=photos.map((src,i)=>`<div class="nt-photo"><img src="${src}" data-task-image alt="نئی تصویر ${i+1}" tabindex="0" role="button"><button type="button" data-remove-photo="${i}">ہٹائیں</button></div>`).join('');$('ntSubmitPhotos').disabled=!photos.length||preparing||saving;$('ntCameraPhoto').disabled=preparing||saving;$('ntCameraBtn').classList.toggle('is-busy',preparing||saving)};
    const add=async ev=>{const files=[...ev.target.files];ev.target.value='';if(preparing||saving)return;preparing=true;refresh();message('تصاویر تیار ہو رہی ہیں…');try{requireValue(photos.length+files.length<=MAX_PHOTOS,`زیادہ سے زیادہ ${MAX_PHOTOS} تصاویر شامل کریں۔`);for(const file of files){const data=await compress(file);if(token!==dialogEpoch)return;photos.push(data)}message('تصاویر تیار ہیں۔ بھیجنے سے پہلے دیکھ لیں۔')}catch(err){if(token===dialogEpoch)message(errorText(err),true)}finally{preparing=false;refresh()}};
    $('ntCameraPhoto').onchange=add;
    $('ntDraftPhotos').onclick=ev=>{const b=ev.target.closest('[data-remove-photo]');if(b&&!preparing&&!saving){photos.splice(Number(b.dataset.removePhoto),1);refresh()}};
    $('ntSubmitForm').onsubmit=async ev=>{ev.preventDefault();if(preparing||saving)return;saving=true;refresh();message('تصاویر اور کام محفوظ ہو رہے ہیں…');const input={photos:[...photos],staffNote:$('ntStaffNote').value,submissionId:crypto.randomUUID(),expectedRevision:task.revision};try{await service.submit(task.id,input);if(token!==dialogEpoch)return;closeDialog();notice('تصاویر جمع ہو گئیں۔ مالک کی منظوری کے بعد پوائنٹس ملیں گے۔')}catch(err){if(token===dialogEpoch)message(errorText(err),true)}finally{saving=false;refresh()}};
  }
  function wireReview(task,token){
    const form=$('ntReviewForm');form.querySelectorAll('button').forEach(b=>b.disabled=false);let busy=false;
    const review=async status=>{if(busy)return;if(status==='approved'&&!form.reportValidity())return;busy=true;form.querySelectorAll('button').forEach(b=>b.disabled=true);message('فیصلہ محفوظ ہو رہا ہے…');try{await service.review(task.id,{status,points:$('ntReviewPoints').value,ownerNote:$('ntOwnerNote').value,expectedRevision:task.revision,submissionId:task.submissionId});if(token!==dialogEpoch)return;closeDialog();notice(status==='approved'?'کام منظور ہوگیا اور پوائنٹس شامل ہو گئے۔':'وجہ کے ساتھ کام ملازم کو واپس بھیج دیا گیا۔')}catch(err){if(token===dialogEpoch)message(errorText(err),true)}finally{busy=false;if(token===dialogEpoch)form.querySelectorAll('button').forEach(b=>b.disabled=false)}};
    form.onsubmit=ev=>{ev.preventDefault();void review('approved')};$('ntRequestChanges').onclick=()=>review('changes_requested');
  }
  async function report({phone='',from='',to='',status='',individual=false}={}){
    try{
      ensureReady();const currentEpoch=epoch,owner=session.role==='owner';if(!owner)phone=session.phone;
      const rows=structuredClone(selectTasks(tasks,{phone,from,to,status})),attendance=individual?structuredClone(getAttendance(phone,from,to)||[]):[];
      const person=phone?(getStaff().find(s=>(s.phone||s.id)===phone)||getCurrentStaff()||{}):{};
      const salary=individual?structuredClone(getSalary(phone,from,to)||null):null;
      reportFocus=doc.activeElement;const token=++reportEpoch;reportModal.hidden=false;reportModal.innerHTML=`<div class="nt-dialog-card nt-report-card"><div class="nt-toolbar"><h3>تصاویر اور پوائنٹس کی PDF</h3><div class="nt-actions"><button type="button" id="ntPrintReport" disabled>📄 Print / Save as PDF</button><button type="button" class="nt-close" data-close-report aria-label="بند کریں">×</button></div></div><p id="ntReportState" role="status">رپورٹ تیار ہو رہی ہے…</p><iframe id="ntReportFrame" title="Staff task report" sandbox="allow-same-origin allow-modals"></iframe></div>`;reportModal.querySelector('[data-close-report]').focus();
      const photos=new Map();if(owner){for(const task of rows){const entries=await service.photos(task);if(token!==reportEpoch||currentEpoch!==epoch)return;for(const entry of entries)photos.set(...entry)}}
      if(token!==reportEpoch||currentEpoch!==epoch)return;
      const html=reportDocument({tasks:rows,photos,includePhotos:owner,attendance,salary,title:owner?'Staff Complete Report':'My Attendance, Points & Salary Report',subtitle:[person.name||phone||'تمام ملازمین',from||'ابتدا',to||'اب تک'].join(' • ')});
      const frame=$('ntReportFrame');frame.onload=async()=>{
        try{
          const images=[...frame.contentDocument.images];await Promise.all(images.map(im=>im.complete?(im.naturalWidth?Promise.resolve():Promise.reject(new Error('رپورٹ کی تصویر نہیں کھل سکی۔'))):new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=()=>reject(new Error('رپورٹ کی تصویر نہیں کھل سکی۔'))})));
          if(token!==reportEpoch||currentEpoch!==epoch)return;
          $('ntReportState').textContent='رپورٹ تیار ہے۔ Print کھول کر Save as PDF منتخب کریں۔';$('ntPrintReport').disabled=false;
        }catch(err){if(token===reportEpoch)$('ntReportState').textContent=errorText(err)}
      };frame.srcdoc=html;
      $('ntPrintReport').onclick=()=>{frame.contentWindow.focus();frame.contentWindow.print()};
    }catch(err){if($('ntReportState'))$('ntReportState').textContent=errorText(err);else notice(errorText(err),true)}
  }
  doc.addEventListener('click',ev=>{
    const b=ev.target.closest('button,img');if(!b)return;
    if(b.dataset.staffSection&&session?.role==='staff'){const target=$(b.dataset.staffSection);target?.scrollIntoView({behavior:doc.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}else if(b.matches('[data-close-task]'))closeDialog();else if(b.matches('[data-close-report]'))closeReport();else if(b.matches('[data-close-image]'))closeImage();else if(b.matches('[data-task-image]'))showImage(b.src);else if(b.hasAttribute('data-task-upload'))quickUpload();else if(b.hasAttribute('data-task-edit-assign'))assign($('staffEditOldPhoneV85').value);else if(b.hasAttribute('data-task-assign'))assign(b.dataset.taskAssign);else if(b.dataset.taskOpen)void open(b.dataset.taskOpen);else if(b.dataset.taskProfileReport)void report({phone:b.dataset.taskProfileReport,individual:true});else if(b.matches('[data-task-report]'))void report(session?.role==='owner'?filter():{phone:session?.phone,from:$('staffHistoryFrom')?.value,to:$('staffHistoryTo')?.value,individual:true});else if(b.matches('[data-task-retry]')&&session)api.start(session);
  });
  doc.addEventListener('keydown',ev=>{
    if(ev.key==='Escape'){if(!imageModal.hidden)closeImage();else if(!reportModal.hidden)closeReport();else if(!mainModal.hidden)closeDialog()}
    if(['Enter',' '].includes(ev.key)&&ev.target.matches('[data-task-image]')){ev.preventDefault();showImage(ev.target.src)}
    if(ev.key==='Tab'){const modal=!imageModal.hidden?imageModal:!reportModal.hidden?reportModal:!mainModal.hidden?mainModal:null;if(!modal)return;const els=[...modal.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea,select,[tabindex="0"]')];if(!els.length)return;const first=els[0],last=els.at(-1);if(ev.shiftKey&&doc.activeElement===first){ev.preventDefault();last.focus()}else if(!ev.shiftKey&&doc.activeElement===last){ev.preventDefault();first.focus()}}
  });
  ['ntTaskStaffFilter','ntTaskStatusFilter','ntTaskFrom','ntTaskTo'].forEach(id=>$(id)?.addEventListener('change',()=>{notice('');render()}));
  const api={
    start(next){api.stop();session={...next};notifications.start(next);const ticket=epoch;render();try{unsub=service.listen((rows,cached)=>{if(ticket!==epoch)return;tasks=rows;ready=true;fromCache=cached;loadError='';render();notifications.update(tasks,cached)},err=>{if(ticket!==epoch)return;ready=false;tasks=[];loadError=err;render()})}catch(err){loadError=err;render()}},
    stop(){epoch++;notifications.stop();unsub?.();unsub=null;session=null;tasks=[];ready=false;loadError='';closeDialog();closeReport();closeImage();for(const id of ['ntOwnerTaskList','ntStaffTaskList','ntOwnerTaskStats','ntStaffTaskStats','ownerProfileTasksV99'])if($(id))$(id).innerHTML=''},
    assign,open,report,
    profile(phone){profilePhone=phone;renderProfile()},
    totals(phone,range={}){return taskTotals(selectTasks(tasks,{phone,from:range.from||'',to:range.to||''}))},
    refreshNotifications:()=>notifications.refresh(),suggestionNotice:r=>notifications.suggestionNotice(r),
    refresh:render
  };
  return api;
}
