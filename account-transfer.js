// A transfer is two ledger entries committed together, with no daily cash movement.
export const transferIds=id=>['transfer-'+id+'-out','transfer-'+id+'-in'];
export function validateTransferPair(pair){
 const [out,incoming]=pair;
 if(!out||!incoming||!out.transferId||out.transferId!==incoming.transferId)throw Error('Transfer ki dono entries mukammal nahi hain');
 const ids=transferIds(out.transferId);
 if(out.id!==ids[0]||incoming.id!==ids[1]||out.type!=='entry'||incoming.type!=='entry'||out.transferRole!=='out'||incoming.transferRole!=='in'||out.kind!=='collection'||incoming.kind!=='payment'||out.dailyIncluded!==false||incoming.dailyIncluded!==false||out.partyId!==out.fromPartyId||incoming.partyId!==out.toPartyId||out.fromPartyId===out.toPartyId||!Number.isSafeInteger(out.amount)||out.amount<=0)throw Error('Transfer ka link durust nahi hai');
 for(const key of ['fromPartyId','toPartyId','amount','date','note','rev'])if(out[key]!==incoming[key])throw Error('Transfer ki dono entries match nahi kartin');
 if(!!out.deleted!==!!incoming.deleted)throw Error('Transfer ki dono entries match nahi kartin');
 return pair;
}
export function buildTransfer(request,previous,accounts,uid,stamp){
 const {id,fromPartyId,toPartyId,amount,date}=request;
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id||''))throw Error('Transfer ID durust nahi');
 const existing=previous.some(Boolean);
 if(existing)validateTransferPair(previous);
 const expected=request.rev??0;
 if(existing?(previous[0].rev!==expected||previous[0].deleted):expected!==0)throw Error('Transfer doosre device par badla hai. Dobara khol kar dekhein.');
 if(request.remove){if(!existing)throw Error('Transfer nahi mila');return previous.map(r=>({...r,deleted:true,rev:expected+1,updatedAt:stamp,updatedBy:uid}))}
 const source=accounts.find(p=>p.id===fromPartyId),target=accounts.find(p=>p.id===toPartyId);
 if(!source||!target||source.deleted||target.deleted||source.type!=='party'||target.type!=='party'||fromPartyId===toPartyId)throw Error('Do mukhtalif accounts select karein');
 if(existing&&previous[0].fromPartyId!==fromPartyId)throw Error('Transfer ka source account nahi badal sakte');
 if(!Number.isSafeInteger(amount)||amount<=0||amount>1e13)throw Error('Raqam durust likhein');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw Error('Tareekh durust likhein');
 const note=String(request.note||'').trim();if(note.length>1000)throw Error('Note bohat lamba hai');
 const ids=transferIds(id);
 return ['out','in'].map((role,i)=>({...previous[i],id:ids[i],type:'entry',transferId:id,transferRole:role,fromPartyId,toPartyId,fromName:source.name,toName:target.name,partyId:i?toPartyId:fromPartyId,kind:i?'payment':'collection',dailyIncluded:false,amount,date,note,rev:expected+1,createdAt:previous[i]?.createdAt??stamp,by:previous[i]?.by||uid,updatedAt:stamp,updatedBy:uid}));
}
export async function transactTransfer(tx,ref,request,uid,stamp){
 const ids=transferIds(request.id),snaps=await Promise.all(ids.map(id=>tx.get(ref(id)))),previous=snaps.map(s=>s.exists()?s.data():null);
 // Retrying the same new transfer after a lost reply must not create a second pair.
 if((request.rev??0)===0&&previous.every(Boolean)){
  validateTransferPair(previous);const p=previous[0];
  if(!p.deleted&&p.by===uid&&p.fromPartyId===request.fromPartyId&&p.toPartyId===request.toPartyId&&p.amount===request.amount&&p.date===request.date&&p.note===String(request.note||'').trim())return previous;
  throw Error('Is ID ka transfer pehle save ho chuka hai');
 }
 const accounts=[];
 if(!request.remove)for(const id of [...new Set([request.fromPartyId,request.toPartyId])]){
  if(typeof id!=='string'||!id||id.includes('/'))throw Error('Account select karein');
  const s=await tx.get(ref(id));if(s.exists())accounts.push({...s.data(),id});
 }
 const next=buildTransfer(request,previous,accounts,uid,stamp);
 next.forEach(r=>tx.set(ref(r.id),r));return next;
}
// Keep each linked pair in one restore transaction, including deleted pairs.
export function transferRestoreGroups(rows,size=100){
 const pairs=new Map();for(const r of rows)if(r.transferId){const pair=pairs.get(r.transferId)||[];pair.push(r);pairs.set(r.transferId,pair)}
 for(const pair of pairs.values()){if(pair.length!==2)throw Error('Backup mein transfer ki aik entry missing hai');pair.sort((a,b)=>a.transferRole==='out'?-1:1);validateTransferPair(pair)}
 const groups=[],seen=new Set();let group=[];
 for(const row of rows){if(seen.has(row.id))continue;const unit=row.transferId?pairs.get(row.transferId):[row];if(group.length+unit.length>size){groups.push(group);group=[]}for(const r of unit){group.push(r);seen.add(r.id)}}
 if(group.length)groups.push(group);return groups;
}
