// =========================================================
//  nabz-ui.js v1.0 (2026-11-17, app v2.319.0) — 🚨 PHONE ALARM (dukan ki nabz) — Settings → 🖥️ PC scripts ka dabba (sirf malik)
//  Malik: "dukan ka system ruke to phone bajega · baqi notifications jaisa screen par patti".
//  Server PC (doctor → pc/nabz.js) har 2 min pcBeat/<chaabi> likhta hai; malik ke phone ka MacroDroid '🚨 Dukan nigrani' (md/tools/nabz.py)
//  har 3 min parhta hai. Yeh dabba: chaabi banata (blueAccess/pcBeatKey, sirf malik) + phone ko link bhejta (Falcon wala webhook, `nt_nabz`) +
//  abhi ka haal dikhata + 🔔 Test. Chaabi / link repo / chat mein KABHI nahi. AI nahi.
// =========================================================
import { firebaseConfig as F } from './config.js?v=2.355.0';
let A = null, key = null, beat = null, busy = '', wired = false, loadAt = 0;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const beatUrl = k => `https://firestore.googleapis.com/v1/projects/${F.projectId}/databases/(default)/documents/businesses/noor-traders/pcBeat/${k}?key=${F.apiKey}`;
const ago = t => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'abhi' : m < 60 ? m + ' min pehle' : Math.floor(m / 60) + ' ghante ' + (m % 60) + ' min pehle'; };
const box = () => document.getElementById('pcNabz');

export function setup(deps) {
  A = deps || {};
  if (wired) return; wired = true;
  document.addEventListener('click', e => {
    const t = e.target.closest?.('[data-nb]'); if (!t || !box()?.contains(t)) return;
    const k = t.dataset.nb;
    if (k === 'join') join(true); else if (k === 'test') test(); else if (k === 'ref') load(true);
  });
}

function html() {
  if (key === null) return '<div class="nb-box"><p class="muted">⏳ 🚨 Phone alarm …</p></div>';
  let st = '';
  if (!key) st = '<p class="nb-st">⚪ Abhi jora nahi — neeche ka button ek dafa dabayein.</p>';
  else if (!beat || !beat.at) st = '<p class="nb-st">⏳ PC ne abhi haal nahi bheja — PC update ke 3-5 min baad 🔄 dabayein.</p>';
  else {
    const old = Date.now() - beat.at > 10 * 60000;
    st = `<p class="nb-st ${old ? 'r' : 'g'}">${old ? '🔴 PC ki aakhri khabar ' + ago(beat.at) + ' — PC / internet band? (dukan ke waqt phone par yehi alarm)' : '🟢 PC ne ' + ago(beat.at) + ' haal bheja'}${beat.hz ? ' · 🏖 aaj chhutti (alarm band)' : ''}</p>`
      + (beat.r ? `<p class="nb-ln r">🔴 ${esc(beat.r)}</p>` : '')
      + (beat.y ? `<p class="nb-ln y">🟡 ${esc(beat.y)}</p>` : '')
      + (!beat.r && !beat.y && !old ? '<p class="nb-ln g">✅ Abhi sab theek</p>' : '');
  }
  const jb = busy === 'join' ? '⏳ Bhej raha…' : key ? '📲 Phone ko dobara jorein' : '🚨 Phone alarm jorein';
  return `<div class="nb-box"><div class="nb-hd"><b>🚨 Phone alarm</b><small>dukan ka system ruke to aap ka phone bataye</small><button type="button" class="nb-c" data-nb="ref" title="Taza karo">🔄</button></div>${st}
    <div class="nb-btns"><button type="button" class="nb-c pri" data-nb="join"${busy ? ' disabled' : ''}>${jb}</button>${key ? `<button type="button" class="nb-c" data-nb="test"${busy ? ' disabled' : ''}>${busy === 'test' ? '⏳' : '🔔'} Test alarm</button>` : ''}</div>
    <p class="nb-note">Phone par MacroDroid "🚨 Dukan nigrani" har 3 min dekhta hai (9:30 am – 9 pm). 🔴 = awaaz + screen par patti (PC / internet band, thermal mein parchi phansi, WhatsApp toota, der se koi bill nahi) · 🟡 = khamosh patti (NT-PRINT / camera band, ijazat ka intezar). Hazri app mein chhutti = kuch nahi. AI nahi.</p></div>`;
}
function paint() { const b = box(); if (b) b.innerHTML = html(); }

export async function load(force) {
  if (!force && Date.now() - loadAt < 3000) { paint(); return; }
  loadAt = Date.now(); paint();
  try { key = (await A.cloud?.getPcBeatKey?.()) || ''; } catch { key = ''; }
  try { beat = key ? await A.cloud?.getPcBeat?.(key) : null; } catch { beat = null; }
  paint();
}

async function hook() {
  const C = (await A.cloud?.getFxCfg?.()) || {}, m = String(C.wh || '').trim().match(/^(https:\/\/trigger\.macrodroid\.com\/[A-Za-z0-9_-]{6,})\//);
  if (!m) throw Error('Phone ka webhook link nahi mila — Gaari → ⚙️ Falcon setup mein MacroDroid ka link lagayein, phir yahan dobara');
  return m[1];
}
async function join() {
  if (busy) return; busy = 'join'; paint();
  try {
    let k = key || (await A.cloud.getPcBeatKey?.()) || '';
    if (!k) { const a = new Uint8Array(20); crypto.getRandomValues(a); k = Array.from(a, b => b.toString(36).padStart(2, '0')).join('').slice(0, 32); await A.cloud.setPcBeatKey(k); }
    key = k;
    const h = await hook();
    await fetch(h + '/nt_nabz?nbU=' + encodeURIComponent(beatUrl(k)) + '&t=' + Date.now(), { method: 'GET', mode: 'no-cors', cache: 'no-store' });
    A.notice?.('📲 Phone ko bhej diya — 1-2 min mein phone par "✅ Dukan nigrani jur gaya" ki patti aayegi (MacroDroid chalu ho)');
  } catch (e) { A.notice?.('✕ ' + (e?.message || e)); }
  busy = ''; load(true);
}
async function test() {
  if (busy) return; busy = 'test'; paint();
  try { const h = await hook(); await fetch(h + '/nt_nabz?nbT=1&t=' + Date.now(), { method: 'GET', mode: 'no-cors', cache: 'no-store' });
    A.notice?.('🔔 Test bheja — phone par 🔴 patti awaaz ke saath aani chahiye. Na aaye = MacroDroid band / notification ki ijazat nahi');
  } catch (e) { A.notice?.('✕ ' + (e?.message || e)); }
  busy = ''; paint();
}
