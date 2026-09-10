> v100 کے لیے پہلے START_HERE_URDU.md پڑھیں۔ نیچے پرانے ورژن کی ہدایات ہیں۔

# Noor Traders Hisab v85

یہ approved plan والی build ہے۔

اہم تبدیلیاں:
- Mobile compact UI؛ desktop layout موبائل پر squeeze نہیں ہوگا
- الگ screens: Dashboard, Sale, Wasooli, Expenses, Cash/Change,
  Accounts Incoming, Stock, Staff Accounts, Today Attendance,
  Attendance History, Scores, Staff Profile, Reports, Backup, Settings
- Owner اور Staff الگ panels
- Staff: Name, Address, Phone = Password, Photo, Active/Inactive
- Staff Edit proper form/modal
- Phone change پر attendance history نئے phone پر migrate
- Selfie + GPS + geofence
- Date-wise attendance اور arrival order
- Auto Score: 0-10 min=10, 11-20=8, 21-30=6, 31-45=4, later=2
- Rules Settings میں editable
- Owner attendance/time/score correction
- editedBy, editedAt, owner note
- Daily / History / Individual advanced PDF reports
- Staff profile: current-month attendance %, present/absent, average score, late days
- Version v85 / Variant Production
- version.json + service worker auto-update

GitHub:
ZIP extract کرکے repository root میں index.html, version.json, sw.js,
manifest.webmanifest upload/replace کریں۔

Firebase:
Email/Password owner کے لیے ON رہے۔
Anonymous staff login کے لیے ON رہے۔
firestore.rules کو Firestore → Rules میں Publish کریں۔

Existing Hisab/Stock/Firebase data reset نہیں ہوگا۔
