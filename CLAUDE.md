# NOOR TRADERS — MALIK KE PAKKE QAIDE (har AI pehle ye parhe)

Malik: Samiullah (Noor Traders, ~25 mulazim). Apps: Blue Khata (ye repo), Staff Hazri app (ALAG repo — kabhi is repo mein mat daalo), shop PC scripts (`pc/`).
Ye file har kaam se pehle parho. Koi naya qaida mile to yahan aur `AI_NOTES.txt` dono mein likho.

## 1. Baat cheet
- Jawab **Roman Urdu** mein (Latin harf). Hindi/Devanagari ya Urdu script NAHI — malik parh nahi sakta.
- Jawab **chhota** — phone par lamba parhna mushkil.
- Batao kahan AI use ho raha hai aur kahan nahi.

## 2. Kaam ka tareeqa
- Har kaam se pehle **PLAN do aur malik ke "OK" ka intezar karo**. OK ke baghair kuch mat banao.
- Sochte waqt **POORI app ka design** dimagh mein rakho; kam az kam 10 dafa soch kar **EK pakka jawab**. Complexity bilkul nahi — easy to use.
- Pehle bane hue kaam yaad rakho; batao naya kaam zaroori hai ya pehle se kuch maujood hai.
- Galti ho to seedha maano, theek karo, aur us ka qaida yahan likh do taake dobara na ho.
- Malik ko kabhi PC par command chalane ko mat kaho — PC scripts `pc/manifest.json` se khud update hoti hain (KHATA-DOCTOR ~3 min).

## 3. Design / chhoti suhulatein (har nayi jagah khud lagao)
- **Premium, elegant** look; chips premium. Purana **layout mat badlo** (staff aadi hai) — sirf rang/font/size.
- Item chunna ho to **list pehle se nazar aaye** (likhna na pare), **search**, **multi-select ✓ + "N jorein"**, **dohra (duplicate) roko**.
- Lambi list / parchi = **5-5 ki patti**: poori list dikhao, upar ke N par khud ✓, print ke baad agle N par khud ✓ (chips 3 · 5 · 10 · Sab).
- Jahan ginti/check ho wahan **har item ka ☐ checkbox** + "✓ n/N" chip.
- Har PDF ke saath **kholo + bhejo** option; kholne par poori screen.
- Har naya feature/screen = **Settings → Mulazim mein on/off CAP** (`can(k)` deny-list). CAP key ki shakal `^[a-z]+[.:][a-z0-9]+$` (warna saveStaff gira deta hai — 21 Oct 2026: stock.g2milao / stock.rack100 save nahi hote the). Jo screen malik shuru mein BAND chahe (Item report / Larka report) = `OPT_IN` set + `st.allow` (tick = khula), deny nahi (v2.105.7).
- **Speed pehle** — har tick/button foran (pehle UI, server baad mein).
- **🤖 Agent action**: har naya feature / chip / qaida apna agent action bhi register kare (`agentRegister([...])` — pos-stock.js ke aakhir mein namoona): `name, desc, params, read|write, danger, summary(args), run(args)`; `run` WAHI function jo button chalata hai. Malik likh kar poori app chalata hai (v2.103.47).
- Shop ki parchiyon par English ke saath **Urdu** bhi. Har parchi ke upar **bari Urdu tareekh** (`UR.dateLine(date)` — آج / کل کا بل / N دن پرانا) + Urdu sar-khi; jo cheez insaan likhta hai (Tafseel / Note / Wajah) = `UR.note(text, px, 'تفصیل')` (Urdu label bara, "تفصیل: …") aur print se pehle `text = await UR.fillNotes(text)` (AI 4 s; na aaye to `roman2ur` — bina AI qaide wala Urdu, line kabhi gayab nahi) — 20/21 Oct 2026.
- Parchi par packet / tadad **item ke naam ke aage usi line par** (upar / neeche alag line nahi) — transfer-sync `pkNameLines` (21 Oct 2026).
- Theme CSS se bachne ke liye: naye widget mein class `on` nahi, `is-in`; `html body :is(#summary,#dialogBody) .x { … !important }`.
- **🧭 ⋮ dhancha (shell.js, v2.104.0)**: screen ke chhote kaam screen par nahi — button par `data-mn="key" data-mn-i="📋" data-mn-t="Naam" data-mn-s="chhoti line" data-mn-g="🧾 Group"` (options ka dabba `data-mn-seg`, poora hissa `data-mn-box`). Phone par yeh khud chhup kar header ke ⋮ mein jate hain; zaroori warning ho to `data-mn-keep`. Naya hand-made menu / chips ki qatar mat banao.
- **📱 Phone (v2.105.0)**: upar ka hero card chhota (`html:not([data-hero="big"])` CSS), chips ki qatar ek line + side scroll (`html:not([data-chip="big"])`, classes .mchips/.rk-nb/.sort-chips…). Nayi screen ka card / chips inhi classes se banao taake khud chhote hon. Screen chips ☰ ke peeche (shell.js). Agent ka card upar nahi — 🤖 gola.
- **⋮ PAKKA QAIDA (malik, 21 Oct 2026: "koi bhi chips ka kaam ho andar rakho, screen par nahi — three dot ke andar")**: har screen AUR har khirki ke chips / chhote kaam (filter, tareekh, tarteeb, edit, transfer, reminder, % ek click…) screen par NAHI — ⋮ ke andar (`data-mn*` tags). Screen par sirf asal kaam (khata / list / entries) + ek chhoti patti jo bataye kya chuna hai ("… ⋮ se badlein"). Sirf zaroori warning `data-mn-keep`.
- **🪟 Khirki ka ⋮ + neeche ki patti (v2.105.2)**: khirki (dialog) ke chips par bhi wahi `data-mn*` tags — phone par khud chhup kar khirki ke upar × ke saath ⋮ mein (shell.js dlgBtnSetup); upar ek chhoti patti `data-mn-sheet` (jaise rkPillHTML) jo bataye kya chuna hai. Neeche ki patti (#actions) ke kaam: screen ka view shell.js `FT_MOVE` mein daalo → phone par ⋮ mein; neeche sirf ek asal bara button (Naya account / ＋ Purchase / Naya transfer note / Saman diya·Paisa wasool).
- **👤 Mulazim ki apni screen (v2.105.4)**: malik kahe "har ek ki apni screen" to malik ki setting Firestore mein (sab ka default), mulazim ki sirf us ke phone par (localStorage, key mein login naam) + CAP; patti par "👤 Aap ka …" aur "↺ Malik wala". Rules ki zaroorat nahi.
- **👑 Mulazim ki tab mein malik (v2.105.8)**: alag Firebase app (`sessionStorage sam-malik-tab`, naam 'blue-khata-malik', session persistence, memory cache, push nahi). Is flow mein mulazim ka anonymous login KABHI sign out mat karo; har logout / idle 10 min / ↩️ = `malikBack` (reload → mulazim).
- **📷 Entry ki tasveer (v2.105.8)**: poori `entryPhotos/<id>` + chhota namoona `entryPhotos/<id>_t` (pn.t=1). List / chip mein `ephHTML` (poori tasveer sirf dabane par). Naye form mein bhi `epPickHTML` + `epSetup` + `...epCollect(f)`.
- **⛔ Item band (v2.105.9)**: band = `stockCount/_hidden.items[id]` → PC (post-farq) khud stock 0 bill + IsActive 0. App sirf **tabdeeli** bheje `cloud.setBand({id: true|false})` (false = deleteField) — **poori list merge:true se kabhi nahi** (nested map merge = hataya hua id reh jata hai; v2.103.84–2.105.8 mein "↩️ Chalu" isi se kabhi nahi hua) aur poori list replace bhi nahi (purani/khali list = sab band khul jayein). Band items Stock par "⛔ Band items" list mein dikhte hain (POS se ghaib bhi). POS mein active hone par app khud un-band NAHI karti (malik ka faisla) — 🟢 dikhati hai.
- Halki themes (`html.lt`) header ke har button ko surf2 kar deti hain (themes.css) — header mein rangeen button ho to `html.lt header .stock-head .x:not(.selected):not(.on)` se wapas rang do (v2.105.9: ginti ka button safed par safed tha).
- **🧱 Side par na khiske (v2.105.1)**: grid ke bachon par `min-width:0` / `minmax(0,1fr)`; chaura content (table, chips) apne `overflow-x:auto` dabbe mein. Poori khirki / screen kabhi daayein-baayein nahi khiskni chahiye (shell.js `lockX`).

## 4. POS / PC — KHATARNAK, dhyan se
- POS = Cognitive Solutions (SQL Server). Jo script POS mein **likhti** hai (item-post, purchase-post, transfer-sync, sale-post…) us mein **koi value kabhi 0/khali na jaye jis se POS divide karta ho** — khas taur par **PackQty (carton pcs) kam az kam 1**. (18 Oct 2026: "kala tail khula" ka PackQty 0 gaya → counter sale "Divide by zero", bill band.)
- Parhne wali scripts (rack, irep, stats) POS mein kabhi kuch nahi likhti.
- **Godam/branch ko NAAM se pehchano, number se nahi** — POS mein branch 2 ka naam "Godam 1" hai. Godam 2 = naam mein "godam 2" (`collect().g2` / `jamaG2`). Branch 1 = NOOR TRADERS (dukan).
- Ata/maida jaisa maal sirf godam se bikta hai — dukan ki sale mein mat gino.
- Diagnostic scripts SQL password kabhi print na karein.

## 5. Security (kabhi nahi)
- `firebase-key.json`, `local-config.json` **GitHub par kabhi nahi** (haath se copy).
- Master key, AI key, bank key chat mein kabhi mat likho.
- `node_modules` / `package-lock` commit mat karo.
- **Login code**: malik ka pakka code sirf hash (`blueAccess/ownerCode`, PBKDF2) — tasdeeq sirf shop PC (`pc/owner-login.js`, admin custom token, 10 ghalat = 1 ghanta band). Plain code kabhi Firestore / log / chat mein nahi. Larke ke code (`deviceJoins pc-…`, keep) ek dafa chalte hain, phir naya khud (v2.105.7).

## 6. Har update ka checklist
1. Firestore rules badlein to `firestore-rules-X.html` (pichhle versions ke chips ke saath) malik ko bhejo + poora rules text chat mein.
2. `AI_NOTES.txt` (root) + `pc/AI_NOTES.txt` dono update.
3. Version bump: `OLD=x NEW=y; grep -rl "$OLD" --include=*.js --include=*.html . | grep -v node_modules | grep -v firestore-rules | xargs sed -i "s/v=$OLD\b/v=$NEW/g; s/sam-blue-khata-$OLD\b/sam-blue-khata-$NEW/; s/APP_VER='$OLD'/APP_VER='$NEW'/; s/Blue Khata v$OLD\b/Blue Khata v$NEW/g"` + `version.json`.
4. PC file badle to `pc/manifest.json` version + sha256.
5. `node --check` (copy as .mjs) + tests; phir commit/push, deploy (`gh run list -R samiullah-878/Noor-traders- -L 1`) ka intezar.
6. Malik ko chhota Roman Urdu summary: kya badla, "app Update karein", AI hai ya nahi.
- **POS update** (Cognitive) ke baad procedures mein naye params aa sakte hain ("expects parameter … was not supplied"). `pc/proc-fill.js` har `usp_` call se pehle sys.parameters dekh kar anjaan params 0 / '' / NULL bhar deta hai — har POS-likhne wali script mein `require('./proc-fill.js').patch(sql, log)`. Nayi script banao to ye line zaroor (20 Oct 2026: @IsAdvanceTaxable se naya item ruk gaya tha).
- **Packet-war (rack) hisaab app ka apna hai**: bacha = aakhri likha − us packet ke barcode ki sale. POS ke kul stock se KHUD kabhi mat milao (20 Oct 2026: v2.103.66 mein milaya, malik ne wapas karwaya) — POS mein sirf kul hota hai, packet nahi. POS se bharna sirf malik ke button par.
- **Naya import / dynamic import HAMESHA `?v=<version>` ke saath** (`./x.js?v=2.103.79`) — bina version SW purani file deta hai, PC par app aadhi purani chalti hai (20 Oct 2026). Firestore ko wapas `persistentMultipleTabManager` mat karo — PC par ek tab so jaye to sab tab ka data ruk jata tha.
- **Label printer**: script kabhi khud "retry/dobara bhejo" na kare — spooler ka number na hilna = printer dheere, labels asal mein nikal rahe hote hain (20 Oct 2026: v4.7 retry se 100 label dohre chhape). Ruka ho to sirf intezar + app ko wajah; dobara sirf malik ke hukum se.
- **Poori screen** (fixed) ke liye `100vw/100dvh` mat likho — `html{zoom:.92}` ki wajah se 92% reh jata hai; `inset:0` + `width/height:auto` likho.
- **Comment kabhi code line ke BEECH mein nahi** — `//` ke baad wala sab comment ban jata hai (20 Oct 2026: pos-khata-sync dobara print ka `code / date` comment ban gaya — parchi par voucher no / tareekh gayab). Comment line ke aakhir mein ya alag line.
- **Firestore mein list ke andar list kabhi nahi** (`[[...]]`) — PC admin SDK bhi 'invalid nested entity' deta hai aur poori script ruk jati hai. JSON text (`xj`) bana kar bhejo (20 Oct 2026: sales-stats ph se 4 din Commission report Rs 0).
