// sale-man.js — v2.180.0: 👦 LARKA chip (POS ka "SP Man") — Sale + WhatsApp Parchi Sale ke upar, godam jaisa ▾ chunao.
// List: blueAccess/supplyMen {men:[{id,n}]} — PC sale-post v1.14 POS ki dbo.SupplyMan se likhta hai (larke POS mein hi jorein).
// Chuna larka har phone par yaad (localStorage) → bill doc `sm` → PC POS Sale.SupplyManID (Larka report / ranking mein usi ke naam).
// Koi na chuna = pehle jaisa (bill bina larka). CAP sale.larka. AI nahi.
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const can = k => { try { return typeof window.ntCan === 'function' ? window.ntCan(k) : true; } catch { return true; } };
const KEY = 'sam-sale-sm';
let men = null, un = null, cl = null;
let cur = 0; try { cur = Number(localStorage.getItem(KEY)) || 0; } catch {}

const nameOf = id => (men || []).find(x => x.id === id)?.n || '';
const paint = () => document.querySelectorAll('[data-sm-chip]').forEach(el => { el.outerHTML = smChipHTML(); });

export function smWatch(cloud) {
  if (!cloud?.listenSupplyMen || cl === cloud) return;
  cl = cloud; try { un?.(); } catch {}
  un = cloud.listenSupplyMen(d => {
    const L = Array.isArray(d?.men) ? d.men.filter(x => Number(x?.id) > 0 && x.n).map(x => ({ id: Number(x.id), n: String(x.n) })) : [];
    if (men && JSON.stringify(L) === JSON.stringify(men)) return;
    men = L; paint();
  });
}
// chuna larka — sirf jab list mein ho (POS se hata = khud khali)
export const smId = () => (cur > 0 && can('sale.larka') && nameOf(cur) ? cur : 0);
// bill doc ke liye: rules 2.87 na lagi hon (cloud ne ek dafa mana dekha) to 0
export const smForDoc = cloud => { const id = smId(); return id && !cloud?.saleSmOff?.() ? id : 0; };
export const smName = () => nameOf(smId());

export function smChipHTML() {
  if (!men || !men.length || !can('sale.larka')) return '<span data-sm-chip="1" hidden></span>';
  const id = smId(), nm = nameOf(id);
  return `<label class="sm-chip${id ? ' is-in' : ''}" data-sm-chip="1" title="Bill kis larke ke naam (POS SP Man)"><span>👦 ${nm ? esc(nm) : 'Larka'}</span><i>▾</i>`
    + `<select data-sm-sel="1" aria-label="Larka chunein"><option value="0"${id ? '' : ' selected'}>— Koi larka nahi —</option>`
    + men.map(x => `<option value="${x.id}"${x.id === id ? ' selected' : ''}>${esc(x.n)}</option>`).join('') + '</select></label>';
}

document.addEventListener('change', e => {
  const s = e.target.closest?.('[data-sm-sel]'); if (!s) return;
  cur = Number(s.value) || 0; try { localStorage.setItem(KEY, String(cur)); } catch {}
  paint();
});
