// Real app scripts and UI with synthetic SDK/DOM; no production network or visual browser.
import {Window} from 'happy-dom';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as authModule from '../auth-controller.js';
import * as model from '../task-model.js';
import {createTaskService} from '../task-service.js';
import {fakeSdk} from './fake-sdk.mjs';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../staff-tasks.js',import.meta.url),'utf8');
const blocks=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].map(m=>({module:m[1].includes('module'),code:m[2]}));
const stripImports=s=>s.replace(/import[\s\S]*?from\s*["'][^"']+["'];/g,'');
const delay=()=>new Promise(resolve=>setTimeout(resolve,30));
const phone='03000000001',base='businesses/noor-traders',img='data:image/jpeg;base64,/9j/2Q==';
const owner={uid:'owner',email:'hp6235@gmail.com',isAnonymous:false};
const fixture={phone,name:'Synthetic employee',role:'Cashier',active:true,loginEnabled:true,address:'Test shop',salary:{monthlySalary:30000,dutyHours:10,workingDays:30,overtimeRate:200,pointRate:10},salaryExtras:[{id:'bonus-1',month:'2026-09',kind:'bonus',amount:500},{id:'advance-1',month:'2026-09',kind:'advance',amount:100}]};
async function boot(role,extraRecords=[]){
 const errors=[],w=new Window({url:'http://localhost:8765',settings:{disableJavaScriptEvaluation:true,disableJavaScriptFileLoading:true,disableCSSFileLoading:true}});
 w.console.error=(...v)=>errors.push(v.map(String).join(' '));w.console.warn=()=>{};
 w.document.write(html.replace(/<script[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link[^>]*>/g,''));
 for(const el of w.document.querySelectorAll('[id]'))if(!(el.id in w))w[el.id]=el;
 w.structuredClone=structuredClone;w.setInterval=()=>0;w.setTimeout=(cb,ms)=>ms<1000?setTimeout(cb,0):0;w.fetch=async()=>({ok:true,json:async()=>({version:'v100'})});
 const records=new Map([[base+'/staffAccounts/'+phone,fixture],[base+'/staff/'+phone,{...fixture,id:phone}],[base+'/staffSessions/staff',{phone}],[base+'/staffConfig/main',{radius:200,version:'v102'}],[base+'/staffAttendance/attendance',{phone,date:'2026-09-08',checkIn:'09:00',checkOut:'20:00',finalScore:10}]]);
 for(const [path,data] of extraRecords)records.set(path,data);
 const phoneNotices=[],workerMessages=new Map();let permissionRequests=0;
 const registration={active:{state:'activated'},showNotification:async(title,options)=>phoneNotices.push({title,...options}),getNotifications:async()=>[]};
 Object.defineProperty(w.navigator,'serviceWorker',{configurable:true,value:{getRegistration:async()=>registration,register:async()=>registration,addEventListener:(type,fn)=>workerMessages.set(type,fn)}});
 Object.defineProperty(w,'Notification',{configurable:true,value:{permission:'default',requestPermission:async()=>{permissionRequests++;w.Notification.permission='granted';return 'granted'}}});
 const f=fakeSdk({records,initialUser:role==='owner'?owner:role==='staff'?{uid:'staff',isAnonymous:true}:role==='outsider'?{uid:'outsider',isAnonymous:false,email:'outsider@example.test'}:null});
 Object.assign(w,authModule,model,f.sdk,{createTaskService,e:model.escapeHtml});
 w.eval(stripImports(ui).replace(/export /g,''));
 // Happy DOM has no image/canvas decoder; inject fixed JPEG data only at that boundary.
 const realInstall=w.installTaskUI;w.installTaskUI=args=>realInstall({...args,compress:async()=>img});
 for(const b of blocks)if(b.module)await w.eval('(async()=>{'+stripImports(b.code).replace('installTaskUI({service:taskService,','installTaskUI({compress:async()=>\'data:image/jpeg;base64,/9j/2Q==\',service:taskService,')+'})()');else w.eval(b.code.replace(/^(const|let) /gm,'var '));
 await delay();return{w,f,errors,phoneNotices,workerMessages,getPermissionRequests:()=>permissionRequests};
}
for(const role of ['none','owner','staff','outsider']){
 const {w,errors}=await boot(role);assert.deepEqual(errors,[],`script errors in ${role}`);
 assert.equal(w.ownerApp.hidden,role!=='owner');assert.equal(w.staffPortal.hidden,role!=='staff');assert.equal(w.loginGate.classList.contains('hidden'),['owner','staff'].includes(role));
 for(const el of w.document.querySelectorAll('.tab'))assert.ok(w.ownerApp.contains(el),`${el.id} must stay inside owner wrapper`);
 assert.ok(w.staffPortal.contains(w.staffTaskPanelV99));
 assert.equal(new Set([...w.document.querySelectorAll('[id]')].map(x=>x.id)).size,w.document.querySelectorAll('[id]').length,'IDs must be unique');
 if(role==='owner'){
  w.goScreen('staffAccounts');const bar=w.document.getElementById('staffTopNavV99');assert.equal(bar.hidden,false);assert.equal(bar.nextElementSibling.id,'staffAccounts');
  const buttons=[...bar.querySelectorAll('.staff-feature-card')];assert.equal(buttons.length,12);for(const b of buttons)new Function(b.getAttribute('onclick'));
  w.goScreen('staffTasks');assert.equal(bar.nextElementSibling.id,'staffTasks');w.goScreen('dashboard');assert.equal(bar.hidden,false);assert.ok(w.document.getElementById('staffCenter').classList.contains('active'));w.goScreen('settings');assert.equal(bar.hidden,true);
 }
 console.log('PASS actual HTML + scripts:',role,'view, role containment and navigation');await w.happyDOM.abort();
}
const {w,f,errors}=await boot('owner');
const submit=form=>form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
w.editStaffV84(phone);w.document.querySelector('#staffEditFormV85 .nt-task-link').click();await delay();
const form=w.document.getElementById('ntAssignForm');assert.ok(form,'task form opens from edit profile');
form.querySelector('[name=title]').value='Clean shelf <one>';form.querySelector('[name=details]').value='Arrange stock and send two pictures.';
form.querySelector('[name=date]').value='2026-09-08';form.querySelector('[name=maxPoints]').value='10';submit(form);await delay();
let task=[...f.records.entries()].find(([k])=>k.startsWith(base+'/staffTasks/'))?.[1];assert.equal(task.title,'Clean shelf <one>');
w.closeStaffEditV85();w.logoutBtn.click();await delay();w.staffLoginTab.click();w.staffLoginPhone.value='admin';w.staffLoginPassword.value=phone;submit(w.staffLoginForm);await delay();
assert.equal(w.staffPortal.hidden,false);assert.equal(w.ownerApp.hidden,true);assert.ok(w.document.getElementById('ntStaffTaskList').textContent.includes('Clean shelf <one>'));
w.document.getElementById('ntQuickUpload').click();await delay();const input=w.document.getElementById('ntCameraPhoto');
Object.defineProperty(input,'files',{value:[new w.File(['one'],'one.jpg',{type:'image/jpeg'}),new w.File(['two'],'two.jpg',{type:'image/jpeg'})],configurable:true});
input.dispatchEvent(new w.Event('change',{bubbles:true}));await delay();assert.equal(w.document.querySelectorAll('#ntDraftPhotos img').length,2);assert.equal(w.document.getElementById('ntSubmitPhotos').disabled,false);
submit(w.document.getElementById('ntSubmitForm'));await delay();task=f.records.get(base+'/staffTasks/'+task.id);assert.equal(task.status,'submitted');assert.equal(task.photoIds.length,2);assert.equal(w.noorTasks.totals(phone).points,0);
w.staffLogoutBtn.click();await delay();w.ownerLoginTab.click();w.loginEmail.value='admin';w.loginPassword.value='synthetic-owner-password';submit(w.loginForm);await delay();
w.goScreen('staffTasks');w.document.querySelector('#ntOwnerTaskList [data-task-open]').click();await delay();assert.equal(w.document.querySelectorAll('#ntSavedPhotos img').length,2);
w.document.getElementById('ntReviewPoints').value='7';submit(w.document.getElementById('ntReviewForm'));await delay();task=f.records.get(base+'/staffTasks/'+task.id);assert.equal(task.status,'approved');assert.equal(task.points,7);assert.equal(w.noorTasks.totals(phone).points,7);
await w.noorTasks.report({phone,from:'2026-09-08',to:'2026-09-08',individual:true});const ownerReport=w.document.getElementById('ntReportFrame').srcdoc;
assert.equal((ownerReport.match(/<img src="data:image/g)||[]).length,2);assert.ok(ownerReport.includes('مجموعہ: 17'));
assert.ok(ownerReport.includes('Salary / تنخواہ'));assert.ok(ownerReport.includes('Rs 1,770'));
w.logoutBtn.click();await delay();assert.equal(w.document.getElementById('ntTaskReport').hidden,true);assert.equal(w.document.getElementById('ntTaskDialog').hidden,true);
w.staffLoginTab.click();w.staffLoginPassword.value=phone;submit(w.staffLoginForm);await delay();w.staffHistoryFrom.value='2026-09-08';w.staffHistoryTo.value='2026-09-08';w.staffPdfBtn.click();await delay();assert.ok(w.document.getElementById('ntReportFrame').srcdoc.includes('مجموعہ: 17'));
assert.ok(w.document.getElementById('ntReportFrame').srcdoc.includes('Rs 1,770'));
assert.deepEqual(errors,[]);console.log('PASS full UI: profile assignment → 2 photos → approval → both PDFs → logout cleanup');await w.happyDOM.abort();

// The production failure: two old tasks without dates must still expose the upload UI.
{
 const {w,errors}=await boot('staff',[[base+'/staffTasks/sparse-a',{phone,title:'First old task'}],[base+'/staffTasks/sparse-b',{phone,title:'Second old task',date:null}]]);
 assert.deepEqual(errors,[]);assert.equal(w.document.querySelectorAll('#ntStaffTaskList .nt-card').length,2);
 w.document.getElementById('ntQuickUpload').click();await delay();assert.equal(w.document.querySelectorAll('#ntTaskDialog [data-task-open]').length,2);
 w.document.querySelector('#ntTaskDialog [data-task-open]').click();await delay();assert.ok(w.document.getElementById('ntCameraPhoto'));assert.ok(!w.document.getElementById('ntGalleryPhotos'));
 assert.ok(w.staffTaskPanelV99.compareDocumentPosition(w.staffAttendancePanelV100)&w.Node.DOCUMENT_POSITION_FOLLOWING);
 Object.defineProperty(w.navigator,'geolocation',{configurable:true,value:{getCurrentPosition:fn=>fn({coords:{latitude:32.7979125,longitude:73.956984375,accuracy:5}})}});
 w.staffGpsBtn.click();await delay();assert.equal(w.staffGpsMeters.textContent,'0');assert.ok(w.staffGpsMessage.textContent.includes('allowed'));
 Object.defineProperty(w.navigator,'geolocation',{configurable:true,value:{getCurrentPosition:fn=>fn({coords:{latitude:33.2059125,longitude:73.273546875,accuracy:5}})}});
 w.staffGpsBtn.click();await delay();assert.ok(Number(w.staffGpsMeters.textContent)>70000);assert.ok(w.staffGpsMessage.textContent.includes('نہیں'));
 console.log('PASS sparse legacy tasks + quick upload chooser + corrected shop GPS');await w.happyDOM.abort();
}
// Owner stays signed in while another employee submits pictures; actual UI shows the alert.
{
 const {w,f,errors,phoneNotices,workerMessages,getPermissionRequests}=await boot('owner');
 assert.equal(getPermissionRequests(),0);w.document.querySelector('[data-notice-open]').click();await delay();
 w.document.querySelector('[data-notice-enable]').click();await delay();assert.equal(getPermissionRequests(),1);
 const t=model.createTask({phone,staffName:'Sonu',title:'Clean shelf',date:'2026-09-09',maxPoints:10},{role:'owner',uid:'owner'},'live-task');
 const patch=model.submissionPatch(t,{role:'staff',uid:'staff',phone},{photos:[img,img],submissionId:'live-submission',expectedRevision:0});
 const data={...t,...patch},batch=f.sdk.writeBatch();batch.set(f.sdk.doc({},base+'/staffTasks/live-task'),data);
 for(const id of patch.photoIds)batch.set(f.sdk.doc({},base+'/staffTasks/live-task/taskPhotos/'+id),{taskId:t.id,submissionId:patch.submissionId,dataUrl:img});
 await batch.commit();await delay();assert.equal(w.document.getElementById('ntNoticeToast').hidden,false);assert.ok(w.document.getElementById('ntNoticeToast').textContent.includes('Sonu'));
 assert.equal(phoneNotices.length,1);assert.equal(phoneNotices[0].data.ownerUid,'owner');assert.ok(phoneNotices[0].body.includes('2'));
 assert.equal(w.document.querySelector('[data-notice-count]').textContent,'1');
 f.emit();await delay();assert.equal(phoneNotices.length,1,'metadata/reconnect replay must not re-alert');
 workerMessages.get('message')({data:{type:'NT_TASK_NOTIFICATION',taskId:t.id,ownerUid:'different-owner'}});await delay();assert.equal(w.document.getElementById('ntTaskDialog').hidden,true);
 workerMessages.get('message')({data:phoneNotices[0].data});await delay();assert.equal(w.document.querySelectorAll('#ntSavedPhotos img').length,2);assert.equal(w.document.querySelector('[data-notice-count]').textContent,'0');
 assert.ok(f.records.get(base+'/staffTaskNotificationReads/owner').seen.includes('live-task::live-submission'));
 w.logoutBtn.click();await delay();assert.equal(w.document.getElementById('ntNoticeDialog').hidden,true);assert.equal(w.document.getElementById('ntNoticeToast').hidden,true);
 await f.sdk.setDoc(f.sdk.doc({},base+'/staffTasks/live-task'),{...data,submissionId:'another-submission',revision:2});await delay();assert.equal(phoneNotices.length,1,'no owner alerts after logout');
 assert.deepEqual(errors,[]);console.log('PASS live in-app + opt-in phone alert + click to photos + persisted read + logout privacy');await w.happyDOM.abort();
}

// v104 additive staff workflow, using the same actual HTML and synthetic SDK.
{
 const {w,f,errors}=await boot('staff');
 const form=w.document.getElementById('suRequest');
 form.elements.kind.value='correction';form.elements.date.value='2026-09-08';form.elements.to.value='2026-09-08';form.elements.checkOut.value='19:00';form.elements.reason.value='Forgot checkout';
 form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await delay();
 const request=[...f.records].find(([k])=>k.includes('/staffRequests/'));
 assert.ok(request,'staff request saved');assert.equal(request[1].phone,phone);assert.equal(request[1].status,'pending');
 const o=await boot('owner',[request,[base+'/staffAttendance/2026-09-08_'+phone,{phone,date:'2026-09-08',checkIn:'09:00',finalScore:10}]]);
 o.w.prompt=()=> 'Reviewed';o.w.document.querySelector('[data-tab="approvals"]').click();
 o.w.document.querySelector('[data-review][data-status="approved"]').click();await delay();
 assert.equal(o.f.records.get(request[0]).status,'approved');
 assert.equal(o.f.records.get(base+'/staffAttendance/2026-09-08_'+phone).checkOut,'19:00');
 assert.ok([...o.f.records.keys()].some(k=>k.includes('/staffAudit/')));
 o.w.document.querySelector('[data-tab="staff"]').click();const schedule=o.w.document.querySelector('[data-schedule]');
 schedule.elements.shiftStart.value='10:00';schedule.elements.grace.value='15';schedule.elements.off.value='5';schedule.elements.reason.value='New shift';schedule.dispatchEvent(new o.w.Event('submit',{bubbles:true,cancelable:true}));await delay();
 assert.equal(o.f.records.get(base+'/staffSchedules/'+phone).shiftStart,'10:00');
 o.w.document.querySelector('[data-tab="salary"]').click();o.w.document.querySelector('[data-final]').click();await delay();
 const payrollPath=base+'/staffPayroll/2026-09_'+phone,payroll=o.f.records.get(payrollPath);assert.equal(payroll.state,'final');
 const final=payroll.snapshot.final;
 await o.f.sdk.setDoc(o.f.sdk.doc({},base,'staffAttendance','2026-09-08_'+phone),{checkOut:'18:00'},{merge:true});await delay();assert.equal(o.w.salaryCalcV101(phone,'2026-09').final,final,'finalized amount stays frozen');
 let answers=['100','2026-09-10','Cash'];o.w.prompt=()=>answers.shift();o.w.document.querySelector('[data-pay]').click();await delay();assert.equal(o.f.records.get(payrollPath).paid,100);
 answers=['999999','2026-09-10','Cash'];o.w.prompt=()=>answers.shift();o.w.document.querySelector('[data-pay]').click();await delay();assert.equal(o.f.records.get(payrollPath).paid,100,'overpayment rejected');
 o.f.failNextCommit();answers=['100','2026-09-10','Cash'];o.w.prompt=()=>answers.shift();o.w.document.querySelector('[data-pay]').click();await delay();assert.equal(o.f.records.get(payrollPath).paid,100,'failed commit leaves payment unchanged');
 assert.deepEqual(errors,[]);assert.deepEqual(o.errors,[]);
 if(process.env.NT_VISUAL_DIR){o.w.document.querySelector('[data-tab="overview"]').click();o.w.goScreen('staffCenter');fs.writeFileSync(process.env.NT_VISUAL_DIR+'/owner.html',o.w.document.documentElement.outerHTML.replace(/<script[^>]*>[\s\S]*?<\/script>/g,''));fs.writeFileSync(process.env.NT_VISUAL_DIR+'/staff.html',w.document.documentElement.outerHTML.replace(/<script[^>]*>[\s\S]*?<\/script>/g,''));}
 w.noorStaffUpgrades.stop();assert.equal(w.document.getElementById('suOwnRequests').textContent,'');
 console.log('PASS v104 staff request → audited correction → duty schedule → salary freeze → payment / overpayment / failure → logout');
}

{
 const {w}=await boot('owner');
 const frames=new Map();let next=0;const targets=[];
 w.requestAnimationFrame=fn=>{frames.set(++next,fn);return next};
 w.cancelAnimationFrame=id=>frames.delete(id);
 w.scrollToScreenV94=el=>targets.push(el.id);
 w.goScreen('staffAccounts');
 assert.equal(targets.length,0,'scroll waits until the form renders');
 w.goScreen('attendanceToday');
 assert.equal(frames.size,1,'rapid clicks cancel the previous scroll');
 for(const fn of frames.values())fn();frames.clear();
 assert.deepEqual(targets,['attendanceToday'],'selected content is targeted, not the options menu');
 w.noorStaffUpgrades.stop();
 console.log('PASS v105 navigation waits for render, targets selected content, cancels stale scroll');
}

{
 const {w,errors}=await boot('owner');
 const allowed=new Set(['staffCenter','staffAccounts','staffProfile','staffTasks','attendanceToday','attendanceHistory','scores','staffKhana','staffSalary','staffSalaryDetail','staffReports','settings','backup']);
 for(const b of w.document.querySelectorAll('#nav [data-tab],#mobileDockV84 [data-go]'))assert.ok(allowed.has(b.dataset.tab||b.dataset.go),'only staff destinations in menus');
 for(const id of ['sales','collections','expenses','cashScreen','accountIncoming','stock','purchases','manufacturing','salesReports','completeReport','reports']){
   w.goScreen(id);assert.ok(w.document.getElementById('staffCenter').classList.contains('active'));
   const el=w.document.getElementById(id);assert.equal(el.dataset.nonstaffV106,'true');assert.equal(el.hidden,true);
 }
 assert.equal(w.document.getElementById('newCat').closest('[data-nonstaff-v106]').hidden,true);
 assert.deepEqual(errors,[]);
 console.log('PASS v106 Staff-only menu, business route redirects, hidden/inert legacy screens, staff settings');
}

{
 const {w,f,errors}=await boot('staff');const form=w.document.getElementById('suSuggestion');
 form.elements.reason.value='کام بہتر کریں <img src=x onerror=alert(1)>';
 f.failNextCommit();form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await delay();assert.ok(form.elements.reason.value,'failed send preserves suggestion');
 form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await delay();
 const r=[...f.records].find(([k,v])=>k.includes('/staffRequests/')&&v.kind==='suggestion');assert.ok(r);assert.equal(r[1].phone,phone);assert.equal(form.elements.reason.value,'');
 const o=await boot('owner',[r]);assert.equal(o.w.document.querySelector('[data-notice-count]').textContent,'1');assert.equal(o.w.document.getElementById('ntNoticeToast').hidden,true,'old suggestions do not replay alerts');
 o.w.document.querySelector('[data-notice-open]').click();assert.ok(o.w.document.getElementById('ntNoticeDialog').textContent.includes('کام بہتر'));assert.equal(o.w.document.querySelector('[data-staff-suggestions] img'),null,'suggestion HTML is escaped');
 o.w.document.querySelector('[data-staff-suggestions] [data-review]').click();await delay();assert.equal(o.f.records.get(r[0]).status,'reviewed');assert.equal(o.w.document.querySelector('[data-notice-count]').textContent,'0');
 await o.f.sdk.setDoc(o.f.sdk.doc({},base,'staffRequests','new-suggestion'),{...r[1],reason:'New idea',createdAt:Date.now()+1});await delay();assert.equal(o.w.document.getElementById('ntNoticeToast').hidden,false);assert.equal(o.w.document.querySelector('[data-notice-count]').textContent,'1');
 assert.equal(o.getPermissionRequests(),0,'no unsolicited phone permission request');
 assert.ok(w.document.getElementById('premiumPanelsV100').textContent.includes('data:font/woff2;base64,'));
 assert.deepEqual(errors,[]);assert.deepEqual(o.errors,[]);
 console.log('PASS v107 suggestion send/failure, owner inbox/read status, live alert, escaping, font embedding');
}

{
 const {w,f,errors}=await boot('staff');
 // Reinstall only dictation with a deterministic browser recognition boundary.
 const {installUrduDictation}=await import('../staff-upgrades.js');
 const form=w.document.getElementById('suSuggestion');form.querySelector('.su-dictation').remove();let rec;
 w.SpeechRecognition=class{constructor(){rec=this}start(){}stop(){this.onend?.()}abort(){this.onend?.()}};
 const voice=installUrduDictation({form,status:w.document.getElementById('suSuggestionStatus'),win:w});
 form.elements.reason.value='میری رائے';form.querySelector('[data-dictate]').click();assert.equal(rec.lang,'ur-PK');assert.equal(form.querySelector('[type=submit]').disabled,true);
 const final=Object.assign([{transcript:'کام بہتر کریں'}],{isFinal:true});
 rec.onresult({resultIndex:0,results:[final]});rec.onresult({resultIndex:0,results:[final]});
 assert.equal(form.elements.reason.value,'میری رائے کام بہتر کریں','final segment appended once');
 const interim=Object.assign([{transcript:'عارضی الفاظ'}],{isFinal:false});rec.onresult({resultIndex:1,results:[final,interim]});assert.ok(!form.elements.reason.value.includes('عارضی'));
 form.querySelector('[data-dictate-stop]').click();assert.equal(form.elements.reason.readOnly,false);assert.equal(form.querySelector('[type=submit]').disabled,false);
 form.elements.reason.value+='۔';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await delay();
 const suggestion=[...f.records.values()].find(v=>v.kind==='suggestion');assert.equal(suggestion.reason,'میری رائے کام بہتر کریں۔');assert.ok(!('audio' in suggestion));
 form.querySelector('[data-dictate]').click();const old=rec;voice.reset();old.onresult({resultIndex:0,results:[final]});assert.equal(form.elements.reason.value,'','late recognition discarded after reset');
 form.querySelector('[data-dictate]').click();rec.onerror({error:'not-allowed'});assert.equal(form.elements.reason.readOnly,false);assert.ok(form.querySelector('[data-dictate-status]').textContent.includes('اجازت'));
 assert.deepEqual(errors,[]);console.log('PASS v108 Urdu dictation, editable text, no duplicate/interim submission, permission denial and cancellation');
}

{
 const {w,f,errors}=await boot('owner');
 w.editStaffV84(phone);
 w.document.getElementById('staffEditMealV109Mode').value='monthly';
 w.document.getElementById('staffEditMealV109Rate').value='3000';
 w.document.getElementById('staffEditMealV109Include').checked=true;
 w.document.getElementById('staffEditFormV85').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await delay();
 const acc=f.records.get(base+'/staffAccounts/'+phone);assert.equal(acc.salary.mealMode,'monthly');assert.equal(acc.salary.mealRate,3000);assert.equal(acc.salary.mealInSalary,true);
 const ownerSalary=w.salaryCalcV101(phone,'2026-09');assert.equal(ownerSalary.mealSalary,3000);assert.equal(ownerSalary.final,4700);
 const staff=await boot('staff',[[base+'/staffAccounts/'+phone,acc]]);const own=staff.w.salaryReportForRangeV102(phone,'2026-09-01','2026-09-30');assert.equal(own.final,ownerSalary.final);assert.equal(own.mealSalary,3000);
 const pdf=model.reportDocument({tasks:[],salary:own});assert.ok(pdf.includes('کھانے کے پیسے'));assert.ok(pdf.includes('3,000'));
 w.editStaffV84(phone);assert.equal(w.document.getElementById('staffEditMealV109Mode').value,'monthly');assert.equal(w.document.getElementById('staffEditMealV109Include').checked,true);
 w.document.getElementById('staffEditMealV109Include').checked=false;w.document.getElementById('staffEditFormV85').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await delay();
 assert.equal(w.salaryCalcV101(phone,'2026-09').mealSalary,0);assert.equal(w.salaryCalcV101(phone,'2026-09').final,1700);
 assert.deepEqual(errors,[]);assert.deepEqual(staff.errors,[]);
 console.log('PASS v109 meal Add/Edit fields, persistence to staff account, monthly salary inclusion, matching staff/PDF and exclusion');
}

{
 const {w,f,errors}=await boot('owner'),newPhone='03000000009',alerts=[];w.alert=t=>alerts.push(t);
 const form=w.document.getElementById('staffFormV84');
 function fill(){w.document.getElementById('staffNameV84').value='New colleague';w.document.getElementById('staffPhoneV84').value=newPhone;w.document.getElementById('staffAddressV84').value='Shop';}
 fill();f.failNextCommit();form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await delay();
 assert.equal(f.records.has(base+'/staffAccounts/'+newPhone),false);assert.equal(w.getNoorDb().staff.some(s=>s.phone===newPhone),false,'failed create must not create local ghost');assert.equal(w.document.getElementById('staffPhoneV84').value,newPhone);
 form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await delay();
 assert.equal(f.records.get(base+'/staffAccounts/'+newPhone).name,'New colleague');assert.equal(w.getNoorDb().staff.filter(s=>s.phone===newPhone).length,1);
 fill();w.document.getElementById('staffNameV84').value='Overwrite attempt';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await delay();assert.equal(f.records.get(base+'/staffAccounts/'+newPhone).name,'New colleague');assert.ok(alerts.at(-1).includes('New colleague'),'real duplicate names existing account');
 const orphan='03000000008';w.db.staff.push({id:orphan,phone:orphan,name:'Local unfinished'});w.document.getElementById('staffPhoneV84').value=orphan;w.document.getElementById('staffNameV84').value='Recovered';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await delay();assert.equal(f.records.get(base+'/staffAccounts/'+orphan).name,'Recovered');
 w.document.querySelector('[data-tab="instructions"]').click();const instructions=w.document.getElementById('suInstructions');instructions.elements.opening.value='دکان صاف کریں\nسامان ترتیب دیں';instructions.elements.closing.value='لائٹس بند کریں\nتالے چیک کریں';instructions.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await delay();
 const config=f.records.get(base+'/staffConfig/main');assert.equal(config.shopOpeningInstructions,'دکان صاف کریں\nسامان ترتیب دیں');
 const staff=await boot('staff',[[base+'/staffConfig/main',config]]);assert.ok(staff.w.document.getElementById('suShopRoutines').textContent.includes('تالے چیک کریں'));assert.equal(staff.w.document.querySelectorAll('#suShopRoutines li').length,4);
 assert.deepEqual(errors,[]);assert.deepEqual(staff.errors,[]);console.log('PASS v110 failed-create retry, double-click, named duplicate, local orphan recovery, owner instructions to staff');
}
