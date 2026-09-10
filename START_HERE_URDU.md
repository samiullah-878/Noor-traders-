# v110 — Staff save fix + daily shop instructions

Owner: Staff Control → “دکان کی ہدایات”. Dukan kholne aur band karne ki instructions alag likhein, har line par ek hidayat. Save ke baad sab staff ko apni screen par “روزانہ دکان کی ہدایات” mein dono sections milte hain. Editable starter instructions supplied. Yeh instructions hain; automatic task assignment ya completion points nahi badalte.

Staff create now commits the account and staff record atomically online before updating the local list. A failed create leaves the form available to retry without creating a local duplicate. Repeated clicks while saving are blocked. A local-only unfinished record can be completed if the online account does not exist. A real online duplicate is protected and its name is shown; search is set to that phone in Staff List. No existing online account is overwritten or deleted by the new create flow. The screenshot's exact live record could not be inspected; the faulty local-before-online save order was identified and corrected in source.

Validation: existing DOM workflows plus failed-create/retry, repeated click, named duplicate protection, local-only recovery and owner instructions appearing for staff passed with synthetic Firebase SDK. No production records changed. No live publish performed. Upload index.html, sw.js and version.json. No additional rules change beyond the included prior rules.

---

# v109 — Khane ke paise Daily / Monthly

Staff Add/Edit ke Salary Settings mein “کھانے کے پیسے” section hai: None, Daily ya Monthly; raqam; aur “تنخواہ میں شامل کریں”. Salary detail/settings mein bhi yahi options hain.

Daily = rate × selected month ke unique hazri/check-in wale din. Ghair-hazir ya sirf approved-leave days shamil nahi; checkout missing ho tab bhi us din ka khana count hota hai. Monthly = fixed monthly amount, attendance se prorate nahi hota. Checkbox ON par khana earned salary mein ADD hota hai; OFF par khane ka hisaab alag rehta hai, salary mein add nahi hota. Yeh payment receipt ya automatic cash entry nahi banata. Pehle se final salary snapshots nahi badalte; zaroorat ho to owner reason ke saath reopen kare.

Settings current/unfinalized month calculations par apply hoti hain, per-date rate history nahi. Existing legacy meal rates carry forward where available, with salary inclusion OFF by default to avoid double counting. Owner profile, Khana Allowance, staff salary, owner salary breakdown and PDFs show the meal amount. Staff cannot edit their own salary/meal settings.

Validated: daily/monthly/excluded calculations, unique attendance-day counting, finalized amount preservation, Edit save/reopen and account synchronization, matching staff salary and PDF; existing DOM workflows also passed. Real mobile visual rendering was not tested here.

Upload index.html, sw.js and version.json. Is change ke liye Firestore rules mein nayi tabdeeli nahi. Live publish nahi kiya gaya.

---

# v108 — Bol kar Urdu mein raaye likhein

Staff screen → “کام بہتر بنانے کے لیے میری رائے” → “🎙 بول کر اردو لکھیں”. Urdu mein bolein, “بولنا بند کریں” dabayein, text check/edit karein, phir “مالک کو رائے بھیجیں”. Owner ko text notification milti hai; audio file record/store/send nahi hoti.

Browser speech recognition ur-PK use hoti hai. HTTPS aur microphone permission zaroori hain. Browser/service ko internet chahiye ho sakta hai; unsupported browsers mein manual typing rahegi. Chrome par live microphone verification deployment ke baad karein. Recognition apne aap band ho to mic dobara daba sakte hain; pehle ka text rehta hai. Logout pending dictation cancel karta hai.

v107 ke Firestore rules mein is update ke liye koi tabdeeli nahi. index.html, sw.js aur version.json upload karein. Yeh ZIP live publish nahi hui.

---

# v107 — Staff ki raaye aur Urdu font

Staff screen par “کام بہتر بنانے کے لیے میری رائے” kholein, suggestion likhein aur “مالک کو رائے بھیجیں” dabayein. Owner ke existing 🔔 notifications mein naam, raaye aur waqt aata hai. Nayi raaye par unread badge / live in-app alert; “پڑھ لی ہے” se read status staff ko bhi dikhai deta hai. Existing opt-in phone alerts suggestion par bhi lagte hain jab owner app khuli aur online ho. Band app ke liye push server add nahi hua; wapas login par raaye inbox mein milti hai.

Noto Nastaliq Urdu regular/bold fonts HTML mein embedded hain; font ke liye internet ki zaroorat nahi. License licenses/Noto-Nastaliq-Urdu-OFL.txt mein hai. Urdu styling Staff screen aur notification panel par lagti hai.

Zaroori: updated firestore.rules publish karein (staffRequests mein suggestion ki permission), phir index.html, sw.js, version.json aur manifest.webmanifest upload karein. App abhi live publish nahi hui. Staff-only system aur purane staff features barqarar hain.

---

# v106 — Sirf Staff System

Home par Staff Control khulta hai. Menu mein Staff, attendance, tasks/pictures, points, khana allowance, salary, staff reports, settings aur backup hain. Sale, khata, wasooli, expenses, cash, stock, purchase, production aur business reports ke screens/menu hata diye gaye hain; purane direct links Staff Control par aate hain. Purana saved business data delete nahi hota.

Developer note: legacy business markup/helpers remain inert and hidden for shared initialization and data compatibility. They cannot be opened through app navigation. Existing backup/sync format remains unchanged; this is a Staff-only interface, not deletion or migration of stored business records. Staff settings retains existing backup and owner password utilities.

Publish index.html, sw.js, version.json and manifest.webmanifest. v104/v105 ke Firestore rules same hain. App abhi live deploy nahi ki gayi.

---

# v105 — Staff navigation fix

Staff option par click karne se selected form/data seedha nazar aata hai. Lambi options list par scroll nahi hota. Purane features maujood hain. Is fix ke liye index.html, sw.js aur version.json update karein. v104 ke Firestore rules mein koi nayi tabdeeli nahi.

# v104 — Staff update

Purane staff features rakhe gaye hain. Naye options Staff Control mein hain: Overview, Staff / Duty, Approvals, Salary aur Change history. Staff login par Aaj aur request form milta hai.

**Zaroori:** Pehle isi Firebase project mein ZIP wali `firestore.rules` publish karein. Phir `index.html`, `sw.js`, `version.json` host par update karein aur Sync dabayein. Yeh ZIP abhi live publish nahi hui.

Salary final karne se pehle missing checkouts durust karein. Final salary badalni ho to reason ke saath Reopen karein. Salary payment isi screen par record karein; is se business cash entry khud nahi banti. Chhutti approve hone se paid-leave salary khud add nahi hoti.

Naye cloud records purane local JSON backup mein shamil nahi. Mukammal tafseel aur test results README.md mein hain.

---

# Noor Traders v103 — Attendance اور Salary Mobile Fix

## ویب سائٹ پر لگائیں

1. ZIP کھول کر `nt-traders--main` فولڈر میں جائیں۔ اپنی موجودہ ویب سائٹ کے اصل فولڈر میں **index.html، sw.js، version.json** تینوں فائلیں اکٹھی بدلیں۔ ZIP یا اضافی اندرونی فولڈر اپلوڈ نہ کریں۔ تمام نیا کوڈ index.html کے اندر بھی موجود ہے۔
2. Firebase Console میں اپنے **nt-traders → Firestore Database → Rules** پر جائیں۔ اس پیکج کی **firestore.rules** کا مکمل متن لگا کر Publish کریں۔ نئی تصویری رپورٹس اور اسٹاف سیشن کے لیے یہ لازمی ہے۔
3. **Authentication → Sign-in method** میں **Email/Password** اور **Anonymous** فعال ہوں۔ مالک کا موجودہ Firebase اکاؤنٹ رہنے دیں؛ اسے حذف یا دوبارہ بنانے کی ضرورت نہیں۔
4. ویب سائٹ کی deployment مکمل ہونے پر **Sync / Update Now** دبائیں۔ لاگ اِن اسکرین پر **v103** دیکھیں۔

**نیا (v102):** ہر ملازم کی الگ Monthly Salary، Daily Duty Hours، Working Days، Overtime Rate اور Per Point Rate اب Staff Add/Edit میں ہی درج ہوتے ہیں۔ Final Salary حاضری کے Working Hours، Overtime، Attendance + approved Task Points، مالک کی شامل کردہ رقم اور Advance/کٹوتی سے بنتی ہے۔ یہ حساب Staff Profile، Staff Reports، ملازم کی اپنی PDF، Individual PDF اور Complete System Report میں بھی شامل ہے۔

**درستگی (v103):** Firebase سے آج کی حاضری load ہوتے ہی Dashboard اور Staff Center خود refresh ہوتے ہیں، اس لیے حاضر ملازم Absent نہیں رہتا۔ Salary Breakdown موبائل پر مکمل width میں card-style دکھتی ہے اور رقم بائیں طرف سے نہیں کٹتی۔


## اسٹاف کہاں سے تصاویر لگائے گا؟

**نیا (v101):** ملازم کے اکاؤنٹ کی تصویر صرف **لائیو کیمرے** سے لی جا سکتی ہے — گیلری/فائل چننے کا آپشن ختم کر دیا گیا ہے۔ جہاں بھی Check-In اور Check-Out نظر آتے ہیں وہاں **کام کے گھنٹے** بھی خود بخود دکھائی دیتے ہیں (Check-Out نہ ہو تو «جاری ہے»)۔ اور کوئی بھی ادھورا فارم اب refresh یا ایپ بند ہونے پر ضائع نہیں ہوتا — دوبارہ کھولنے پر خود واپس آ جاتا ہے، Save کرتے ہی ڈرافٹ ختم ہو جاتا ہے۔ پاس ورڈ کبھی محفوظ نہیں ہوتا۔

اسٹاف کے پینل میں پروفائل کے فوراً نیچے **کام کی تصاویر بھیجیں** کا سبز بٹن ہے۔ اسے دبائیں، اپنا کام منتخب کریں، **📷 کیمرہ کھول کر تصویر لیں** دبائیں (گیلری سے تصویر شامل نہیں ہو سکتی)، پھر **تصاویر مالک کو بھیجیں** دبائیں۔ ایک رپورٹ میں 1 سے 8 تصاویر شامل ہو سکتی ہیں۔ صرف تصویر لینے پر اطلاع نہیں جائے گی؛ بھیجنے کا بٹن دبانے اور محفوظ ہونے پر جائے گی۔

اگر کوئی کام نہیں آ رہا تو مالک پہلے **Staff List → ملازم کی Profile / Edit → نیا کام دیں** سے کام دے۔ تاریخ نہ رکھنے والے پرانے کام بھی اب فہرست میں دکھیں گے۔

## مالک کو اطلاع

- مالک کی ایپ کھلی اور انٹرنیٹ سے منسلک ہو تو نئی تصویری رپورٹ پر فوراً اوپر اطلاع آئے گی، مثلاً: **سونو نے 3 تصاویر بھیجی ہیں**۔
- اوپر **🔔 اطلاعات** دبانے سے نئی اور دیکھی ہوئی رپورٹیں ملیں گی۔ **تصاویر کھولیں** سے وہی کام کھلے گا؛ مالک تصاویر دیکھ کر OK اور پوائنٹس دے سکتا ہے۔
- فون کی notification tray میں بھی الرٹ کے لیے **🔔 اطلاعات → فون پر الرٹ چالو کریں → Allow** منتخب کریں۔ Chrome میں اجازت بند ہو تو Site settings سے Notifications کو Allow کرنا ہوگا۔
- **مکمل بند ایپ میں نئی فون اطلاع نہیں آئے گی۔** اس ورژن میں فون الرٹ کھلی اور چلتی ہوئی ایپ سے آتا ہے۔ دوبارہ ایپ کھولنے پر نئی رپورٹیں گھنٹی والے حصے میں نظر آئیں گی۔ WhatsApp/SMS یا بند ایپ کے لیے Push سروس اس اپڈیٹ میں منسلک نہیں کی گئی۔
- اسکرین کی Refresh یا دوبارہ لاگ اِن پر پرانی رپورٹس کے فون الرٹ دوبارہ نہیں بجیں گے۔ ایک ہی رپورٹ کی اطلاع دو بار جمع نہیں ہوتی۔

## نئی دکان کی لوکیشن

**QXX4+5Q9, Guliana** اب Check-In اور GPS فاصلے کا مرکز ہے۔ مکمل Plus Code **8J4MQXX4+5Q9** ہے؛ مرکز **32.7979125, 73.956984375** ہے۔ موجودہ radius کی ترتیب برقرار ہے (default 200m)۔ اسٹاف پروفائل میں **نقشے پر دکان دیکھیں** بھی موجود ہے۔ پچھلی حاضری کے ریکارڈ اور ان کے پرانے فاصلے تبدیل نہیں کیے گئے۔

## دونوں لاگ اِن

| پینل | یوزر نیم | پاس ورڈ |
| --- | --- | --- |
| مالک | admin | مالک کے موجودہ Firebase اکاؤنٹ کا اصل پاس ورڈ |
| اسٹاف | admin، یا اپنا موبائل نمبر | پروفائل میں محفوظ اپنا مکمل موبائل نمبر، شروع کے 0 سمیت |

پہلے مالک یا اسٹاف والا بٹن منتخب کریں۔ مالک کے پاس ورڈ پر 123456 کی پابندی ہٹا دی گئی ہے۔ مالک Settings سے اپنا پاس ورڈ بدل سکتا ہے۔ اسٹاف کا اکاؤنٹ فعال اور Staff login enabled ہونا چاہیے۔

مالک کے admin نام کو فراہم کردہ موجودہ owner emails سے ملایا جاتا ہے: admin@nt-traders.firebaseapp.com، hp6235@gmail.com، اور سابق owner@nttraders.local۔ مالک اپنی اسی فہرست والی اصل email سے بھی لاگ اِن کر سکتا ہے۔ کسی دوسری email کی ضرورت ہو تو auth-controller.js اور firestore.rules دونوں کی owner فہرست بدلیں اور npm run build چلائیں۔

## کام اور تصویری رپورٹ

1. مالک: **Staff List → ملازم کی Profile / Edit → نیا کام دیں**۔ نام، تفصیل، تاریخ اور زیادہ سے زیادہ پوائنٹس لکھیں۔ ہر بار کوئی بھی نیا کام لکھ سکتے ہیں۔ پروفائل کا فون یا نام بدلا ہو تو پہلے Save Staff Changes کریں۔
2. اسٹاف: اپنے پینل میں **میرے کام اور تصویری رپورٹ** کھولیں۔ کام مکمل کرکے کیمرے سے تصاویر لیں۔ گیلری کا آپشن بند ہے۔ ایک دفعہ میں 1 سے 8 تصاویر بھیج سکتے ہیں۔ بھیجنے سے پہلے تصویر دیکھ یا ہٹا سکتے ہیں۔
3. مالک: اوپر **Tasks / Picture Report** میں جمع شدہ کام کھولیں۔ تصاویر دیکھیں، پوائنٹس لکھیں اور **OK — منظور کریں** دبائیں۔ کام ٹھیک نہ ہو تو وجہ لکھ کر دوبارہ بھیجیں۔
4. منظوری تک پوائنٹس صفر رہتے ہیں۔ منظوری کے بعد اسٹاف اس کام یا اس کے پوائنٹس کو تبدیل نہیں کر سکتا۔ دوبارہ OK دبانے سے پوائنٹس دو بار جمع نہیں ہوتے۔

## PDF

- اسٹاف: حاضری رپورٹ کی From / To تاریخیں منتخب کرکے PDF کھولیں۔ کام کے منظور شدہ پوائنٹس اور حاضری کے پوائنٹس الگ، پھر مجموعہ آئے گا۔
- مالک: **Tasks / Picture Report** میں ملازم، حالت اور تاریخیں منتخب کرکے **تصاویر والی PDF** کھولیں۔ تمام موجودہ جمع شدہ تصاویر اور ہر ملازم کے پوائنٹس شامل ہوں گے۔ پروفائل کی PDF میں اسی ملازم کے کام، تصاویر اور حاضری آئیں گی۔
- تصاویر لوڈ ہونے پر **Print / Save as PDF** دبائیں اور براؤزر میں **Save as PDF** منتخب کریں۔ کام کی رپورٹ کا تاریخ والا حساب کام کی مقررہ تاریخ سے ہوتا ہے۔

## جانچ کی حالت

27 مقامی ٹیسٹ اور اصل HTML کے ساتھ 7 DOM منظرنامے پاس ہوئے۔ ان میں پرانے نامکمل ٹاسک، تصاویر جمع کرنا، مالک کی اطلاع، اطلاع سے تصاویر کھولنا، پڑھی ہوئی حالت محفوظ کرنا، لاگ آؤٹ کے بعد اطلاع رکنا اور نئی لوکیشن کا فاصلہ شامل ہیں۔ اصل Firebase اکاؤنٹس یا لائیو ویب سائٹ تبدیل نہیں کیے گئے۔ Firestore emulator کی جانچ اور اصل فون پر کیمرہ/PDF کی جانچ یہاں مکمل نہیں ہو سکی۔

اگر v100 اور نئی Rules لگانے کے بعد بھی لاگ اِن نہ ہو تو اسکرین پر آنے والے مکمل پیغام کی تصویر سے Firebase کی باقی وجہ معلوم ہو سکے گی۔ پاس ورڈ بھیجنے کی ضرورت نہیں۔
