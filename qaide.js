// qaide.js — v2.191.0: 🧠 FALSAFA card (malik 7 Nov 2026: "animation, premium feel · total falsafa · click ke baghair khud chala jaye").
// Pehle (v2.183.1) Psycho-Cybernetics ke 6 qaide the — ab falasifa ke aqwal (Urdu + Roman), apne lafzon mein (kitaab ki ibaarat nahi).
// App khulte hi (3 s) + khuli app mein har 2 ghante EK qoul — upar tairta hua card, 4 s baad KHUD gayab (koi click nahi).
// Ungli lagao = ruk jata hai (parhne ke liye); ✕ = band; ☰ "🧠 Falsafa" = sab aqwal ki list. Sirf malik, sirf is phone ki yaad (localStorage). Server / AI kuch nahi.
const Q = [   // v2.193.0 (malik 7 Nov): SIRF duniya ke top 5 falasifa — Suqraat · Aflatoon · Arastoo · Confucius · Kant (har ek ke 4, apne lafzon mein)
  ['🏛', 'سقراط', 'Suqraat', 'جس زندگی کا جائزہ نہ لیا جائے وہ جینے کے لائق نہیں۔', 'Jis zindagi ka jaiza na liya jaye, wo jeene ke laiq nahi.'],
  ['🏛', 'سقراط', 'Suqraat', 'میں صرف ایک بات جانتا ہوں کہ میں کچھ نہیں جانتا۔', 'Main sirf ek baat janta hoon ke main kuch nahi janta.'],
  ['🏛', 'سقراط', 'Suqraat', 'مضبوط ذہن خیالات پر بات کرتے ہیں، کمزور ذہن لوگوں پر۔', 'Mazboot zehan khayalat par baat karte hain, kamzor zehan logon par.'],
  ['🏛', 'سقراط', 'Suqraat', 'تبدیلی کا راز نئے کو بنانے پر زور لگانا ہے، پرانے سے لڑنے پر نہیں۔', 'Tabdeeli ka raaz naye ko banane par zor lagana hai, purane se larne par nahi.'],
  ['📜', 'افلاطون', 'Aflatoon', 'سب سے بڑی فتح اپنے آپ پر فتح ہے۔', 'Sab se bari fatah apne aap par fatah hai.'],
  ['📜', 'افلاطون', 'Aflatoon', 'ہر کام کا سب سے اہم حصہ اس کی شروعات ہے۔', 'Har kaam ka sab se ahem hissa us ki shuruaat hai.'],
  ['📜', 'افلاطون', 'Aflatoon', 'مہربان رہو، ہر شخص جس سے تم ملتے ہو ایک مشکل جنگ لڑ رہا ہے۔', 'Meherban raho — har shakhs jis se tum milte ho ek mushkil jang lar raha hai.'],
  ['📜', 'افلاطون', 'Aflatoon', 'جو لوگ سیاست سے منہ موڑتے ہیں ان پر اپنے سے کم لوگ حکومت کرتے ہیں۔', 'Jo log siyasat se munh morte hain, un par apne se kam log hukoomat karte hain.'],
  ['⚖️', 'ارسطو', 'Arastoo', 'ہم وہی ہیں جو ہم بار بار کرتے ہیں۔ کمال کوئی کام نہیں، عادت ہے۔', 'Hum wohi hain jo hum baar baar karte hain. Kamaal koi kaam nahi, aadat hai.'],
  ['⚖️', 'ارسطو', 'Arastoo', 'صبر کڑوا ہے، مگر اس کا پھل میٹھا ہے۔', 'Sabr karwa hai, magar us ka phal meetha hai.'],
  ['⚖️', 'ارسطو', 'Arastoo', 'اپنے آپ کو جاننا ہر دانائی کی شروعات ہے۔', 'Apne aap ko janna har danai ki shuruaat hai.'],
  ['⚖️', 'ارسطو', 'Arastoo', 'ذہن کو تعلیم دینا اور دل کو نہ دینا — یہ کوئی تعلیم نہیں۔', 'Zehan ko taleem dena aur dil ko na dena — yeh koi taleem nahi.'],
  ['☯', 'کنفیوشس', 'Confucius', 'فرق نہیں پڑتا تم کتنے آہستہ چلتے ہو، جب تک تم رکتے نہیں۔', 'Farq nahi parta tum kitne aahista chalte ho, jab tak tum rukte nahi.'],
  ['☯', 'کنفیوشس', 'Confucius', 'ہماری سب سے بڑی شان کبھی نہ گرنا نہیں، ہر بار گر کر اٹھنا ہے۔', 'Hamari sab se bari shaan kabhi na girna nahi, har baar gir kar uthna hai.'],
  ['☯', 'کنفیوشس', 'Confucius', 'ایسا کام چنو جس سے محبت ہو، پھر زندگی میں ایک دن بھی کام نہیں کرنا پڑے گا۔', 'Aisa kaam chuno jis se mohabbat ho, phir zindagi mein ek din bhi kaam nahi karna parega.'],
  ['☯', 'کنفیوشس', 'Confucius', 'جو دوسروں پر کرنا پسند نہ کرو، وہ خود کسی پر نہ کرو۔', 'Jo apne par hona pasand na karo, wo kisi aur par na karo.'],
  ['🎓', 'کانٹ', 'Kant', 'ایسے عمل کرو جیسے تمہارا ہر فیصلہ سب کے لیے قانون بن جائے۔', 'Aise amal karo jaise tumhara har faisla sab ke liye qanoon ban jaye.'],
  ['🎓', 'کانٹ', 'Kant', 'ہمت کرو اپنی عقل خود استعمال کرنے کی — یہی روشن خیالی ہے۔', 'Himmat karo apni aqal khud istemal karne ki — yehi roshan-khayali hai.'],
  ['🎓', 'کانٹ', 'Kant', 'انسان کو ہمیشہ مقصد سمجھو، کبھی محض ذریعہ نہیں۔', 'Insaan ko hamesha maqsad samjho, kabhi mehz zariya nahi.'],
  ['🎓', 'کانٹ', 'Kant', 'علم تجربے سے شروع ہوتا ہے، مگر سارا علم تجربے سے نہیں آتا۔', 'Ilm tajurbe se shuru hota hai, magar sara ilm tajurbe se nahi aata.'],
];
const GAP = 2 * 3600e3, SHOW = 4000;
const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, String(v)); } catch {} return null; };
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let O = null, el = null, hideT = 0, all = false, started = false, paused = false;

export function qdStart(o) {
  O = o || {}; if (started) return; started = true;
  // v2.263.1 (malik 13 Nov: 'is ko band kar do — yeh jo pop aa raha hai'): card KHUD kabhi nahi aata (app khulte hi / 2 ghante / wapas aane par — teeno band). Sirf menu se haath se.
}
function maybe(open) {
  if (document.hidden || !O.owner?.()) return;
  if (!open && Date.now() - Number(LS('sam-qd-at') || 0) < GAP) return;
  show();
}
export function qdShow(allQ) { all = !!allQ; show(true); }
function show(manual) {
  const i = Number(LS('sam-qd-i') || 0) % Q.length;
  if (!manual) { LS('sam-qd-at', Date.now()); LS('sam-qd-i', (i + 1) % Q.length); }
  if (!el) {
    el = document.createElement('div'); el.id = 'qdCard'; el.className = 'qd'; el.setAttribute('popover', 'manual');
    document.body.appendChild(el);
    el.addEventListener('click', onClick);
    // ungli lagi = ruk jao (parh raha hai); uthi = 6 s baad chala jaye
    el.addEventListener('pointerdown', () => { paused = true; clearTimeout(hideT); el.classList.add('is-hold') });
    el.addEventListener('pointerup', () => { paused = false; el.classList.remove('is-hold'); if (!all) arm(6000) });
  }
  paint(i);
  // khuli modal khirki baqi sab ko 'inert' kar deti hai — card usi khirki ke andar rakho taake ungli chale
  const host = [...document.querySelectorAll('dialog')].filter(d => { try { return d.matches(':modal'); } catch { return false; } }).pop() || document.body;
  if (el.parentNode !== host) { try { el.hidePopover(); } catch {} host.appendChild(el); }
  el.classList.remove('is-out'); el.classList.add('is-in');
  try { el.showPopover(); } catch { el.hidden = false; }
  if (!all) arm(SHOW); else clearTimeout(hideT);
}
function arm(ms) { clearTimeout(hideT); el.style.setProperty('--qd-ms', ms + 'ms'); el.classList.remove('is-run'); void el.offsetWidth; el.classList.add('is-run'); hideT = setTimeout(close, ms); }
function paint(i) {
  const [ic, urN, roN, ur, ro] = Q[i];
  el.innerHTML = `<i class="qd-glow"></i><div class="qd-h"><small>${ic} فلسفہ · Falsafa</small><button type="button" class="qd-x" data-qd="x" aria-label="Band">✕</button></div>`
    + (all ? `<ol class="qd-all">${Q.map((q, k) => `<li${k === i ? ' class="is-in"' : ''}><b dir="rtl">${esc(q[3])}</b><span>${esc(q[4])}</span><em>— ${esc(q[2])}</em></li>`).join('')}</ol>`
      : `<div class="qd-b"><p class="qd-ur" dir="rtl">${esc(ur)}</p><p class="qd-ro">${esc(ro)}</p><p class="qd-au"><span dir="rtl">— ${esc(urN)}</span><small>${esc(roN)}</small></p></div><i class="qd-bar"></i>`);
  el.dataset.i = i;
}
function close() { clearTimeout(hideT); all = false; if (!el) return; el.classList.add('is-out'); el.classList.remove('is-in'); setTimeout(() => { try { el.hidePopover(); } catch { el.hidden = true; } }, 420); }
function onClick(e) {
  const b = e.target.closest('[data-qd]'); if (!b) return;
  if (b.dataset.qd === 'x') close();
}
