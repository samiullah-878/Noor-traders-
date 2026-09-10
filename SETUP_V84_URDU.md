> v100 کے لیے پہلے START_HERE_URDU.md پڑھیں۔ نیچے پرانے ورژن کی ہدایات ہیں۔

# Noor Traders Hisab v84 — Setup

## v84 میں اہم تبدیلیاں
- Mobile کے لیے الگ compact layout اور bottom navigation
- ہر چیز الگ screen:
  Dashboard, Sale, Wasooli, Expenses, Cash/Change, Accounts Incoming,
  Stock, Staff Accounts, Today Attendance, Attendance History, Scores,
  Purchase/Bills, Batch Cost, Reports, Backup, Settings
- Staff کے لیے الگ employee panel
- Selfie + GPS + geofence attendance
- Check-in time سے automatic score
- Owner score/time correction
- Date-wise history
- Daily اور individual staff PDF-ready reports
- Version / Variant display
- version.json + service worker کے ذریعے update check
- Attendance policy Settings میں editable

## Default score rules
- 9:00 سے 9:10 تک = 10/10
- 9:11 سے 9:20 تک = 8/10
- 9:21 سے 9:30 تک = 6/10
- 9:31 سے 9:45 تک = 4/10
- اس کے بعد = 2/10

یہ rules Settings میں بدلے جا سکتے ہیں۔

## GitHub پر upload
ZIP extract کریں اور repository root میں یہ files replace/upload کریں:
- index.html
- version.json
- manifest.webmanifest
- sw.js

## Firebase
1. Authentication میں Email/Password owner login کے لیے enabled رہے۔
2. Authentication میں Anonymous enabled رہے، کیونکہ Staff login anonymous Firebase session استعمال کرتا ہے۔
3. Firestore Database → Rules میں `firestore.rules` کا پورا code paste کرکے Publish کریں۔

## Auto update
آئندہ نئی version بناتے وقت:
- `index.html` update کریں
- `version.json` میں version مثلاً v85 کریں
- GitHub پر upload/commit کریں

App نئی version check کرے گی۔ Home-screen/PWA میں service worker network-first update strategy استعمال ہوتی ہے۔
