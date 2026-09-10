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

Validation: existing DOM workflows plus simulated speech recognition passed (Urdu language selection, final-result deduplication, interim preview, editable text submission, permission denial and late callback cancellation). Real microphone/browser recognition was not tested in this environment.

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

# Noor Traders Staff v104

This update preserves the v103 staff screens and adds an owner Staff Control overview, duty schedules, leave/correction requests, salary finalization/payment tracking and change history. Existing login credentials/configuration are unchanged. This ZIP has not been deployed to production.

## Use
- Owner: Staff Control → Overview / Staff-Duty / Approvals / Salary / Change history. Existing Staff List, GPS/selfie attendance, camera-only task submission, reports, meal allowances, scores and all other screens remain available.
- Employee: Aaj summary and requests are above the existing task and attendance panels. Staff can request leave or corrections; owner approves or rejects. Leave approval marks leave in the new overview; it does not automatically add paid leave to the existing hourly salary calculation.
- Duty settings support a start/end time, one weekly-off day and grace minutes per employee. Defaults use the existing shop policy. End time is informational; actual clocked hours and existing salary duty-hours settings continue to determine pay. Overnight working-hour calculations remain available. Existing historical scores are preserved.
- Finalize salary only after reviewing the monthly breakdown and resolving open attendance. The final snapshot is reused by existing salary views and reports until the owner reopens it with a reason. Payments are recorded separately from advances, with date, note and remaining balance; payment entry does not create a business cash/expense entry.
- Attendance corrections/deletions, schedules, request reviews, salary configuration/adjustments, finalization and payments generate owner-visible audit events. This is application change history, not a tamper-proof accounting log.

## Deploy this update
1. Publish `firestore.rules` to the existing Firebase project. The new own-record permissions are necessary for staff requests, duty schedules and finalized salary views. Existing Firebase configuration and owner identities are retained.
2. Upload `index.html`, `sw.js` and `version.json` to the current host, retaining existing manifest/assets.
3. Press Sync on the login screen, then verify one owner and one staff login.

The new collections are `staffRequests`, `staffSchedules`, `staffPayroll`, and `staffAudit`. They are stored in the existing Firebase business. Like existing cloud tasks/photos, they are not part of the legacy local JSON business backup. This update does not change backup/restore scope. New review/payment operations require a successful online transaction; no success is shown for a failed commit.

## Validation
32 unit/domain tests and eight actual-HTML/DOM scenarios passed using a synthetic SDK, including existing picture submission/approval/PDF flows and the new request → approved correction → schedule → salary freeze → payment workflow. Overpayment and failed payment writes were rejected. DOM tests adapt top-level classic-script bindings to Happy DOM's per-evaluation scope; production scripts are unchanged by that test adaptation. Mobile screenshot verification was unavailable because Chromium could not be downloaded. Additional Firebase rules tests are supplied; a live emulator and production camera/GPS/push validation were not run.

Run `npm test`, `npm run test:dom`, and `npm run build`. `npm run test:rules` requires the local Firestore emulator. Sources for new controls are in `staff-upgrades.js`; the build embeds them in the standalone HTML.

---

## Preserved v103 documentation

# Noor Traders Hisab v103

v103 fixes the live attendance summary so present staff no longer remain marked absent after Firestore finishes loading. It also makes the Salary Breakdown fit narrow mobile screens without clipping its amount column.

Based on the supplied v98 app and the working v99 login update. Read **START_HERE_URDU.md** for installation and use.

- Premium evergreen/gold owner and staff panels, compact typography, prominent work upload above attendance.
- Missing, null or malformed legacy task dates no longer crash the staff list.
- Real-time in-app owner inbox/toast with staff name and picture count; read state syncs per owner. Optional phone notifications are opt-in and require the owner page to remain running and connected. There is no WhatsApp integration or closed-app push subscription.
- Shop location updated to QXX4+5Q9, Guliana (32.7979125, 73.956984375), decoded as 8J4MQXX4+5Q9.
- Compact staff shortcuts at the top, three buttons per row on mobile, available across staff screens.
- Custom tasks assigned from an employee's profile/edit screen or the owner picture-report screen.
- Up to eight compressed pictures per task submission, camera only (gallery picker removed), preview and removal before sending.
- Staff account photos are captured with an in-app live camera (`getUserMedia`, front camera by default). The gallery/file picker cannot be opened for these fields.
- "Working Hours" is shown next to every Check-In/Check-Out pair: today attendance, staff profile time table and full history, attendance history, staff reports, complete system report, the staff PDF report and the staff member's own report. It is derived from Check-In/Check-Out on every render and is never stored, so existing attendance records display hours without any migration. Records crossing midnight are handled; missing check-out shows "جاری ہے" and impossible spans (negative, or over 16 hours) show "—".
- Salary is now part of Staff Add/Edit, every staff profile, Staff Reports, the employee's own PDF, the owner individual PDF, and the Complete System Report. Each employee has separate monthly salary, duty hours, working days, overtime rate and point rate. Final salary is calculated from clocked normal hours + overtime + attendance/task point value + owner additions - advances/deductions. Salary settings are mirrored to the employee account and preserved in online settings.
- Unsaved Add/Edit forms survive refresh, reload, accidental back and app updates. Text fields are drafted to `localStorage` and the staff profile photo to IndexedDB (`ntDraftsV101`), keyed per form, expiring after 24 hours. Drafts clear automatically on a successful save, and the restore banner offers a manual clear. Password fields are never drafted.
- Owner approval with integer points within the assigned maximum, or return for corrections.
- Staff task points and PDF accounting; owner PDF embeds all current submission pictures, with per-employee totals and date filters.
- Separate owner/staff login tabs, real Firebase owner password, UID-bound staff sessions, owner password change.

`index.html` includes all application code and styles. Hosting requires only `index.html`, `sw.js`, `version.json` plus the existing manifest/assets. Publish the included Firestore rules separately. There is no npm build requirement for deploying the supplied files. The extracted `.js`/`.css` sources are included for maintenance; after editing them run `npm run build` to regenerate the inline sections.

Task metadata lives in `businesses/noor-traders/staffTasks/{taskId}` and images in its `taskPhotos/{photoId}` subcollection. Transactions save a submission and its pictures together. The owner review transaction checks the displayed submission ID and revision. Points are summed from approved tasks, so repeated clicks cannot add duplicate points. Photos remain attached when an employee's phone number changes. Owner notification read markers are in `staffTaskNotificationReads/{ownerUid}`. Initial history does not replay phone alarms; new submission IDs alert once, and the bell retains up to 100 current submission notices. Prior submissions remain in Firestore; reports show the current submission. Existing local business JSON backups do not include these cloud task/photo collections.

Validation: 27 auth/domain/service tests and seven actual-HTML/DOM integration scenarios passed, including the full two-picture submission and approval workflow. SDKs and image decoding are synthetic in these tests. Firestore emulator rules tests are supplied but were not run in this environment. Live login, camera compression and the browser print dialog require a deployment check; no production data or credentials were changed.

Developer commands: `npm install`, `npm test`, `npm run test:dom`. For the optional rules gate, start a local Firestore emulator and run `FIRESTORE_EMULATOR_HOST=127.0.0.1:8087 npm run test:rules`. Never point these tests at a production project.

Implementation references: [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions) and [field access rules](https://firebase.google.com/docs/firestore/security/rules-fields).

Notification implementation references: [showNotification](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification) and [permission request](https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static).
