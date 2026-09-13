// Pure calculations shared by the UI, validation and local backup restoration.
export const expenseKinds=['expense','payment','purchaseCash'];
export function expenseSummary(entries,mode,period){
 const rows=entries.filter(e=>!e.deleted&&expenseKinds.includes(e.kind)&&(mode==='all'||(mode==='day'?e.date===period:e.date?.startsWith(period))));
 const groups=new Map();for(const e of rows){const key=e.kind==='expense'?'expense:'+e.account:e.kind+':'+e.partyId;const g=groups.get(key)||{key,kind:e.kind,partyId:e.partyId,account:e.account,total:0};g.total+=e.amount;groups.set(key,g)}
 return {rows,total:rows.reduce((n,e)=>n+e.amount,0),groups:[...groups.values()].sort((a,b)=>b.total-a.total||a.key.localeCompare(b.key))};
}
export function custodyBalances(cash,moves){const sums=new Map([['shop',cash||0]]);for(const m of moves||[]){sums.set(m.from,(sums.get(m.from)||0)-m.amount);sums.set(m.to,(sums.get(m.to)||0)+m.amount)}return sums}
export function addCustodyMove(cash,moves,move){
 if(!Number.isSafeInteger(move.amount)||move.amount<=0||!move.from||!move.to||move.from===move.to)throw Error('Raqam aur do mukhtalif accounts select karein');
 if((moves||[]).length>=200)throw Error('Is din ke 200 transfers ho chuke hain');
 if((custodyBalances(cash,moves).get(move.from)||0)<move.amount)throw Error('Is shakhs / dukan ke paas itna closing cash record mein nahi hai');
 return [...(moves||[]),move];
}
const dayMs=86400000;
export function nextReminder(anchor,repeat,after){
 const start=new Date(anchor+'T12:00:00Z'),end=new Date(after+'T12:00:00Z');
 if(!Number.isFinite(+start)||!Number.isFinite(+end))throw Error('Reminder ki tareekh durust likhein');
 if(repeat==='once')return null;
 if(repeat==='monthly'){let n=Math.max(0,(end.getUTCFullYear()-start.getUTCFullYear())*12+end.getUTCMonth()-start.getUTCMonth());for(;;n++){const d=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+n,1,12));const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(start.getUTCDate(),last));if(d>end)return d.toISOString().slice(0,10)}}
 const interval={daily:1,weekly:7,fortnightly:14}[repeat];if(!interval)throw Error('Reminder repeat durust select karein');
 const n=Math.max(0,Math.floor((end-start)/(dayMs*interval))+1);return new Date(+start+n*dayMs*interval).toISOString().slice(0,10);
}
export function validateExtraRecord(r){
 if(!['cashCustody','reminder'].includes(r.type))return r;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date||''))throw Error('Invalid record date');
 if(r.type==='cashCustody'){
  if(r.id!=='custody-'+r.date||!Array.isArray(r.moves)||r.moves.length>200)throw Error('Invalid cash custody record');
  for(const m of r.moves)if(!m||typeof m.from!=='string'||!m.from||typeof m.to!=='string'||!m.to||m.from===m.to||!Number.isSafeInteger(m.amount)||m.amount<=0||typeof m.note!=='string'||m.note.length>1000||!Number.isSafeInteger(m.at))throw Error('Invalid cash transfer');
 }
 if(r.type==='reminder'&&(typeof r.partyId!=='string'||!r.partyId||r.id!=='reminder-'+r.partyId||!['once','daily','weekly','fortnightly','monthly'].includes(r.repeat)||!/^\d{4}-\d{2}-\d{2}$/.test(r.anchorDate||'')||!/^\d{4}-\d{2}-\d{2}$/.test(r.dueDate||'')))throw Error('Invalid reminder');
 return r;
}

export function stableRecord(value){if(Array.isArray(value))return '['+value.map(stableRecord).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableRecord(value[k])).join(',')+'}';return JSON.stringify(value)}
