// Kører hele testpakken og tæller PASS/FAIL. Afslutter med fejlkode, hvis noget fejler.
//   node tests/run-all.js            alle
//   node tests/run-all.js happy lod   kun de nævnte
const { spawnSync } = require('child_process');
const path = require('path');

const SUITES = [
  ['happy desktop', 'happy.js', ['desktop']],
  ['happy mobile', 'happy.js', ['mobile']],
  ['happy desktop dark', 'happy.js', ['desktop', 'dark']],
  ['happy mobile dark', 'happy.js', ['mobile', 'dark']],
  ['edge', 'edge.js', []],
  ['fixes', 'fixes.js', []],
  ['lod', 'lod.js', []],
  ['refine', 'refine.js', []],
  ['solver', 'solver.js', []],
  ['dup', 'dup.js', []],
  ['engine parity', 'engine-parity.js', []],
  ['engine props', 'engine-props.js', []],
];
const only = process.argv.slice(2);
let pass = 0, fail = 0, crashed = 0; const failures = [];
for (const [name, file, args] of SUITES) {
  if (only.length && !only.some(o => name.startsWith(o))) continue;
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, file), ...args], { encoding: 'utf8', env: { ...process.env, TAG: name.replace(/ /g, '-') + '-' } });
  const out = (r.stdout || '') + (r.stderr || '');
  const p = (out.match(/^PASS /gm) || []).length, f = (out.match(/^FAIL /gm) || []).length;
  pass += p; fail += f;
  if (r.status !== 0 && !/^FAIL /m.test(out)) { crashed++; failures.push(`${name}: CRASH\n${out.slice(-1200)}`); }
  for (const line of out.split('\n')) if (line.startsWith('FAIL ')) failures.push(`${name}: ${line}`);
  if (file === 'solver.js' || file === 'dup.js') {
    // disse to skriver JSON: vis de vigtigste tal
    const m = out.match(/"(subopt|dup|dups|itemsLost|ef1Fail|efFlagMismatch)":\s*(\d+)/g) || [];
    const bad = m.filter(x => !/:\s*0$/.test(x));
    if (bad.length) { fail++; failures.push(`${name}: ${bad.join(', ')}`); } else pass++;
  }
  console.log(`${(r.status === 0 ? 'ok  ' : 'FAIL')}  ${name.padEnd(20)} ${String(p).padStart(3)} pass ${String(f).padStart(2)} fail  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
console.log(`\n${pass} pass, ${fail} fail, ${crashed} crashed`);
if (failures.length) { console.log('\n' + failures.join('\n')); process.exit(1); }
