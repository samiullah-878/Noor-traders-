// Deterministic in-memory SDK for application workflow tests, not a rules emulator.
export function fakeSdk({records=new Map(),initialUser=null}={}) {
  const auth={currentUser:initialUser},listeners=new Set(),authListeners=new Set();let n=0,chain=Promise.resolve(),failCommit=false;
  const path=(parent,parts)=>[parent?.path||'',...parts].filter(Boolean).join('/');
  const doc=(parent,...parts)=>({path:path(parent,parts.length?parts:['auto-'+(++n)]),kind:'doc',get id(){return this.path.split('/').at(-1)}});
  function snapshot(ref){
    const data=records.get(ref.path);
    return {id:ref.path.split('/').at(-1),ref,metadata:{fromCache:false},exists:()=>data!==undefined,data:()=>structuredClone(data),forEach(fn){
      for(const[k,v]of records)if(k.startsWith(ref.path+'/')&&!k.slice(ref.path.length+1).includes('/')&&(ref.filters||[]).every(f=>v[f.field]===f.value))fn({id:k.split('/').at(-1),ref:{path:k,kind:'doc',id:k.split('/').at(-1)},data:()=>structuredClone(v)});
    }};
  }
  function emit(paths=null){for(const entry of listeners)if(!paths||paths.some(p=>p===entry.ref.path||(p.startsWith(entry.ref.path+'/')&&!p.slice(entry.ref.path.length+1).includes('/'))))queueMicrotask(()=>{if(listeners.has(entry))entry.callback(snapshot(entry.ref))})}
  function user(u){auth.currentUser=u;for(const f of authListeners)queueMicrotask(()=>f(u))}
  function batch(){const writes=[];return{set:(r,d,o)=>writes.push(['set',r,d,o]),update:(r,d)=>writes.push(['set',r,d,{merge:true}]),delete:r=>writes.push(['delete',r]),async commit(){if(failCommit){failCommit=false;throw Object.assign(Error('Synthetic write failure'),{code:'unavailable'})}const changed=[];for(const [type,r,d,o]of writes){changed.push(r.path);if(type==='delete')records.delete(r.path);else records.set(r.path,structuredClone(o?.merge?{...records.get(r.path),...d}:d))}emit(changed)}}}
  const sdk={
    initializeApp:()=>({}),getFirestore:()=>({}),getAuth:()=>auth,
    collection:(parent,...parts)=>({path:path(parent,parts),kind:'collection'}),doc,
    query:(ref,...filters)=>({...ref,filters}),where:(field,op,value)=>({field,op,value}),
    getDoc:async ref=>snapshot(ref),getDocs:async ref=>snapshot(ref),
    async setDoc(ref,data,options){const b=batch();b.set(ref,data,options);await b.commit()},async deleteDoc(ref){const b=batch();b.delete(ref);await b.commit()},writeBatch:batch,
    onSnapshot(ref,...args){const callback=args.find(x=>typeof x==='function'),entry={ref,callback};listeners.add(entry);queueMicrotask(()=>{if(listeners.has(entry))callback(snapshot(ref))});return()=>listeners.delete(entry)},
    runTransaction(_fs,fn){const result=chain.then(async()=>{const b=batch();const ret=await fn({get:async r=>snapshot(r),set:b.set,update:b.update,delete:b.delete});await b.commit();return ret});chain=result.catch(()=>{});return result},
    onAuthStateChanged(_auth,callback){authListeners.add(callback);queueMicrotask(()=>callback(auth.currentUser));return()=>authListeners.delete(callback)},
    signOut:async()=>user(null),signInAnonymously:async()=>{const u={uid:'anonymous-'+(++n),isAnonymous:true};user(u);return{user:u}},
    signInWithEmailAndPassword:async(_a,email,password)=>{if(password!=='synthetic-owner-password')throw Object.assign(Error('Wrong password'),{code:'auth/invalid-credential'});const u={uid:'owner',email,isAnonymous:false};user(u);return{user:u}},
    setPersistence:async()=>{},browserLocalPersistence:{},EmailAuthProvider:{credential:()=>({})},reauthenticateWithCredential:async()=>{},updatePassword:async()=>{}
  };
  return {sdk,auth,records,changeUser:user,emit,failNextCommit:()=>{failCommit=true},listeners};
}
