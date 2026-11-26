const fs = require('fs');
const path = require('path');

const input = process.argv[2];
if (!input) {
  console.log('usage: node mod.js "<giant mario rom>.nes"');
  process.exit(1);
}

const edits = [
  { name: 'Timer 900 seconds', offset: 0x10d6, from: '04 03 02', to: '09 09 09' },
  { name: 'Higher jump', offset: 0x3442, from: 'fc fc fc fb fb', to: 'fb fb fb fa fa' },
  { name: 'Faster run/walk left', offset: 0x3450, from: 'd8 e8', to: 'c8 e0' },
  { name: 'Faster run/walk right', offset: 0x3453, from: '28 18', to: '38 20' },
  { name: 'Star palette check', offset: 0x2f51, from: 'ad 9f 07', to: 'a9 10 ea' },
  { name: 'Star palette speed', offset: 0x2f62, from: 'ac 9f 07', to: 'a0 10 ea' },
  { name: 'Star body check', offset: 0x4e1d, from: 'ad 9f 07', to: 'a9 10 ea' },
  { name: 'Star hurt check', offset: 0x5802, from: 'ad 9f 07', to: 'a9 10 ea' },
  { name: 'Star enemy kill', offset: 0x589a, from: 'ad 9f 07', to: 'a9 10 ea' },
  { name: 'Break bricks when small', offset: 0x3d06, from: 'd0 02', to: 'ea ea' },
  { name: 'Clear broken brick when small', offset: 0x3d24, from: 'ac 54 07 d0 01', to: 'a0 00 ea ea ea' },
  { name: 'Star music as background', offset: 0x10f7, from: '02 01 04 08 10 20', to: '40 40 40 40 40 40' },
];

const hex = s => Buffer.from(s.replace(/\s+/g, ''), 'hex');
const original = fs.readFileSync(input);
const rom = Buffer.from(original);

for (const e of edits) {
  const from = hex(e.from);
  const found = rom.subarray(e.offset, e.offset + from.length);
  if (!found.equals(from)) {
    console.log(`${e.name}: expected ${e.from} at 0x${e.offset.toString(16)}, found ${[...found].map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
    console.log('This ROM is not the Giant Mario v1.2 (+ Invincible) ROM this mod was made for.');
    process.exit(1);
  }
  hex(e.to).copy(rom, e.offset);
  console.log('applied', e.name);
}

function ips(a, b) {
  const parts = [Buffer.from('PATCH')];
  for (let i = 0; i < b.length; i++) {
    if (a[i] === b[i]) continue;
    let end = i;
    while (end < b.length && end - i < 0xffff && (a[end] !== b[end] || (end + 1 < b.length && a[end + 1] !== b[end + 1]))) end++;
    const head = Buffer.alloc(5);
    head.writeUIntBE(i, 0, 3);
    head.writeUInt16BE(end - i, 3);
    parts.push(head, b.subarray(i, end));
    i = end;
  }
  parts.push(Buffer.from('EOF'));
  return Buffer.concat(parts);
}

const outDir = __dirname;
fs.writeFileSync(path.join(outDir, 'Giant Mario Mod.nes'), rom);
fs.writeFileSync(path.join(outDir, 'Giant Mario Mod.ips'), ips(original, rom));
console.log('wrote Giant Mario Mod.nes and Giant Mario Mod.ips to', outDir);
