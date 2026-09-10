// Optional gate. Requires a running local Firestore emulator; never uses production.
import {test,before,after} from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,collection,query,where,getDoc,getDocs,setDoc,updateDoc,writeBatch} from 'firebase/firestore';
import {createTask,submissionPatch,normalizeTask} from '../task-model.js';
if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Start a local Firestore emulator before running this gate.');
const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':'),base='businesses/noor-traders';
const phone='03000000001',other='03000000002',photo='data:image/jpeg;base64,/9j/2Q==';let env,owner,staff;
const task=createTask({phone,staffName:'Test employee',title:'Clean shelves',date:'2026-09-08',maxPoints:10},{role:'owner',uid:'owner'},'t1');
before(async()=>{
 env=await initializeTestEnvironment({projectId:'demo-noor-tasks',firestore:{host,port:Number(port),rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}});
 owner=env.authenticatedContext('owner',{email:'hp6235@gmail.com',firebase:{sign_in_provider:'password'}}).firestore();
 staff=env.authenticatedContext('staff',{firebase:{sign_in_provider:'anonymous'}}).firestore();
 await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();for(const p of [phone,other])await setDoc(doc(db,base+'/staffAccounts/'+p),{phone:p,active:true,loginEnabled:true});await setDoc(doc(db,base+'/staffSessions/staff'),{phone,createdAt:1});await setDoc(doc(db,base+'/staffTasks/t1'),task);await setDoc(doc(db,base+'/staffTasks/other'),{...task,id:'other',phone:other})});
});
after(async()=>env?.cleanup());
test('staff query is own-only; task assignments and points cannot be forged',async()=>{
 await assertSucceeds(getDocs(query(collection(staff,base+'/staffTasks'),where('phone','==',phone))));
 await assertFails(getDocs(collection(staff,base+'/staffTasks')));
 await assertFails(getDoc(doc(staff,base+'/staffTasks/other')));
 await assertFails(setDoc(doc(staff,base+'/staffTasks/forged'),task));
 for(const patch of [{points:100},{maxPoints:100},{phone:other},{status:'approved'},{title:'changed'}])await assertFails(updateDoc(doc(staff,base+'/staffTasks/t1'),patch));
 await assertSucceeds(getDoc(doc(owner,base+'/staffTasks/t1')));
});
test('legacy tasks with omitted date/status/revision accept an atomic picture submission',async()=>{
 const legacy={phone,title:'Legacy assigned work'};await assertSucceeds(setDoc(doc(owner,base+'/staffTasks/legacy'),legacy));
 const patch=submissionPatch(normalizeTask(legacy,'legacy'),{role:'staff',uid:'staff',phone},{photos:[photo],submissionId:'legacy-submission',expectedRevision:0});
 const b=writeBatch(staff);b.update(doc(staff,base+'/staffTasks/legacy'),patch);b.set(doc(staff,base+'/staffTasks/legacy/taskPhotos/'+patch.photoIds[0]),{taskId:'legacy',submissionId:patch.submissionId,dataUrl:photo,uploadedBy:'staff',createdAt:1});await assertSucceeds(b.commit());
 await assertFails(setDoc(doc(staff,base+'/staffTaskNotificationReads/owner'),{seen:['legacy::legacy-submission']}));
 await assertSucceeds(setDoc(doc(owner,base+'/staffTaskNotificationReads/owner'),{seen:['legacy::legacy-submission']}));
 await assertFails(getDoc(doc(staff,base+'/staffTaskNotificationReads/owner')));
});
test('8 pictures and submitted status succeed together; pictures cannot change after submission',async()=>{
 const patch=submissionPatch(task,{role:'staff',uid:'staff',phone},{photos:Array(8).fill(photo),submissionId:'test-submission',expectedRevision:0});
 const b=writeBatch(staff);b.update(doc(staff,base+'/staffTasks/t1'),patch);
 patch.photoIds.forEach(id=>b.set(doc(staff,base+'/staffTasks/t1/taskPhotos/'+id),{taskId:'t1',submissionId:patch.submissionId,dataUrl:photo,uploadedBy:'staff',createdAt:1}));
 await assertSucceeds(b.commit());
 await assertSucceeds(getDoc(doc(owner,base+'/staffTasks/t1/taskPhotos/'+patch.photoIds[0])));
 await assertFails(updateDoc(doc(staff,base+'/staffTasks/t1/taskPhotos/'+patch.photoIds[0]),{dataUrl:photo}));
 await assertFails(updateDoc(doc(staff,base+'/staffTasks/t1'),{points:10,status:'approved'}));
 await assertSucceeds(updateDoc(doc(owner,base+'/staffTasks/t1'),{points:7,status:'approved',reviewedBy:'owner'}));
 await assertFails(updateDoc(doc(staff,base+'/staffTasks/t1'),{status:'submitted',revision:2}));
});
test('another employee and disabled employee cannot read the evidence',async()=>{
 const second=env.authenticatedContext('second',{firebase:{sign_in_provider:'anonymous'}}).firestore();await assertSucceeds(setDoc(doc(second,base+'/staffSessions/second'),{phone:other,createdAt:1}));
 await assertFails(getDoc(doc(second,base+'/staffTasks/t1/taskPhotos/test-submission_0')));
 await assertSucceeds(updateDoc(doc(owner,base+'/staffAccounts/'+phone),{loginEnabled:false}));
 await assertFails(getDoc(doc(staff,base+'/staffTasks/t1')));await assertFails(getDoc(doc(staff,base+'/staffTasks/t1/taskPhotos/test-submission_0')));
});
test('v104 staff requests are own-only and approvals, payroll and schedules remain owner controlled',async()=>{
 const r={phone,kind:'leave',date:'2026-09-10',to:'2026-09-11',checkIn:'',checkOut:'',reason:'Family',status:'pending',createdAt:1,by:'staff'};
 await assertSucceeds(setDoc(doc(staff,base+'/staffRequests/r1'),r));
 await assertFails(setDoc(doc(staff,base+'/staffRequests/forged'),{...r,phone:other}));
 await assertFails(updateDoc(doc(staff,base+'/staffRequests/r1'),{status:'approved'}));
 await assertSucceeds(updateDoc(doc(owner,base+'/staffRequests/r1'),{status:'approved'}));
 await assertSucceeds(getDocs(query(collection(staff,base+'/staffRequests'),where('phone','==',phone))));
 await assertFails(getDocs(collection(staff,base+'/staffRequests')));
 for(const n of ['staffPayroll','staffSchedules']){
  await assertSucceeds(setDoc(doc(owner,base+'/'+n+'/own'),{phone}));
  await assertSucceeds(setDoc(doc(owner,base+'/'+n+'/other'),{phone:other}));
  await assertSucceeds(getDoc(doc(staff,base+'/'+n+'/own')));
  await assertFails(getDoc(doc(staff,base+'/'+n+'/other')));
  await assertFails(setDoc(doc(staff,base+'/'+n+'/own'),{phone,paid:999}));
 }
 await assertFails(getDocs(collection(staff,base+'/staffAudit')));
});
test('v107 suggestion belongs to sender and staff cannot mark it reviewed',async()=>{
 const r={phone,kind:'suggestion',date:'2026-09-10',to:'2026-09-10',checkIn:'',checkOut:'',reason:'کام بہتر بنائیں',status:'pending',createdAt:1,by:'staff'};
 await assertSucceeds(setDoc(doc(staff,base+'/staffRequests/suggestion'),r));
 await assertFails(setDoc(doc(staff,base+'/staffRequests/spoofed-suggestion'),{...r,phone:other}));
 await assertFails(updateDoc(doc(staff,base+'/staffRequests/suggestion'),{status:'reviewed'}));
 await assertSucceeds(updateDoc(doc(owner,base+'/staffRequests/suggestion'),{status:'reviewed'}));
});
