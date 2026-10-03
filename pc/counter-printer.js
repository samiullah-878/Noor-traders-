// COUNTER-PRINTER: Windows ke printers ki list -> har counter (Abdurehman / Bilal bhai / Mithu) ka printer chuno -> local-config.json counterPrinters
const fs = require('fs'), path = require('path'), cp = require('child_process'), readline = require('readline');
const DIR = 'C:\\khata-sync', CFG = path.join(DIR, 'local-config.json');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); const ask = q => new Promise(r => rl.question(q, a => r(String(a || '').trim())));
let list = [];
try { list = cp.execSync('powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"', { encoding: 'utf8' }).split(/\r?\n/).map(s => s.trim()).filter(Boolean); } catch (e) { console.log('Printers ki list nahi mili: ' + e.message); }
(async () => {
  if (!list.length) { console.log('Koi printer nahi mila.'); process.exit(1); }
  console.log('\nIs PC par ye printers hain:'); list.forEach((n, i) => console.log('   ' + String(i + 1).padStart(2) + '.  ' + n));
  let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(CFG, 'utf8')); } catch {}
  const old = cfg.counterPrinters || {}, out = { ...old };
  for (const [k, name] of [['abdurehman', 'Abdurehman'], ['bilal', 'Bilal bhai'], ['mithu', 'Mithu']]) {
    const a = await ask(`\n${name} ka printer number? ${old[k] ? '(abhi: ' + old[k] + ' — khali chhoro to wahi)' : ''}: `);
    if (!a) continue; const i = Number(a) - 1; if (list[i]) { out[k] = list[i]; console.log('   ✓ ' + name + ' -> ' + list[i]); } else console.log('   ✗ ghalat number, chhor diya');
  }
  cfg.counterPrinters = out; fs.writeFileSync(CFG, JSON.stringify(cfg, null, 2));
  console.log('\n***** Mehfooz. Sale script agle bill se isi hisaab se chhapegi (restart ki zaroorat nahi).');
  for (const [k, n] of Object.entries(out)) console.log('   ' + k + ' -> ' + n);
  process.exit(0);
})();
