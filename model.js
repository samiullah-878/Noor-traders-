export const TYPES={purchaseCash:'Cash purchase',sale:'Daily sale',collection:'Wasooli',payment:'Party ko payment',expense:'Akhrajat',credit:'Udhar diya',borrow:'Hum ne dena hai'};
export const money=n=>'Rs '+(Number(n||0)/100).toLocaleString('en-PK',{maximumFractionDigits:2});
export const cents=v=>{const n=Number(v);if(!Number.isFinite(n)||n<0||n>1e11)throw Error('Raqam durust likhein');return Math.round(n*100)};
export const norm=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/[۰-۹]/g,x=>String(x.charCodeAt(0)-1776)).replace(/[٠-٩]/g,x=>String(x.charCodeAt(0)-1632)).trim();
export function balance(p,entries){return (p.opening||0)+entries.filter(e=>e.partyId===p.id).reduce((n,e)=>n+(['credit','payment'].includes(e.kind)?e.amount:['borrow','collection'].includes(e.kind)?-e.amount:0),0)}
export function yesterday(date){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10)}
export function daily(date,entries,closings){const prev=closings.find(c=>c.date===yesterday(date)),close=closings.find(c=>c.date===date)||{};const totals={sale:0,collection:0,expense:0,payment:0};entries.filter(e=>e.date===date&&inDaily(e)).forEach(e=>{if(e.kind==='purchaseCash')totals.expense+=e.amount;else if(e.kind in totals)totals[e.kind]+=e.amount});const opening=prev?.change??close.opening??0;return {...totals,opening,change:close.change??0,cash:close.cash??0,closed:close.change!=null&&close.cash!=null,openingKnown:prev?.change!=null||close.opening!=null,difference:totals.sale+totals.collection+opening-totals.expense-totals.payment-(close.change||0)-(close.cash||0)}}

export const inDaily = e => !(['collection','payment'].includes(e.kind) && e.dailyIncluded === false);
