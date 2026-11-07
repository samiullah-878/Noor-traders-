// qaide.js — v2.191.0: 🧠 FALSAFA card (malik 7 Nov 2026: "animation, premium feel · total falsafa · click ke baghair khud chala jaye").
// Pehle (v2.183.1) Psycho-Cybernetics ke 6 qaide the — ab falasifa ke aqwal (Urdu + Roman), apne lafzon mein (kitaab ki ibaarat nahi).
// App khulte hi (3 s) + khuli app mein har 2 ghante EK qoul — upar tairta hua card, 4 s baad KHUD gayab (koi click nahi).
// Ungli lagao = ruk jata hai (parhne ke liye); ✕ = band; ☰ "🧠 Falsafa" = sab aqwal ki list. Sirf malik, sirf is phone ki yaad (localStorage). Server / AI kuch nahi.
const Q = [
  ['🏛', 'ارسطو', 'Arastoo', 'ہم وہی ہیں جو ہم بار بار کرتے ہیں۔ کمال کوئی کام نہیں، عادت ہے۔', 'Hum wohi hain jo hum baar baar karte hain. Kamaal koi kaam nahi, aadat hai.'],
  ['🏛', 'سقراط', 'Suqraat', 'جس زندگی کا جائزہ نہ لیا جائے وہ جینے کے لائق نہیں۔', 'Jis zindagi ka jaiza na liya jaye, wo jeene ke laiq nahi.'],
  ['🏛', 'افلاطون', 'Aflatoon', 'سب سے بڑی فتح اپنے آپ پر فتح ہے۔', 'Sab se bari fatah apne aap par fatah hai.'],
  ['🛡', 'مارکس اوریلیس', 'Marcus Aurelius', 'تمہارے ذہن پر تمہاری حکومت ہے، باہر کے واقعات پر نہیں۔ یہ جان لو تو طاقت مل جائے گی۔', 'Tumhare zehan par tumhari hukoomat hai, bahar ke waqiat par nahi. Yeh jaan lo to taqat mil jayegi.'],
  ['🛡', 'سینیکا', 'Seneca', 'ہم حقیقت سے زیادہ اپنے وہم میں دکھ اٹھاتے ہیں۔', 'Hum haqeeqat se zyada apne weham mein dukh uthate hain.'],
  ['🛡', 'ایپکٹیٹس', 'Epictetus', 'لوگوں کو چیزیں نہیں ستاتیں، چیزوں کے بارے میں ان کی رائے ستاتی ہے۔', 'Logon ko cheezein nahi satatin, cheezon ke baare mein un ki raaye satati hai.'],
  ['🌙', 'مولانا رومی', 'Rumi', 'کل میں ذہین تھا، دنیا بدلنا چاہتا تھا۔ آج میں دانا ہوں، خود کو بدل رہا ہوں۔', 'Kal main zaheen tha, duniya badalna chahta tha. Aaj main dana hoon, khud ko badal raha hoon.'],
  ['🌙', 'مولانا رومی', 'Rumi', 'زخم وہ جگہ ہے جہاں سے روشنی تم میں داخل ہوتی ہے۔', 'Zakham wo jagah hai jahan se roshni tum mein dakhil hoti hai.'],
  ['🌙', 'امام غزالی', 'Imam Ghazali', 'علم بغیر عمل کے دیوانگی ہے، اور عمل بغیر علم کے بے فائدہ۔', 'Ilm baghair amal ke deewangi hai, aur amal baghair ilm ke be-faida.'],
  ['🌙', 'ابن سینا', 'Ibn Sina', 'جو شک نہیں کرتا وہ تحقیق نہیں کرتا، جو تحقیق نہیں کرتا وہ کبھی نہیں دیکھتا۔', 'Jo shak nahi karta wo tehqeeq nahi karta; jo tehqeeq nahi karta wo kabhi nahi dekhta.'],
  ['🌙', 'علامہ اقبال', 'Allama Iqbal', 'اپنے آپ کو اتنا بلند کرو کہ تقدیر لکھنے سے پہلے تم سے پوچھا جائے۔', 'Apne aap ko itna buland karo ke taqdeer likhne se pehle tum se poocha jaye.'],
  ['🌙', 'علامہ اقبال', 'Allama Iqbal', 'خودی کو پہچانو — ہر مشکل کا راستہ تمہارے اندر سے نکلتا ہے۔', 'Khudi ko pehchano — har mushkil ka raasta tumhare andar se nikalta hai.'],
  ['☯', 'لاؤ زو', 'Lao Tzu', 'ہزار میل کا سفر ایک قدم سے شروع ہوتا ہے۔', 'Hazaar meel ka safar ek qadam se shuru hota hai.'],
  ['☯', 'کنفیوشس', 'Confucius', 'فرق نہیں پڑتا تم کتنے آہستہ چلتے ہو، جب تک تم رکتے نہیں۔', 'Farq nahi parta tum kitne aahista chalte ho, jab tak tum rukte nahi.'],
  ['🎓', 'کانٹ', 'Kant', 'ایسے عمل کرو جیسے تمہارا ہر فیصلہ سب کے لیے قانون بن جائے۔', 'Aise amal karo jaise tumhara har faisla sab ke liye qanoon ban jaye.'],
  ['🎓', 'نطشے', 'Nietzsche', 'جس کے پاس جینے کا "کیوں" ہے وہ ہر "کیسے" سہہ سکتا ہے۔', 'Jis ke paas jeene ka "kyun" hai, wo har "kaise" seh sakta hai.'],
  ['🏛', 'ارسطو', 'Arastoo', 'صبر کڑوا ہے، مگر اس کا پھل میٹھا ہے۔', 'Sabr karwa hai, magar us ka phal meetha hai.'],
  ['🛡', 'مارکس اوریلیس', 'Marcus Aurelius', 'اچھا انسان کیسا ہوتا ہے — اس پر بحث میں وقت ضائع مت کرو۔ بس وہ بن جاؤ۔', 'Achha insaan kaisa hota hai — is par behas mein waqt zaya mat karo. Bas wo ban jao.'],
  ['🛡', 'سینیکا', 'Seneca', 'خوش قسمتی وہ ہے جب تیاری موقع سے مل جائے۔', 'Khush-qismati wo hai jab tayyari mauqe se mil jaye.'],
  ['🌙', 'حضرت علیؓ', 'Hazrat Ali (RA)', 'لوگوں سے ایسے ملو کہ مر جاؤ تو روئیں اور زندہ رہو تو تمہاری خواہش کریں۔', 'Logon se aise milo ke mar jao to royen, aur zinda raho to tumhari khwahish karein.'],
];
const GAP = 2 * 3600e3, SHOW = 4000;
const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, String(v)); } catch {} return null; };
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let O = null, el = null, hideT = 0, all = false, started = false, paused = false;

export function qdStart(o) {
  O = o || {}; if (started) return; started = true;
  setTimeout(() => maybe(true), 3000);   // app khulte hi — har dafa
  setInterval(maybe, 60e3);   // har minute dekho — 2 ghante ho gaye hon to agla qoul
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(maybe, 1500); });
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
