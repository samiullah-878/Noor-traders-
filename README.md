# Noor Traders Hisab v79 — GitHub Pages

یہ repository Noor Traders Hisab v79 کے browser-based version کے لیے تیار ہے۔

## Structure
- `index.html`
- `assets/css/styles.css`
- `assets/js/app.js`
- `manifest.webmanifest`
- `sw.js`
- `.github/workflows/pages.yml`

## GitHub پر چلانے کا طریقہ
1. GitHub پر نئی repository بنائیں۔
2. اس ZIP کے تمام files repository root میں upload کریں۔
3. branch کا نام `main` رکھیں۔
4. GitHub → Settings → Pages میں جائیں۔
5. Source میں **GitHub Actions** منتخب کریں۔
6. `main` پر push ہوتے ہی site deploy ہو جائے گی۔

## Data
یہ version browser `localStorage` استعمال کرتا ہے۔
یعنی data اسی browser/device میں رہتا ہے۔
Settings میں **Full Migration Backup** سے JSON backup بنائیں۔

## Security
اس repository میں passwords, secret keys یا API tokens شامل نہیں ہیں۔
