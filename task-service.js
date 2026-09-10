import {createTask,submissionPatch,reviewPatch,validPhoto,requireValue,normalizeTask} from './task-model.js';
import {isOwnerUser} from './auth-controller.js';

export function createTaskService({fs,auth,sdk,getStaffPhone,businessId='noor-traders'}) {
  const {collection,doc,getDoc,getDocs,query,where,onSnapshot,runTransaction,writeBatch}=sdk;
  const tasks=collection(fs,'businesses',businessId,'staffTasks');
  function actor() {
    const user=auth.currentUser;
    if(isOwnerUser(user))return {role:'owner',uid:user.uid};
    const phone=getStaffPhone();
    requireValue(user?.isAnonymous&&/^03\d{9}$/.test(phone),'پہلے اپنے اکاؤنٹ میں لاگ اِن کریں۔');
    return {role:'staff',uid:user.uid,phone};
  }
  function unchanged(a) { const b=actor();requireValue(a.uid===b.uid&&a.phone===b.phone,'اکاؤنٹ تبدیل ہو گیا۔ دوبارہ کوشش کریں۔'); }
  return {
    actor,
    listen(next,error) {
      const a=actor(),ref=a.role==='owner'?tasks:query(tasks,where('phone','==',a.phone));
      return onSnapshot(ref,{includeMetadataChanges:true},s=>{try{unchanged(a);const list=[];s.forEach(d=>list.push(normalizeTask(d.data(),d.id)));next(list,!!s.metadata?.fromCache)}catch(e){error(e)}},error);
    },
    listenNotificationReads(next,error) {
      const a=actor();requireValue(a.role==='owner','یہ اطلاعات صرف مالک کے لیے ہیں۔');
      const ref=doc(fs,'businesses',businessId,'staffTaskNotificationReads',a.uid);
      return onSnapshot(ref,s=>{try{unchanged(a);next(s.exists()&&Array.isArray(s.data().seen)?s.data().seen.filter(x=>typeof x==='string'):[])}catch(e){error(e)}},error);
    },
    async markNotificationsRead(keys) {
      const a=actor();requireValue(a.role==='owner','یہ اطلاعات صرف مالک کے لیے ہیں۔');
      requireValue(Array.isArray(keys)&&keys.length<=100&&keys.every(k=>typeof k==='string'&&k.length<=250),'درست اطلاع منتخب کریں۔');
      const ref=doc(fs,'businesses',businessId,'staffTaskNotificationReads',a.uid);
      await runTransaction(fs,async tx=>{const s=await tx.get(ref);unchanged(a);const old=s.exists()&&Array.isArray(s.data().seen)?s.data().seen:[];tx.set(ref,{seen:[...new Set([...old,...keys])].slice(-1000),updatedAt:Date.now()})});
    },
    async assign(input) {
      const a=actor(),ref=doc(tasks),task=createTask(input,a,ref.id);
      await runTransaction(fs,async tx=>{
        const account=await tx.get(doc(fs,'businesses',businessId,'staffAccounts',task.phone));unchanged(a);
        requireValue(account.exists()&&account.data().active!==false&&account.data().loginEnabled!==false,'ملازم کا فعال اکاؤنٹ پہلے محفوظ کریں۔');
        tx.set(ref,{...task,staffName:account.data().name||task.phone});
      });
      return task.id;
    },
    async submit(id,input) {
      const a=actor(),ref=doc(tasks,id);
      await runTransaction(fs,async tx=>{
        const s=await tx.get(ref);unchanged(a);requireValue(s.exists(),'کام دستیاب نہیں رہا۔');
        const patch=submissionPatch(normalizeTask(s.data(),id),a,input);
        tx.update(ref,patch);
        input.photos.forEach((dataUrl,i)=>tx.set(doc(ref,'taskPhotos',patch.photoIds[i]),{taskId:id,submissionId:patch.submissionId,dataUrl,uploadedBy:a.uid,createdAt:patch.submittedAt}));
      });
    },
    async photos(task) {
      const a=actor();requireValue(a.role==='owner'||a.phone===task.phone,'اس کام کی اجازت نہیں۔');
      const result=await Promise.all((task.photoIds||[]).map(async id=>{
        const s=await getDoc(doc(tasks,task.id,'taskPhotos',id));unchanged(a);
        requireValue(s.exists()&&s.data().submissionId===task.submissionId&&validPhoto(s.data().dataUrl),'تصویر مکمل لوڈ نہیں ہوئی۔ انٹرنیٹ چیک کرکے دوبارہ کھولیں۔');
        return [task.id+'/'+id,s.data().dataUrl];
      }));
      return new Map(result);
    },
    async review(id,input) {
      const a=actor(),ref=doc(tasks,id);
      await runTransaction(fs,async tx=>{
        const s=await tx.get(ref);unchanged(a);requireValue(s.exists(),'کام دستیاب نہیں رہا۔');
        tx.update(ref,reviewPatch(normalizeTask(s.data(),id),a,input));
      });
    },
    async migratePhone(oldPhone,newPhone,name) {
      const a=actor();requireValue(a.role==='owner','صرف مالک پروفائل بدل سکتا ہے۔');
      const snapshot=await getDocs(query(tasks,where('phone','==',oldPhone))),refs=[];
      snapshot.forEach(d=>refs.push(d.ref||doc(tasks,d.id)));
      // Photos resolve access through their parent task; their paths never change.
      for(let i=0;i<refs.length;i+=350){unchanged(a);const b=writeBatch(fs);for(const ref of refs.slice(i,i+350))b.update(ref,{phone:newPhone,staffName:name||newPhone});await b.commit()}
    }
  };
}
