const KEY='noor-traders-v79-standalone';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi'}).format(new Date());
const defaults={entries:[],categories:['بجلی کا بل','گیس / پانی','کرایہ','تنخواہ','چائے / کھانا','ٹرانسپورٹ','مرمت','موبائل / انٹرنیٹ','گھر کا خرچ','قرض / ادائیگی','فیس / ٹیکس','پیکنگ','دیگر'],stockItems:['صوفی گھی','صوفی آئل','صوفی آئل کی بڑی بوتل','صوفی آئل کی چھوٹی بوتل','مومن آئل کی بوتل','مومن آئل','مجاہد آئل کا پیکٹ','چینی','چاول بابا','چاول سپر','چاول سٹیم','سیلا چاول','دال ماش','گڑ','شکر','مجاہد گھی','شفیع گھی','ڈالڈا گھی','ڈالڈا آئل','بادام','لپٹن پتی','سپرِیم پتی','لائف شیمپو'].map((name,i)=>({id:i+1,name,unit:['چینی','چاول بابا','چاول سپر','چاول سٹیم','سیلا چاول','دال ماش','گڑ','شکر','بادام'].includes(name)?'کلو':'عدد',rate:0})),stockRecords:{},staff:[],attendance:{},purchases:[],batches:[]};
let db=load();
function load(){try{return Object.assign(structuredClone(defaults),JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{return structuredClone(defaults)}}
function save(){
  localStorage.setItem(KEY,JSON.stringify(db));
  renderAll();
  if(window.noorFirebaseSync && window.noorFirebaseSync.ready){
    window.noorFirebaseSync.saveState(structuredClone(db));
  }
}
window.getNoorDb=()=>structuredClone(db);
window.applyNoorDb=(next)=>{
  db=Object.assign(structuredClone(defaults),next||{});
  localStorage.setItem(KEY,JSON.stringify(db));
  renderAll();
};
window.getNoorDefaults=()=>structuredClone(defaults);
const money=n=>'Rs '+Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:2});
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const tabs=[['ledger','🏠 حساب کتاب'],['stock','📦 Stock'],['attendance','👥 Staff / حاضری'],['purchases','🧾 Purchase Pics'],['manufacturing','🏭 Batch Cost'],['reports','📊 Reports'],['settings','⚙️ Settings']];
nav.innerHTML=tabs.map(([id,l],i)=>`<button data-tab="${id}" class="${i?'':'active'}">${l}</button>`).join('');
nav.onclick=e=>{if(!e.target.dataset.tab)return;document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('#nav button').forEach(x=>x.classList.remove('active'));document.getElementById(e.target.dataset.tab).classList.add('active');e.target.classList.add('active')};

function fileData(file,max=800){return new Promise((res,rej)=>{if(!file)return res('');const r=new FileReader;r.onload=()=>{const im=new Image;im.onload=()=>{const c=document.createElement('canvas'),sc=Math.min(1,max/Math.max(im.width,im.height));c.width=im.width*sc;c.height=im.height*sc;c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.72))};im.onerror=rej;im.src=r.result};r.onerror=rej;r.readAsDataURL(file)})}
function setupDates(){['eDate','ledgerDate','stockDate','attDate','pDate','bDate'].forEach(id=>document.getElementById(id).value=today());reportMonth.value=today().slice(0,7);todayLabel.textContent=new Date().toLocaleString('ur-PK',{timeZone:'Asia/Karachi',dateStyle:'full'})}

entryForm.onsubmit=async e=>{e.preventDefault();const pic=await fileData(ePicture.files[0]);db.entries.push({id:Date.now(),date:eDate.value,type:eType.value,note:eNote.value,amount:+eAmount.value||0,category:eCategory.value,picture:pic});eNote.value='';eAmount.value='';ePicture.value='';save()};
function renderLedger(){const d=ledgerDate.value||today(),rows=db.entries.filter(x=>x.date===d).sort((a,b)=>b.id-a.id);ledgerRows.innerHTML=rows.map(x=>`<tr><td>${labelType(x.type)}</td><td>${esc(x.note)}</td><td>${esc(x.category||'')}</td><td class=amt>${money(x.amount)}</td><td>${x.picture?`<img class=photo src="${x.picture}">`:''}</td><td><button class=danger onclick="delEntry(${x.id})">Delete</button></td></tr>`).join('')||'<tr><td colspan=6 class=muted>کوئی entry نہیں</td></tr>';const todays=db.entries.filter(x=>x.date===today());let sale=sum(todays,'sale'),coll=sum(todays,'collection'),exp=sum(todays,'expense')+sum(todays,'shop_goods'),acc=sum(todays,'account'),ct=sum(todays,'change_today'),cy=sum(todays,'change_yesterday'),cash=sum(todays,'cash'),cashout=sum(todays,'cash_out');kpiSale.textContent=money(sale);kpiIn.textContent=money(sale+coll+cy+cash);kpiOut.textContent=money(exp+ct+acc+cashout);kpiBalance.textContent=money(sale+coll+cy+cash-exp-ct-acc-cashout)}
function labelType(t){return {sale:'سیل',collection:'وصولی',expense:'خرچ',shop_goods:'دکان کا سامان',pending_bill:'واجب الادا Bill',cash:'کل کی Cash',cash_out:'Cash',account:'اکاؤنٹ میں آمد',change_today:'آج کا Change',change_yesterday:'کل کا Change'}[t]||t}
function sum(a,t){return a.filter(x=>x.type===t).reduce((s,x)=>s+(+x.amount||0),0)}
function delEntry(id){if(confirm('Entry delete کریں؟')){db.entries=db.entries.filter(x=>x.id!==id);save()}}
function clearDay(){let d=ledgerDate.value;if(confirm(d+' کی تمام entries صاف کریں؟')){db.entries=db.entries.filter(x=>x.date!==d);save()}}

function renderCategories(){eCategory.innerHTML='<option value="">—</option>'+db.categories.map(x=>`<option>${esc(x)}</option>`).join('');catList.innerHTML=db.categories.map((x,i)=>`<span class=badge>${esc(x)} <b onclick="delCat(${i})" style="cursor:pointer">×</b></span> `).join('')}
function addCategory(){let v=newCat.value.trim();if(v&&!db.categories.includes(v)){db.categories.push(v);newCat.value='';save()}}
function delCat(i){db.categories.splice(i,1);save()}

function renderStock(){let d=stockDate.value||today(),r=db.stockRecords[d]||{};stockRows.innerHTML=db.stockItems.map(it=>{let x=r[it.id]||{},diff=(x.physical===''||x.system===''||x.physical==null||x.system==null)?'':(+x.physical-+x.system),val=diff===''?'':diff*(+it.rate||0);return `<tr data-id=${it.id}><td>${esc(it.name)}</td><td>${esc(it.unit)}</td><td><input class=rate type=number value="${it.rate||0}"></td><td><input class=system type=number value="${x.system??''}"></td><td><input class=physical type=number value="${x.physical??''}"></td><td class="${diff>0?'pos':diff<0?'neg':''}">${diff}</td><td>${val===''?'':money(val)}</td></tr>`}).join('')}
stockDate.onchange=renderStock;
function saveStock(){let d=stockDate.value,rec={};document.querySelectorAll('#stockRows tr').forEach(tr=>{let id=+tr.dataset.id,it=db.stockItems.find(x=>x.id===id);it.rate=+tr.querySelector('.rate').value||0;rec[id]={system:tr.querySelector('.system').value,physical:tr.querySelector('.physical').value}});db.stockRecords[d]=rec;save()}
function addStockItem(){let n=prompt('Item نام؟');if(n){db.stockItems.push({id:Date.now(),name:n,unit:prompt('Unit؟','عدد')||'عدد',rate:0});save()}}
function clearStockDay(){if(confirm('اس دن کا Stock صاف؟')){delete db.stockRecords[stockDate.value];save()}}
stockRows.addEventListener('input',e=>{let tr=e.target.closest('tr');if(!tr)return;let s=tr.querySelector('.system').value,p=tr.querySelector('.physical').value,d=(s===''||p==='')?'':(+p-+s),rate=+tr.querySelector('.rate').value||0;tr.children[5].textContent=d;tr.children[5].className=d>0?'pos':d<0?'neg':'';tr.children[6].textContent=d===''?'':money(d*rate)});

staffForm.onsubmit=e=>{e.preventDefault();db.staff.push({id:Date.now(),name:staffName.value,meal:staffMeal.value,mealAmount:+staffMealAmount.value||0});staffName.value='';save()};
function renderAttendance(){let d=attDate.value||today();db.attendance[d]??={};let rec=db.attendance[d];attRows.innerHTML=db.staff.map(s=>{let a=rec[s.id]||{};return `<tr><td>${esc(s.name)}</td><td>${s.meal} ${s.mealAmount?money(s.mealAmount):''}</td><td>${a.in||'-'}</td><td>${esc(a.location||'-')}</td><td>${a.out||'-'}</td><td><input class=score data-id=${s.id} type=number value="${a.score??''}" style="width:75px"></td><td><button class=soft onclick="checkIn(${s.id})">Check-in</button> <button class=soft onclick="checkOut(${s.id})">Checkout</button> <button class=danger onclick="delStaff(${s.id})">×</button></td></tr>`}).join('');let present=db.staff.filter(s=>rec[s.id]?.in).length,daily=db.staff.filter(s=>rec[s.id]?.in&&s.meal==='daily').reduce((z,s)=>z+s.mealAmount,0);attSummary.textContent=`حاضر ${present}/${db.staff.length} • Daily meal ${money(daily)}`}
attDate.onchange=renderAttendance;
function now(){return new Date().toLocaleTimeString('en-PK',{timeZone:'Asia/Karachi',hour:'2-digit',minute:'2-digit'})}
function checkIn(id){let d=attDate.value;db.attendance[d]??={};navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>{db.attendance[d][id]=Object.assign(db.attendance[d][id]||{},{in:now(),location:p.coords.latitude.toFixed(5)+','+p.coords.longitude.toFixed(5)});save()},()=>{db.attendance[d][id]=Object.assign(db.attendance[d][id]||{},{in:now(),location:'Permission نہیں'});save()}):0}
function checkOut(id){let d=attDate.value;db.attendance[d]??={};db.attendance[d][id]=Object.assign(db.attendance[d][id]||{},{out:now()});save()}
function saveScores(){let d=attDate.value;db.attendance[d]??={};document.querySelectorAll('.score').forEach(i=>{db.attendance[d][i.dataset.id]=Object.assign(db.attendance[d][i.dataset.id]||{},{score:i.value===''?'':+i.value})});save()}
function delStaff(id){if(confirm('Staff delete؟')){db.staff=db.staff.filter(x=>x.id!==id);save()}}

purchaseForm.onsubmit=async e=>{e.preventDefault();let fs=[...pPics.files].slice(0,5),pics=[];for(const f of fs)pics.push(await fileData(f,700));db.purchases.push({id:Date.now(),date:pDate.value,note:pNote.value,amount:+pAmount.value||0,status:pPending.value,pictures:pics});pNote.value='';pAmount.value='';pPics.value='';save()};
function renderPurchases(){purchaseRows.innerHTML=db.purchases.slice().reverse().map(x=>`<tr><td>${x.date}</td><td>${esc(x.note)}</td><td>${money(x.amount)}</td><td>${x.status}</td><td>${x.pictures.map(p=>`<img class=photo src="${p}">`).join(' ')}</td><td><button class=danger onclick="delPurchase(${x.id})">Delete</button></td></tr>`).join('')}
function delPurchase(id){db.purchases=db.purchases.filter(x=>x.id!==id);save()}

batchForm.onsubmit=e=>{e.preventDefault();let total=(+bMaterial.value||0)+(+bExtra.value||0),kg=+bKg.value||0;db.batches.push({id:Date.now(),date:bDate.value,name:bName.value,product:bProduct.value,kg,total,costKg:kg?total/kg:0});save()};
function renderBatches(){batchRows.innerHTML=db.batches.slice().reverse().map(x=>`<tr><td>${x.date}</td><td>${esc(x.name)}</td><td>${esc(x.product)}</td><td>${x.kg}</td><td>${money(x.total)}</td><td>${money(x.costKg)}</td><td><button class=danger onclick="delBatch(${x.id})">Delete</button></td></tr>`).join('')}
function delBatch(id){db.batches=db.batches.filter(x=>x.id!==id);save()}

function renderReport(){let m=reportMonth.value,es=db.entries.filter(x=>x.date.startsWith(m)),sales=sum(es,'sale'),coll=sum(es,'collection'),expense=sum(es,'expense'),goods=sum(es,'shop_goods'),pending=sum(es,'pending_bill'),acc=sum(es,'account');reportBox.innerHTML=`<h2>${m} Summary</h2><div class=grid><div class="card span3"><div class=kpi>Sales<strong>${money(sales)}</strong></div></div><div class="card span3"><div class=kpi>Wasooli<strong>${money(coll)}</strong></div></div><div class="card span3"><div class=kpi>Expenses<strong>${money(expense)}</strong></div></div><div class="card span3"><div class=kpi>Shop Goods<strong>${money(goods)}</strong></div></div></div><p>Pending Bills: <b>${money(pending)}</b> • Account incoming: <b>${money(acc)}</b></p>`}
function backupAll(){let blob=new Blob([JSON.stringify({format:'noor-traders-business-backup-html',version:79,createdAt:new Date().toISOString(),data:db},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Noor-Traders-Full-Migration-Backup-${today()}.json`;a.click();URL.revokeObjectURL(a.href)}
restoreFile.onchange=async()=>{try{let x=JSON.parse(await restoreFile.files[0].text());if(!x.data)throw Error();if(confirm('Backup restore ہونے سے موجود data replace ہوگا اور Firebase online data بھی sync ہو جائے گا۔ جاری رکھیں؟')){db=x.data;save()}}catch{alert('درست backup file نہیں')}};
function resetAll(){
  if(confirm('صرف اس browser کا local cache صاف ہوگا۔ Firebase online data delete نہیں ہوگا۔ جاری رکھیں؟')){
    localStorage.removeItem(KEY);
    location.reload();
  }
}
function renderAll(){renderCategories();renderLedger();renderStock();renderAttendance();renderPurchases();renderBatches();renderReport()}
setupDates();renderAll();
