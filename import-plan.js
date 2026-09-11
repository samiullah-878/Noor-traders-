import {norm,balance} from './model.js';
const nameKey=v=>norm(v).replace(/\s+/g,' ');
const phoneKey=v=>{let n=norm(v).replace(/\D/g,'');if(n.startsWith('0092'))n='0'+n.slice(4);else if(n.startsWith('92')&&n.length===12)n='0'+n.slice(2);return n.length>=10?n:''};
export function planImport(rows,records,date,hash){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Report ki tareekh dein');
 const parties=records.filter(r=>r.type==='party'&&!r.deleted),entries=records.filter(r=>r.type==='entry'&&!r.deleted),used=new Set();
 return rows.map(r=>{const name=nameKey(r.name),phone=phoneKey(r.details),byName=parties.filter(p=>nameKey(p.name)===name),byPhone=phone?parties.filter(p=>phoneKey(p.phone||p.details)===phone):[];
 const candidates=[...new Map([...byName,...byPhone].map(p=>[p.id,p])).values()];
 if(candidates.length>1)throw Error(r.name+': ek se zyada accounts mil rahe hain. Pehle naam/mobile durust karein.');
 const old=candidates[0];if(old&&phone&&phoneKey(old.phone)&&phoneKey(old.phone)!==phone)throw Error(r.name+': mobile number mukhtalif hai. Pehle account check karein.');
 if(old?.pdfAsOf&&date<old.pdfAsOf)throw Error(r.name+': is account mein is se nayi PDF pehle import ho chuki hai.');
 const id=old?.id||'pdf-'+hash+'-'+r.sourceRow;
 const identity=old?.id||name;
 if(used.has(identity)||(!old&&phone&&used.has('phone:'+phone)))throw Error(r.name+': PDF mein duplicate account hai.');
 used.add(identity);if(phone)used.add('phone:'+phone);
 const covered=entries.filter(e=>e.partyId===id&&e.date<=date),delta=balance({id,opening:0},covered),target=r.give-r.get;
 return {row:r,id,old:old||null,covered,opening:target-delta,target,before:old?balance(old,entries):0,after:target+balance({id,opening:0},entries.filter(e=>e.partyId===id&&e.date>date))};
 });
}
