🤖 CLAUDE REMOTE — malik ke phone (MacroDroid) ke macros yahan se khud badalte hain
=====================================================================================
Malik (6 Nov 2026): "mera mobile khud connect karo — tum auto delete auto modify kar sako".

Kaise chalta hai:
- Phone par ek dafa ka macro "🤖 Claude Remote" (chat link se, tools/remote.py) har 5 min yeh file dekhta hai:
  https://samiullah-878.github.io/Noor-traders-/md/ver.txt
- ver.txt badla ho to phone:
  1) pehle saare macros ka backup  (/MacroDroid/Claude/nt-backup.mdr)
  2) Java (BeanShell): backup ki asal shakal le kar pkg.json ke "macros" se claude.mdr banata hai
     (sirf naye global variables jorta hai — purane variables / macros ko nahi chhoota)
  3) Import Macros = "Overwrite by ID" (wohi m_GUID = purana macro usi jagah badal jata hai)
  4) "off" ke naam (max 5) = DisableMacro by name (MacroDroid delete karne nahi deta — sirf band)
  5) notification "🤖 Claude ne macro badle (vN)"  /  ghalti par "🤖 Claude Remote — masla"

Naya / badla macro bhejna:
- tools/v3.py (Paani / Khana macros) → python3 tools/pkg.py <naya version no> → pkg.json + ver.txt → commit + push.
- Har macro ka m_GUID PAKKA (badlo mat), aiGenerated 0, har item ka apna SIGUID (pkg.py khud deta hai).
- "💧 Paani" ka m_GUID = purane "💧 Paani break" wala (-6917313488054668512) — woh usi jagah badal gaya.
- "🤖 Claude Remote" ko khud pkg mein KABHI mat daalo (chalta hua macro apne aap ko na badle).

⚠️ YEH FOLDER PUBLIC HAI — chaabi / password / bank key / AI key KABHI nahi (pkg.py check karta hai).
Phone se wapas jawab ka raasta NAHI — kya hua yeh malik batata hai.
