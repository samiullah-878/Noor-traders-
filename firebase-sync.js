import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  getFirestore, collection, doc, onSnapshot, writeBatch
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const BUSINESS_ID = "noor-traders";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const fs = getFirestore(app);

const loginGate = document.getElementById("loginGate");
const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginMessage = document.getElementById("loginMessage");
const loginBtn = document.getElementById("loginBtn");
const cloudStatus = document.getElementById("cloudStatus");
const userBar = document.getElementById("userBar");
const userEmail = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");

const remote = {
  settings: null,
  entries: new Map(),
  entryPictures: new Map(),
  staff: new Map(),
  purchases: new Map(),
  purchasePictures: new Map(),
  batches: new Map(),
  attendance: new Map(),
  stockRecords: new Map()
};
const requiredSegments = new Set(Object.keys(remote));
const readySegments = new Set();
let unsubscribers = [];
let initialResolved = false;
let lastPushed = null;
let saveTimer = null;
let applyingRemote = false;

function setCloud(text, type="warn"){
  if(!cloudStatus) return;
  cloudStatus.textContent = text;
  cloudStatus.className = type==="ok" ? "sync-ok" : type==="bad" ? "sync-bad" : "sync-warn";
}

function clean(v){
  return JSON.parse(JSON.stringify(v));
}
function same(a,b){
  return JSON.stringify(a) === JSON.stringify(b);
}
function mapById(arr){
  const m = new Map();
  for(const x of arr || []) m.set(String(x.id), clean(x));
  return m;
}
function mapObject(obj){
  return new Map(Object.entries(obj || {}).map(([k,v])=>[String(k), clean(v)]));
}
function mapPictures(state){
  const entryPictures = new Map();
  for(const e of state.entries || []){
    if(e.picture) entryPictures.set(String(e.id), {entryId:e.id, data:e.picture});
  }
  const purchasePictures = new Map();
  for(const p of state.purchases || []){
    (p.pictures || []).forEach((data,index)=>{
      if(data) purchasePictures.set(`${p.id}_${index}`, {purchaseId:p.id,index,data});
    });
  }
  return {entryPictures,purchasePictures};
}
function stripPictures(state){
  return {
    settings: {
      categories: clean(state.categories || []),
      stockItems: clean(state.stockItems || []),
      salaryConfig: clean(state.salaryConfig || {}),
      salaryExtras: clean(state.salaryExtras || {})
    },
    entries: mapById((state.entries || []).map(({picture,...x})=>x)),
    staff: mapById(state.staff || []),
    purchases: mapById((state.purchases || []).map(({pictures,...x})=>x)),
    batches: mapById(state.batches || []),
    attendance: mapObject(state.attendance || {}),
    stockRecords: mapObject(state.stockRecords || {}),
    ...mapPictures(state)
  };
}

function buildRemoteState(){
  const defaults = window.getNoorDefaults ? window.getNoorDefaults() : {};
  const state = Object.assign({}, defaults);

  state.categories = clean(remote.settings?.categories || defaults.categories || []);
  state.stockItems = clean(remote.settings?.stockItems || defaults.stockItems || []);
  state.salaryConfig = clean(remote.settings?.salaryConfig || defaults.salaryConfig || {});
  state.salaryExtras = clean(remote.settings?.salaryExtras || defaults.salaryExtras || {});

  state.entries = [...remote.entries.values()].map(x=>{
    const pic = remote.entryPictures.get(String(x.id));
    return {...clean(x), picture: pic?.data || ""};
  });

  state.staff = [...remote.staff.values()].map(clean);
  for(const staff of state.staff){
    let phone=String(staff.phone||staff.id||'').replace(/\D/g,'');
    if(phone.startsWith('92')&&phone.length===12)phone='0'+phone.slice(2);
    if(phone&&!state.salaryConfig[phone]&&staff.salary)state.salaryConfig[phone]=clean(staff.salary);
    if(phone&&!state.salaryExtras[phone]&&Array.isArray(staff.salaryExtras))state.salaryExtras[phone]=clean(staff.salaryExtras);
  }

  const picsByPurchase = new Map();
  for(const p of remote.purchasePictures.values()){
    const key = String(p.purchaseId);
    if(!picsByPurchase.has(key)) picsByPurchase.set(key, []);
    picsByPurchase.get(key)[Number(p.index)||0] = p.data;
  }
  state.purchases = [...remote.purchases.values()].map(x=>({
    ...clean(x),
    pictures: (picsByPurchase.get(String(x.id)) || []).filter(Boolean)
  }));

  state.batches = [...remote.batches.values()].map(clean);
  state.attendance = Object.fromEntries([...remote.attendance.entries()].map(([k,v])=>[k,clean(v)]));
  state.stockRecords = Object.fromEntries([...remote.stockRecords.entries()].map(([k,v])=>[k,clean(v)]));

  return state;
}

function remoteHasData(){
  if(remote.settings) return true;
  return [
    remote.entries, remote.entryPictures, remote.staff, remote.purchases,
    remote.purchasePictures, remote.batches, remote.attendance, remote.stockRecords
  ].some(m=>m.size>0);
}

function allReady(){
  return [...requiredSegments].every(x=>readySegments.has(x));
}

async function applyOrSeed(){
  if(!allReady()) return;

  if(!initialResolved){
    initialResolved = true;

    if(remoteHasData()){
      const state = buildRemoteState();
      applyingRemote = true;
      window.applyNoorDb?.(state);
      applyingRemote = false;
      lastPushed = stripPictures(state);
      window.noorFirebaseSync.ready = true;
      setCloud("Online sync تیار ہے", "ok");
    } else {
      const local = window.getNoorDb?.() || window.getNoorDefaults?.() || {};
      lastPushed = {
        settings:null,
        entries:new Map(), entryPictures:new Map(), staff:new Map(),
        purchases:new Map(), purchasePictures:new Map(), batches:new Map(),
        attendance:new Map(), stockRecords:new Map()
      };
      window.noorFirebaseSync.ready = true;
      setCloud("پہلا data Firebase پر محفوظ ہو رہا ہے…");
      await saveStateNow(local);
      setCloud("Online sync تیار ہے", "ok");
    }
    return;
  }

  if(!applyingRemote){
    const state = buildRemoteState();
    applyingRemote = true;
    window.applyNoorDb?.(state);
    applyingRemote = false;
    lastPushed = stripPictures(state);
    setCloud("Online sync ہو گیا", "ok");
  }
}

function listenMap(segment, colName){
  const ref = collection(fs, "businesses", BUSINESS_ID, colName);
  const un = onSnapshot(ref, snap=>{
    const m = new Map();
    snap.forEach(d=>m.set(d.id, clean(d.data())));
    remote[segment] = m;
    readySegments.add(segment);
    applyOrSeed();
  }, err=>{
    console.error(err);
    setCloud("Firestore sync error", "bad");
  });
  unsubscribers.push(un);
}

function startListeners(){
  stopListeners();
  readySegments.clear();
  initialResolved = false;
  lastPushed = null;

  const settingsRef = doc(fs, "businesses", BUSINESS_ID, "settings", "main");
  unsubscribers.push(onSnapshot(settingsRef, snap=>{
    remote.settings = snap.exists() ? clean(snap.data()) : null;
    readySegments.add("settings");
    applyOrSeed();
  }, err=>{
    console.error(err);
    setCloud("Firestore settings error", "bad");
  }));

  listenMap("entries", "entries");
  listenMap("entryPictures", "entryPictures");
  listenMap("staff", "staff");
  listenMap("purchases", "purchases");
  listenMap("purchasePictures", "purchasePictures");
  listenMap("batches", "batches");
  listenMap("attendance", "attendance");
  listenMap("stockRecords", "stockRecords");
}

function stopListeners(){
  for(const un of unsubscribers) try{un()}catch{}
  unsubscribers = [];
}

function collectionRef(name){
  return collection(fs, "businesses", BUSINESS_ID, name);
}

function addMapOps(ops, name, current, previous){
  previous = previous || new Map();
  for(const [id, value] of current.entries()){
    if(!previous.has(id) || !same(value, previous.get(id))){
      ops.push({type:"set", ref:doc(collectionRef(name), id), data:clean(value)});
    }
  }
  for(const [id] of previous.entries()){
    if(!current.has(id)){
      ops.push({type:"delete", ref:doc(collectionRef(name), id)});
    }
  }
}

async function commitOps(ops){
  const chunkSize = 400;
  for(let i=0;i<ops.length;i+=chunkSize){
    const batch = writeBatch(fs);
    for(const op of ops.slice(i,i+chunkSize)){
      if(op.type==="set") batch.set(op.ref, op.data);
      else batch.delete(op.ref);
    }
    await batch.commit();
  }
}

async function saveStateNow(state){
  if(!auth.currentUser || applyingRemote) return;
  const cur = stripPictures(clean(state));
  const prev = lastPushed || {
    settings:null,
    entries:new Map(), entryPictures:new Map(), staff:new Map(),
    purchases:new Map(), purchasePictures:new Map(), batches:new Map(),
    attendance:new Map(), stockRecords:new Map()
  };

  const ops = [];
  if(!prev.settings || !same(cur.settings, prev.settings)){
    ops.push({
      type:"set",
      ref:doc(fs, "businesses", BUSINESS_ID, "settings", "main"),
      data:clean(cur.settings)
    });
  }

  addMapOps(ops, "entries", cur.entries, prev.entries);
  addMapOps(ops, "entryPictures", cur.entryPictures, prev.entryPictures);
  addMapOps(ops, "staff", cur.staff, prev.staff);
  addMapOps(ops, "purchases", cur.purchases, prev.purchases);
  addMapOps(ops, "purchasePictures", cur.purchasePictures, prev.purchasePictures);
  addMapOps(ops, "batches", cur.batches, prev.batches);
  addMapOps(ops, "attendance", cur.attendance, prev.attendance);
  addMapOps(ops, "stockRecords", cur.stockRecords, prev.stockRecords);

  if(!ops.length){
    setCloud("Online sync ہو گیا", "ok");
    lastPushed = cur;
    return;
  }

  try{
    setCloud("Firebase پر save ہو رہا ہے…");
    await commitOps(ops);
    lastPushed = cur;
    setCloud("Online sync ہو گیا", "ok");
  }catch(err){
    console.error(err);
    setCloud("Save نہیں ہوا — internet/rules check کریں", "bad");
  }
}

function saveState(state){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(()=>saveStateNow(state), 350);
}

window.noorFirebaseSync = {
  ready:false,
  saveState
};

loginForm?.addEventListener("submit", async e=>{
  e.preventDefault();
  loginMessage.textContent = "";
  loginMessage.className = "login-message";
  loginBtn.disabled = true;
  loginBtn.textContent = "Login ہو رہا ہے…";
  try{
    await signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPassword.value);
  }catch(err){
    console.error(err);
    loginMessage.textContent =
      err.code === "auth/invalid-credential" ? "Email یا Password درست نہیں۔" :
      err.code === "auth/too-many-requests" ? "کوششیں زیادہ ہو گئیں۔ کچھ دیر بعد دوبارہ کریں۔" :
      "Login نہیں ہوا۔ Firebase Authentication user check کریں۔";
  }finally{
    loginBtn.disabled = false;
    loginBtn.textContent = "Login";
  }
});

logoutBtn?.addEventListener("click", async()=>{
  await signOut(auth);
});

try{
  await setPersistence(auth, browserLocalPersistence);
}catch(err){
  console.warn("Auth persistence:", err);
}

onAuthStateChanged(auth, user=>{
  if(user){
    loginGate?.classList.add("hidden");
    userBar.hidden = false;
    userEmail.textContent = user.email || "Logged in";
    setCloud("Firebase data load ہو رہا ہے…");
    startListeners();
  }else{
    stopListeners();
    window.noorFirebaseSync.ready = false;
    userBar.hidden = true;
    loginGate?.classList.remove("hidden");
    setCloud("Login درکار ہے", "bad");
  }
});
