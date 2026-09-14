// A NEW cash payment and its initial account entry commit together. After
// creation the two books are independent: edits/deletes affect only that book.
export async function cashLinkChanges(tx, ref, previous, next) {
  if (next.type !== 'cashCustody' || next.deleted) return [];
  const refs = record => {
    const result = new Set();
    for (const move of record?.moves || []) {
      if (!move.ref) continue;
      if (!/^[a-zA-Z0-9_-]{1,120}$/.test(move.ref) || result.has(move.ref)) throw Error('Cash reference duplicate / invalid');
      result.add(move.ref);
    }
    return result;
  };
  const before = refs(previous); refs(next);
  const writes = [];
  for (const move of next.moves) {
    if (!move.ref || before.has(move.ref) || move.from !== 'shop' || ['shop','external'].includes(move.to)) continue;
    const id = 'cashpay-' + move.ref, snap = await tx.get(ref(id));
    if (snap.exists()) throw Error('Yeh cash payment pehle save ho chuki hai. Taza record khol kar dekhein.');
    writes.push({id, type:'entry', kind:'credit', partyId:move.to,
      amount:move.amount, date:next.date, note:'Cash diya · ' + move.note,
      by:next.updatedBy, createdAt:move.at, updatedBy:next.updatedBy,
      updatedAt:next.updatedAt, rev:1});
  }
  return writes;
}
