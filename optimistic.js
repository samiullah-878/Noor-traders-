// A view overlay only: authoritative snapshots and server validation stay intact.
export function optimisticRecords(){
 let base=[],changes=new Map(),initialized=false;
 const rows=()=>{if(!changes.size)return base;const m=new Map(base.map(r=>[r.id,r]));for(const [id,c] of changes)m.set(id,c.row);return [...m.values()]};
 return {
  rows,seed(next){if(!initialized){base=next;initialized=true}},has:id=>changes.has(id),pending:()=>[...changes.values()].some(c=>!c.accepted),
  receive(next){initialized=true;base=next;for(const [id,c] of changes){const r=base.find(r=>r.id===id);if(c.accepted&&r&&r.rev>=c.row.rev)changes.delete(id)}return rows()},
  begin(row){if(changes.has(row.id))throw Error('Is entry ka pehla save abhi Sync ho raha hai. Pending Sync dekhein.');changes.set(row.id,{row,accepted:false});return rows()},
  accept(id){const c=changes.get(id);if(c){c.accepted=true;const r=base.find(r=>r.id===id);if(r&&r.rev>=c.row.rev)changes.delete(id)}return rows()},
  reject(id){changes.delete(id);return rows()}
 };
}
