// Pure task accounting and state transitions. Firestore rules enforce the same boundaries.
export const MAX_PHOTOS = 8;
export const MAX_PHOTO_CHARS = 280000;
export const STATUS = Object.freeze({assigned:'کام باقی ہے',submitted:'مالک کی منظوری باقی ہے',approved:'منظور / OK',changes_requested:'دوبارہ کام / تصاویر بھیجیں'});
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function requireValue(ok, message) { if (!ok) throw new Error(message); }
export function workDate() { return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi'}).format(new Date()); }
export function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
}
export function validPhoto(data) { return typeof data==='string' && data.length<=MAX_PHOTO_CHARS && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(data); }
export function taskMillis(value) {
  if(value&&typeof value.toMillis==='function')value=value.toMillis();
  else if(value&&typeof value==='object'&&Number.isFinite(value.seconds))value=value.seconds*1000;
  else if(value instanceof Date)value=value.getTime();
  else if(typeof value==='string')value=Date.parse(value);
  return Number.isFinite(value)&&value>=0&&value<=8640000000000000?value:0;
}
// Older tasks can omit date/revision/status. Keep them usable without overwriting
// their assignment or inventing a work date. Normalize at both read and write boundaries.
export function normalizeTask(value,id='') {
  const t=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const text=(...values)=>values.find(v=>typeof v==='string'&&v.trim())?.trim()||'';
  const assignedAt=taskMillis(t.assignedAt||t.createdAt),candidate=text(t.date,t.workDate,t.dueDate);
  const date=validDate(candidate)?candidate:assignedAt?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi'}).format(new Date(assignedAt)):'';
  const maxPoints=Number.isInteger(Number(t.maxPoints))&&Number(t.maxPoints)>=0?Number(t.maxPoints):10;
  return {...t,id:text(id,t.id),phone:text(t.phone),staffName:text(t.staffName,t.name,t.phone),title:text(t.title,t.taskName,t.task)||'دکان کا کام',details:text(t.details,t.description),date,
    status:text(t.status)||'assigned',assignedAt,maxPoints,revision:Number.isInteger(t.revision)&&t.revision>=0?t.revision:0,
    submissionId:text(t.submissionId),submittedAt:taskMillis(t.submittedAt),points:Number.isFinite(Number(t.points))?Number(t.points):0,
    photoIds:Array.isArray(t.photoIds)?t.photoIds.filter(v=>typeof v==='string'&&v&&!v.includes('/')):[],staffNote:text(t.staffNote),ownerNote:text(t.ownerNote)};
}
export function normalizeTasks(value) { return (Array.isArray(value)?value:[]).filter(t=>t&&typeof t==='object'&&!Array.isArray(t)).map(t=>normalizeTask(t)); }
export function createTask(input, actor, id, now=Date.now()) {
  requireValue(actor?.role==='owner','صرف مالک نیا کام دے سکتا ہے۔');
  const title=String(input.title||'').trim(),details=String(input.details||'').trim(),maxPoints=Number(input.maxPoints);
  requireValue(/^03\d{9}$/.test(input.phone),'ملازم کا محفوظ شدہ موبائل نمبر منتخب کریں۔');
  requireValue(title.length>0&&title.length<=160,'کام کا نام 1 سے 160 حروف میں لکھیں۔');
  requireValue(details.length<=2000,'تفصیل زیادہ سے زیادہ 2000 حروف میں لکھیں۔');
  requireValue(validDate(input.date),'کام کی درست تاریخ منتخب کریں۔');
  requireValue(Number.isInteger(maxPoints)&&maxPoints>=0&&maxPoints<=1000,'زیادہ سے زیادہ پوائنٹس 0 سے 1000 درج کریں۔');
  return {id,phone:input.phone,staffName:String(input.staffName||input.phone),title,details,date:input.date,maxPoints,status:'assigned',assignedBy:actor.uid,assignedAt:now,revision:0,submissionId:'',photoIds:[],staffNote:'',submittedBy:'',submittedAt:0,points:0,ownerNote:'',reviewedBy:'',reviewedAt:0};
}
export function submissionPatch(task, actor, input, now=Date.now()) {
  requireValue(actor?.role==='staff'&&actor.phone===task.phone,'آپ صرف اپنا کام جمع کر سکتے ہیں۔');
  requireValue(['assigned','changes_requested'].includes(task.status),'یہ کام جمع ہو چکا ہے۔ مالک کی تصدیق کا انتظار کریں۔');
  requireValue(task.revision===input.expectedRevision,'کام میں تبدیلی ہوئی ہے۔ اسے دوبارہ کھولیں۔');
  requireValue(Array.isArray(input.photos)&&input.photos.length>=1&&input.photos.length<=MAX_PHOTOS,`1 سے ${MAX_PHOTOS} تصاویر شامل کریں۔`);
  requireValue(input.photos.every(validPhoto),'تصویر تیار نہیں ہوئی۔ دوبارہ منتخب کریں۔');
  requireValue(/^[A-Za-z0-9_-]{8,80}$/.test(input.submissionId),'تصاویر دوبارہ منتخب کرکے کوشش کریں۔');
  const note=String(input.staffNote||'').trim();requireValue(note.length<=2000,'نوٹ زیادہ سے زیادہ 2000 حروف کا ہو۔');
  return {status:'submitted',revision:task.revision+1,submissionId:input.submissionId,photoIds:input.photos.map((_,i)=>input.submissionId+'_'+i),staffNote:note,submittedBy:actor.uid,submittedAt:now};
}
export function reviewPatch(task, actor, input, now=Date.now()) {
  requireValue(actor?.role==='owner','صرف مالک کام منظور کر سکتا ہے۔');
  requireValue(task.status==='submitted'&&task.revision===input.expectedRevision&&task.submissionId===input.submissionId,'یہ جمع شدہ کام بدل چکا ہے یا اس کی تصدیق ہو چکی ہے۔ دوبارہ کھولیں۔');
  requireValue(['approved','changes_requested'].includes(input.status),'درست فیصلہ منتخب کریں۔');
  const points=Number(input.points),ownerNote=String(input.ownerNote||'').trim();
  requireValue(ownerNote.length<=2000,'نوٹ زیادہ سے زیادہ 2000 حروف کا ہو۔');
  requireValue(input.status!=='changes_requested'||ownerNote.length>0,'دوبارہ کام کی وجہ لکھیں۔');
  requireValue(input.status!=='approved'||(Number.isInteger(points)&&points>=0&&points<=task.maxPoints),'پوائنٹس مقررہ حد کے اندر درج کریں۔');
  return {status:input.status,points:input.status==='approved'?points:0,ownerNote,reviewedBy:actor.uid,reviewedAt:now};
}
export function selectTasks(tasks,{phone='',from='',to='',status=''}={}) {
  requireValue(!from||!to||from<=to,'شروع کی تاریخ آخری تاریخ سے پہلے ہونی چاہیے۔');
  return normalizeTasks(tasks).filter(t=>(!phone||t.phone===phone)&&(!from||(t.date&&t.date>=from))&&(!to||(t.date&&t.date<=to))&&(!status||t.status===status)).sort((a,b)=>b.date.localeCompare(a.date)||b.assignedAt-a.assignedAt||a.id.localeCompare(b.id));
}
export function taskTotals(tasks) {
  tasks=normalizeTasks(tasks);
  return {total:tasks.length,approved:tasks.filter(t=>t.status==='approved').length,pending:tasks.filter(t=>t.status==='submitted').length,points:tasks.reduce((n,t)=>n+(t.status==='approved'?Number(t.points)||0:0),0),possible:tasks.reduce((n,t)=>n+Number(t.maxPoints||0),0)};
}
const workHoursTextV101=rec=>(typeof globalThis!=='undefined'&&globalThis.whTextV101)?globalThis.whTextV101(rec):'—';

export function reportDocument({tasks,photos=new Map(),title='Staff Picture & Points Report',subtitle='',attendance=[],salary=null,includePhotos=false}) {
  tasks=normalizeTasks(tasks);
  const e=escapeHtml,totals=taskTotals(tasks),attendancePoints=attendance.reduce((n,a)=>n+Number(a.finalScore??a.autoScore??0),0);
  const people=[...new Set(tasks.map(t=>t.phone))].map(phone=>{const own=tasks.filter(t=>t.phone===phone),s=taskTotals(own);return `<tr><td>${e(own[0].staffName)} • ${e(phone)}</td><td>${s.total}</td><td>${s.approved}</td><td>${s.points}</td></tr>`}).join('');
  const evidence=tasks.map(t=>`<article><h3>${e(t.title)}</h3><p>${e(t.staffName)} • ${e(t.phone)} • ${e(t.date)}</p><p class="note">${e(t.details)}</p><p><b>${e(STATUS[t.status]||t.status)}</b> • پوائنٹس: <b>${t.status==='approved'?Number(t.points):0} / ${Number(t.maxPoints)}</b></p><p class="note">ملازم: ${e(t.staffNote||'—')}<br>مالک: ${e(t.ownerNote||'—')}</p>${includePhotos?`<div class="photos">${(t.photoIds||[]).map((id,i)=>{const data=photos.get(t.id+'/'+id);requireValue(validPhoto(data),'رپورٹ کی تمام تصاویر ابھی لوڈ نہیں ہوئیں۔ دوبارہ کوشش کریں۔');return `<figure><img src="${data}" alt="${e(t.title)} — ${i+1}"><figcaption>${e(t.staffName)} — تصویر ${i+1}</figcaption></figure>`}).join('')}</div>`:''}</article>`).join('');
  const lateDays=attendance.filter(a=>Number(a.minutesLate||0)>10).length,scored=attendance.filter(a=>a.finalScore!=null||a.autoScore!=null);
  const average=scored.length?(attendancePoints/scored.length).toFixed(1):'—';
  const att=attendance.length?`<h2>Attendance / حاضری</h2><p>حاضری ریکارڈ: ${attendance.length} • دیر والے دن: ${lateDays} • اوسط اسکور: ${average}</p><p>حاضری کے پوائنٹس: ${attendancePoints} • ٹاسک پوائنٹس: ${totals.points} • مجموعہ: ${attendancePoints+totals.points}</p><table class="attendance"><thead><tr><th>تاریخ</th><th>Check-In</th><th>Late min</th><th>Auto</th><th>حاضری پوائنٹس</th><th>Check-Out</th><th>کام کے گھنٹے</th><th>Distance</th><th>مالک کا نوٹ</th></tr></thead><tbody>${attendance.map(a=>`<tr><td>${e(a.date)}</td><td>${e(a.checkIn||'—')}</td><td>${Math.max(0,Math.round(a.minutesLate||0))}</td><td>${e(a.autoScore??'—')}</td><td>${e(a.finalScore??a.autoScore??'—')}</td><td>${e(a.checkOut||'—')}</td><td>${e(workHoursTextV101(a))}</td><td>${a.checkInDistance!=null?Math.round(a.checkInDistance)+'m':'—'}</td><td>${e(a.ownerNote||'—')}</td></tr>`).join('')}</tbody></table>`:'';
  const rs=n=>'Rs '+Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:2});
  const hm=min=>{const m=Math.max(0,Math.round(Number(min)||0));return Math.floor(m/60)+'h '+String(m%60).padStart(2,'0')+'m'};
  const sal=salary?`<section class="salary-report"><h2>Salary / تنخواہ</h2><p><b>${e(salary.periodLabel||salary.month||'منتخب مہینہ')}</b> • یہ حساب Check-In/Check-Out، حاضری اور منظور شدہ Task Points سے بنا ہے۔</p><div class="salary-total"><span>آخری قابلِ ادائیگی تنخواہ</span><b>${rs(salary.final)}</b></div><table><tbody>
    <tr><th>مقررہ ماہانہ تنخواہ</th><td>${rs(salary.monthlySalary)}</td><th>ضروری گھنٹے</th><td>${Number(salary.expectedHours||0).toFixed(1)}h</td></tr>
    <tr><th>عام کام کے گھنٹے</th><td>${hm(salary.normalMin)}</td><th>گھنٹوں کی تنخواہ</th><td>${rs(salary.normalSalary)}</td></tr>
    <tr><th>اوور ٹائم</th><td>${hm(salary.otMin)}</td><th>اوور ٹائم رقم</th><td>+ ${rs(salary.overtimeAmount)}</td></tr>
    <tr><th>پوائنٹس</th><td>${Number(salary.points||0)} (حاضری ${Number(salary.attPoints||0)} + کام ${Number(salary.taskPoints||0)})</td><th>پوائنٹس کی رقم</th><td>+ ${rs(salary.pointsAmount)}</td></tr>
    <tr><th>کھانے کے پیسے</th><td>${rs(salary.mealTotal)}</td><th>تنخواہ میں شامل کھانا</th><td>+ ${rs(salary.mealSalary)}</td></tr>
    <tr><th>مالک کی شامل کردہ رقم</th><td>+ ${rs(salary.bonus)}</td><th>Advance / کٹوتی</th><td>− ${rs(salary.advance)}</td></tr>
  </tbody></table>${salary.openDays?`<p class="warn">${Number(salary.openDays)} دن کا Check-Out نہیں ہوا، اس لیے ان کے گھنٹے تنخواہ میں شامل نہیں ہوئے۔</p>`:''}</section>`:'';
  return `<!doctype html><html lang="ur" dir="rtl"><head><meta charset="utf-8"><title>${e(title)}</title><style>@page{size:A4;margin:13mm}body{font:14px/1.65 Arial,sans-serif;color:#17302d;padding:12px}h1{font-size:24px;color:#0f766e}h2{font-size:19px}h3{margin:0;font-size:17px}table{width:100%;border-collapse:collapse;margin:14px 0}th,td{border:1px solid #d2dedb;padding:8px;text-align:right}th{background:#eaf4f0}article{border-top:2px solid #b8d9ce;padding:15px 0;break-inside:auto}article h3{break-after:avoid}p{margin:6px 0}.note{white-space:pre-wrap;overflow-wrap:anywhere}.totals{background:#eaf4f0;padding:14px}.photos{display:block}figure{display:inline-block;vertical-align:top;width:46%;margin:8px 1%;break-inside:avoid}img{display:block;width:100%;max-height:95mm;object-fit:contain}figcaption{font-size:12px;text-align:center}thead{display:table-header-group}.attendance{font-size:11px}.attendance th,.attendance td{padding:5px;overflow-wrap:anywhere}.salary-report{break-before:page}.salary-total{display:flex;justify-content:space-between;gap:18px;background:#0f766e;color:#fff;padding:14px;border-radius:10px}.salary-total span,.salary-total b{display:block}.salary-total b{font-size:22px}.warn{color:#92400e;background:#fff7ed;padding:8px}@media print{body{padding:0}article{box-shadow:none}}</style></head><body><h1>Noor Traders Gulyana</h1><h2>${e(title)}</h2><p>${e(subtitle)}</p><div class="totals">کل کام: ${totals.total} • منظور شدہ: ${totals.approved} • منظوری باقی: ${totals.pending}<br><b>منظور شدہ ٹاسک پوائنٹس: ${totals.points}</b> / مقررہ ${totals.possible}<br>صرف منظور شدہ کام کے پوائنٹس جمع کیے گئے ہیں۔ تاریخ کا حساب کام کی مقررہ تاریخ سے ہے۔</div><table><thead><tr><th>ملازم</th><th>کام</th><th>منظور</th><th>ٹاسک پوائنٹس</th></tr></thead><tbody>${people||'<tr><td colspan="4">اس مدت میں کوئی کام نہیں۔</td></tr>'}</tbody></table>${evidence}${att}${sal}</body></html>`;
}
