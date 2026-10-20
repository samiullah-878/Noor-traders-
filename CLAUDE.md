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
- Har naya feature/screen = **Settings → Mulazim mein on/off CAP** (`can(k)` deny-list).
- **Speed pehle** — har tick/button foran (pehle UI, server baad mein).
- **🤖 Agent action**: har naya feature / chip / qaida apna agent action bhi register kare (`agentRegister([...])` — pos-stock.js ke aakhir mein namoona): `name, desc, params, read|write, danger, summary(args), run(args)`; `run` WAHI function jo button chalata hai. Malik likh kar poori app chalata hai (v2.103.47).
- Shop ki parchiyon par English ke saath **Urdu** bhi.
- Theme CSS se bachne ke liye: naye widget mein class `on` nahi, `is-in`; `html body :is(#summary,#dialogBody) .x { … !important }`.

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

## 6. Har update ka checklist
1. Firestore rules badlein to `firestore-rules-X.html` (pichhle versions ke chips ke saath) malik ko bhejo + poora rules text chat mein.
2. `AI_NOTES.txt` (root) + `pc/AI_NOTES.txt` dono update.
3. Version bump: `OLD=x NEW=y; grep -rl "$OLD" --include=*.js --include=*.html . | grep -v node_modules | grep -v firestore-rules | xargs sed -i "s/v=$OLD\b/v=$NEW/g; s/sam-blue-khata-$OLD\b/sam-blue-khata-$NEW/; s/APP_VER='$OLD'/APP_VER='$NEW'/; s/Blue Khata v$OLD\b/Blue Khata v$NEW/g"` + `version.json`.
4. PC file badle to `pc/manifest.json` version + sha256.
5. `node --check` (copy as .mjs) + tests; phir commit/push, deploy (`gh run list -R samiullah-878/Noor-traders- -L 1`) ka intezar.
6. Malik ko chhota Roman Urdu summary: kya badla, "app Update karein", AI hai ya nahi.
- **POS update** (Cognitive) ke baad procedures mein naye params aa sakte hain ("expects parameter … was not supplied"). `pc/proc-fill.js` har `usp_` call se pehle sys.parameters dekh kar anjaan params 0 / '' / NULL bhar deta hai — har POS-likhne wali script mein `require('./proc-fill.js').patch(sql, log)`. Nayi script banao to ye line zaroor (20 Oct 2026: @IsAdvanceTaxable se naya item ruk gaya tha).
- **Packet-war (rack) hisaab app ka apna hai**: bacha = aakhri likha − us packet ke barcode ki sale. POS ke kul stock se KHUD kabhi mat milao (20 Oct 2026: v2.103.66 mein milaya, malik ne wapas karwaya) — POS mein sirf kul hota hai, packet nahi. POS se bharna sirf malik ke button par.
- **Label printer**: script kabhi khud "retry/dobara bhejo" na kare — spooler ka number na hilna = printer dheere, labels asal mein nikal rahe hote hain (20 Oct 2026: v4.7 retry se 100 label dohre chhape). Ruka ho to sirf intezar + app ko wajah; dobara sirf malik ke hukum se.
