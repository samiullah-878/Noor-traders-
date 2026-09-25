# clean.ps1 - Noor Traders HAZRI repo (nt-traders-) se khata app ki faltu files hatata hai.
# Sirf hazri repo ko chhoota hai. Hazri app ki files, functions aur .github ko kabhi nahi hatata.
# PC par chalane ki aik line:  iex (irm https://raw.githubusercontent.com/samiullah-878/nt-traders-/main/clean.ps1)
$ErrorActionPreference = 'Stop'
$repo = 'https://github.com/samiullah-878/nt-traders-.git'
$keep = @('.git','.github','functions','.gitignore','.nojekyll','AI_NOTES.txt','LICENSES.txt','README.md','app.dom.test.mjs','app.fast.test.mjs','app.js','app.link.test.mjs','archivo-latin.woff2','auth.js','auth.test.mjs','boot.js','breaks.js','core.js','core.test.mjs','data.js','firebase-config-sw.js','firebase-config.js','firebase-messaging-sw.js','firebase.json','firestore.indexes.json','firestore.rules','icon-192.png','icon-512.png','icon.svg','index.html','jspdf.plugin.autotable.min.js','jspdf.umd.min.js','manager.js','manifest.webmanifest','naskh-arabic-400.woff2','naskh-arabic-700.woff2','notify.js','notify.test.mjs','owner.js','package.json','pages.yml','pdf.js','push.js','staffview.js','styles.css','sw.js','test-fake-sdk.mjs','tickets.js','ui.js','version.json','xlsx.mini.min.js')
function Say($t, $c = 'White') { Write-Host $t -ForegroundColor $c }
try {
  Say '=== Noor Traders HAZRI repo ki safai ===' Cyan
  # 1) Git hai ya nahi
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Say 'Git nahi mila - install ho raha hai (2-4 minute)...' Yellow
    winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements | Out-Null
    $env:Path += ';C:\Program Files\Git\cmd'
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git install nahi hua. PC restart kar ke dobara chalayein.' }
  }
  # 2) Repo PC par utaro (temp folder mein)
  $dir = Join-Path ([IO.Path]::GetTempPath()) ('nt-clean-' + (Get-Random))
  Say 'Hazri repo GitHub se aa raha hai...' Yellow
  git clone --quiet $repo $dir
  Set-Location $dir
  # 3) Hifazat: ye waqai hazri repo hai?
  if (-not (Test-Path 'boot.js') -or -not (Test-Path 'staffview.js')) { throw 'Ye hazri repo nahi lag raha (boot.js / staffview.js nahi mile). Kuch delete nahi kiya.' }
  if (-not (Select-String -Path 'index.html' -Pattern 'boot.js' -Quiet)) { Say 'DHYAN: index.html hazri wali nahi lag rahi. Safai ke baad poori hazri zip dobara upload karein.' Red }
  # 4) Faltu files ki list
  $extra = Get-ChildItem -Force | Where-Object { $keep -notcontains $_.Name } | ForEach-Object { $_.Name }
  if (-not $extra) { Say 'Koi faltu file nahi mili. Repo pehle se saaf hai.' Green; return }
  Say ('Ye ' + $extra.Count + ' files hazri app ki NAHI hain aur hatayi jayengi:') Yellow
  $extra | ForEach-Object { Say ('   - ' + $_) }
  $ans = Read-Host 'Delete karne ke liye Y likh kar Enter dabayein (kuch aur = ruk jaye)'
  if ($ans -notmatch '^[Yy]') { Say 'Theek hai, kuch delete nahi kiya.' Green; return }
  # 5) Delete + GitHub par bhejna
  foreach ($f in $extra) { git rm -r -q --cached -- "$f" 2>$null | Out-Null; Remove-Item -Recurse -Force -LiteralPath $f -ErrorAction SilentlyContinue }
  if (-not (git config user.email)) { git config user.email 'samiullah-878@users.noreply.github.com'; git config user.name 'samiullah-878' }
  git add -A
  git commit -q -m 'Khata app ki faltu files hazri repo se hatayi (clean.ps1)'
  Say 'GitHub par bhej rahe hain... (pehli dafa browser mein GitHub login khulega)' Yellow
  git push -q origin HEAD
  Say ('Ho gaya! ' + $extra.Count + ' faltu files hat gayin. 2-3 minute baad app kholein.') Green
} catch {
  Say ('Masla: ' + $_.Exception.Message) Red
  Say 'Is screen ki tasveer Claude ko bhej dein.' Red
} finally {
  Set-Location ([IO.Path]::GetTempPath())
  if ($dir -and (Test-Path $dir)) { Remove-Item -Recurse -Force $dir -ErrorAction SilentlyContinue }
  Read-Host 'Band karne ke liye Enter dabayein' | Out-Null
}
