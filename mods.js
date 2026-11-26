const ORIGINAL_SIZE = 40976;
const GIANT_SIZE = 65552;

const MUSIC = {
  original: [0x02, 0x01, 0x04, 0x08, 0x10, 0x20],
  star: 0x40,
  ground: 0x01,
  underground: 0x04,
  castle: 0x08,
  water: 0x02,
  bonus: 0x10,
};

const DEFAULTS = {
  timer: 9,
  lives: 3,
  jump: 1,
  run: 0x38,
  walk: 0x20,
  starForever: true,
  bricks: true,
  ramBricks: false,
  music: 'star',
  size: 'giant',
};

const LAYOUTS = {
  giant: {
    length: GIANT_SIZE,
    timer: 0x10d6,
    signature: [
      [0x0004, '02 04 41'],
      [0x10d6, '04 03 02'],
      [0x5cdb, '20 8f df b0 1c ac 4e 07 f0 1f ac 84 07 d0 1a 20 ed bc'],
    ],
    headSmash: [
      [0x5cdb, '4c ce dc'],
      [0x5cde, 'c9 24 90 08 c9 27 90 16 c9 c5 f0 12 20 58 83'],
    ],
  },
  normal: {
    length: ORIGINAL_SIZE,
    timer: 0x113e,
    signature: [
      [0x0004, '02 01 01'],
      [0x113e, '04 03 02'],
      [0x5ce5, '20 8f df b0 10 ac 4e 07 f0 13 ac 84 07 d0 0e 20 ed bc'],
    ],
    headSmash: [
      [0x5ce5, '4c d8 dc'],
      [0x5ce8, 'c9 24 90 08 c9 27 90 0a c9 c5 f0 06 20 58 83'],
    ],
  },
};

const SIGNATURE = [
  [0x107a, '02'],
  [0x10f7, '02 01 04 08 10 20'],
  [0x3442, 'fc fc fc fb fb'],
  [0x3450, 'd8 e8'],
  [0x3453, '28 18'],
  [0x2f51, 'ad 9f 07'],
  [0x2f62, 'ac 9f 07'],
  [0x4e1d, 'ad 9f 07'],
  [0x5802, 'ad 9f 07'],
  [0x589a, 'ad 9f 07'],
  [0x3d06, 'd0 02'],
  [0x3d24, 'ac 54 07 d0 01'],
  [0x0350, '01 80 02 81 41 80 01 42 c2 02 80 41 c1 41 c1 01 c1 01 02'],
  [0x0274, '20 6b 83'],
  [0x5e0f, '20 4b df'],
];

const RAM_BRICKS = [
  [0x0350, `a4 0e c0 08 d0 42 c9 c5 f0 3e aa a5 02 38 e9 10 a8 b1 06 c9 25 f0 31 8a
            a8 a5 9f 48 ad 33 04 48 98 20 ed bc ad ee 03 49 01 aa 68 8d 33 04 68 85 9f
            b5 26 c9 12 d0 10 bd e6 03 85 06 a9 05 85 07 bc e4 03 a9 00 91 06 60 4c 4b df`],
  [0x0274, '38 ea ea'],
  [0x5e0f, '4c 40 83'],
];

const STAR_READS = [
  [0x2f51, 'a9 10 ea'],
  [0x2f62, 'a0 10 ea'],
  [0x4e1d, 'a9 10 ea'],
  [0x5802, 'a9 10 ea'],
  [0x589a, 'a9 10 ea'],
];

function hexBytes(text) {
  return text.trim().split(/\s+/).map(h => parseInt(h, 16));
}

function write(rom, offset, bytes) {
  bytes.forEach((b, i) => { rom[offset + i] = b & 0xff; });
}

function applyIps(rom, patch) {
  let out = Uint8Array.from(rom);
  let i = 5;
  const u16 = p => (patch[p] << 8) | patch[p + 1];
  while (!(patch[i] === 0x45 && patch[i + 1] === 0x4f && patch[i + 2] === 0x46)) {
    const offset = (patch[i] << 16) | (patch[i + 1] << 8) | patch[i + 2];
    let size = u16(i + 3);
    i += 5;
    let data;
    if (size === 0) {
      size = u16(i);
      data = new Uint8Array(size).fill(patch[i + 2]);
      i += 3;
    } else {
      data = patch.subarray(i, i + size);
      i += size;
    }
    if (offset + size > out.length) {
      const grown = new Uint8Array(offset + size);
      grown.set(out);
      out = grown;
    }
    out.set(data, offset);
  }
  return out;
}

function makeIps(from, to) {
  const parts = [0x50, 0x41, 0x54, 0x43, 0x48];
  for (let i = 0; i < to.length; i++) {
    if (from[i] === to[i]) continue;
    let end = i;
    while (end < to.length && end - i < 0xffff && (from[end] !== to[end] || (end + 1 < to.length && from[end + 1] !== to[end + 1]))) end++;
    const size = end - i;
    parts.push((i >> 16) & 0xff, (i >> 8) & 0xff, i & 0xff, (size >> 8) & 0xff, size & 0xff);
    for (let k = i; k < end; k++) parts.push(to[k]);
    i = end;
  }
  parts.push(0x45, 0x4f, 0x46);
  return Uint8Array.from(parts);
}

function layoutOf(rom) {
  return rom.length === GIANT_SIZE ? LAYOUTS.giant : LAYOUTS.normal;
}

function matches(rom, list) {
  return list.every(([offset, text]) => hexBytes(text).every((b, k) => rom[offset + k] === b));
}

function isModBase(rom) {
  const layout = layoutOf(rom);
  return rom.length === layout.length && matches(rom, SIGNATURE) && matches(rom, layout.signature);
}

function prepareBases(rom, basePatch, invPatch) {
  if (rom.length !== ORIGINAL_SIZE && rom.length !== GIANT_SIZE) {
    throw new Error(`Unexpected ROM size ${rom.length} bytes. Load the Super Mario Bros. (World) ROM (${ORIGINAL_SIZE} bytes, with header) or the Giant Mario v1.2 + Invincible ROM (${GIANT_SIZE} bytes).`);
  }
  const giant = rom.length === ORIGINAL_SIZE ? applyIps(rom, basePatch) : rom;
  if (!isModBase(giant)) {
    throw new Error('This ROM does not match Super Mario Bros. (World) or Giant Mario v1.2 + Invincible Mario.');
  }
  let normal = null;
  if (rom.length === ORIGINAL_SIZE && invPatch) {
    const candidate = applyIps(rom, invPatch);
    if (isModBase(candidate)) normal = candidate;
  }
  return { giant, normal };
}

function prepareBase(rom, basePatch) {
  return prepareBases(rom, basePatch).giant;
}

function buildRom(base, opts) {
  const o = { ...DEFAULTS, ...opts };
  const layout = layoutOf(base);
  const rom = Uint8Array.from(base);

  if (o.timer) write(rom, layout.timer, [o.timer, o.timer, o.timer]);

  write(rom, 0x107a, [Math.max(1, Math.min(9, o.lives)) - 1]);

  const jump = Math.max(0, Math.min(3, o.jump));
  write(rom, 0x3442, hexBytes('fc fc fc fb fb').map(b => b - jump));

  write(rom, 0x3450, [256 - o.run, 256 - o.walk]);
  write(rom, 0x3453, [o.run, o.walk]);

  if (o.starForever) for (const [offset, text] of STAR_READS) write(rom, offset, hexBytes(text));

  if (o.bricks || o.ramBricks) {
    write(rom, 0x3d06, [0xea, 0xea]);
    write(rom, 0x3d24, hexBytes('a0 00 ea ea ea'));
  }

  if (o.ramBricks) for (const [offset, text] of [...RAM_BRICKS, ...layout.headSmash]) write(rom, offset, hexBytes(text));

  const music = o.music === 'original' ? MUSIC.original : new Array(6).fill(MUSIC[o.music] ?? MUSIC.star);
  write(rom, 0x10f7, music);

  return rom;
}

function musicValue(name, areaType) {
  if (name === 'original') return MUSIC.original[areaType & 3];
  return MUSIC[name] ?? MUSIC.star;
}

const GiantMarioMods = { DEFAULTS, ORIGINAL_SIZE, GIANT_SIZE, applyIps, makeIps, prepareBase, prepareBases, buildRom, musicValue };
if (typeof module !== 'undefined') module.exports = GiantMarioMods;
