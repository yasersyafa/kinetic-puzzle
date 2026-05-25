import { LEVELS, PACKS } from '../src/config/Levels.ts';
import { BlockData } from '../src/types/Game.ts';

let errors = 0;

function err(levelId: number, msg: string): void {
  console.error(`L${levelId}: ${msg}`);
  errors++;
}

function packErr(packId: string, msg: string): void {
  console.error(`PACK[${packId}]: ${msg}`);
  errors++;
}

const VALID_TYPES = new Set(['simple', 'constrained', 'dependent', 'obstacle', 'lock']);
const VALID_DIRS = new Set(['UP', 'DOWN', 'LEFT', 'RIGHT']);
const VALID_SIDES = new Set(['TOP', 'BOTTOM', 'LEFT', 'RIGHT']);
const VALID_PACK_IDS = new Set(PACKS.map((p) => p.id));

console.log('id  size   blocks (s/c/d/o)  exits');
console.log('--- -----  ----------------  -----');

for (const level of LEVELS) {
  const ids = new Set<string>();
  const counts = { simple: 0, constrained: 0, dependent: 0, obstacle: 0 };

  for (const b of level.blocks as BlockData[]) {
    if (ids.has(b.id)) err(level.id, `duplicate block id ${b.id}`);
    ids.add(b.id);

    const type = b.type ?? 'simple';
    if (!VALID_TYPES.has(type)) err(level.id, `invalid type ${type} on ${b.id}`);
    counts[type as keyof typeof counts]++;

    const [c, r] = b.position;
    if (c < 0 || c >= level.cols || r < 0 || r >= level.rows) {
      err(level.id, `block ${b.id} position out of grid (${c},${r})`);
    }

    if (type === 'constrained') {
      if (!b.direction || !VALID_DIRS.has(b.direction)) {
        err(level.id, `constrained ${b.id} missing/invalid direction`);
      }
    }
    if (type === 'dependent') {
      if (!b.dependsOn) err(level.id, `dependent ${b.id} missing dependsOn`);
    }
  }

  for (const b of level.blocks as BlockData[]) {
    if (b.type === 'dependent' && b.dependsOn) {
      if (!ids.has(b.dependsOn)) {
        err(level.id, `dependent ${b.id} references missing block ${b.dependsOn}`);
      } else if (b.dependsOn === b.id) {
        err(level.id, `dependent ${b.id} cannot depend on itself`);
      }
    }
  }

  for (const e of level.exits) {
    if (!VALID_SIDES.has(e.side)) err(level.id, `invalid exit side ${e.side}`);
    const max = e.side === 'LEFT' || e.side === 'RIGHT' ? level.rows : level.cols;
    if (e.index < 0 || e.index >= max) {
      err(level.id, `exit ${e.side}@${e.index} out of range`);
    }
  }

  if (level.exits.length === 0) err(level.id, 'no exits defined');

  if (typeof level.parMoves !== 'number' || !Number.isFinite(level.parMoves) || level.parMoves < 1) {
    err(level.id, `invalid parMoves=${level.parMoves}`);
  }
  if (level.pack !== undefined && !VALID_PACK_IDS.has(level.pack)) {
    err(level.id, `unknown pack '${level.pack}'`);
  }

  const simple = counts.simple;
  const con = counts.constrained;
  const dep = counts.dependent;
  const obs = counts.obstacle;
  console.log(
    `${String(level.id).padStart(2)}  ${level.cols}x${level.rows}  ${String(simple).padStart(2)}/${String(con).padStart(2)}/${String(dep).padStart(2)}/${String(obs).padStart(2)}             ${String(level.exits.length).padStart(2)}`,
  );
}

// duplicate detection: signature = sorted block summary + sorted exits + grid
const sigs = new Map<string, number>();
for (const level of LEVELS) {
  const blockSig = [...level.blocks]
    .map((b) => `${b.type ?? 'simple'}@${b.position[0]},${b.position[1]}|${b.direction ?? ''}|${b.dependsOn ?? ''}`)
    .sort()
    .join(';');
  const exitSig = [...level.exits].map((e) => `${e.side}@${e.index}`).sort().join(';');
  const sig = `${level.cols}x${level.rows}#${blockSig}#${exitSig}`;
  if (sigs.has(sig)) {
    err(level.id, `duplicate of L${sigs.get(sig)}`);
  } else {
    sigs.set(sig, level.id);
  }
}

// Per-pack difficulty drift (warn if intra-pack drop >60% — usually intentional breather, but flag big ones)
for (const pack of PACKS) {
  const levels = LEVELS.filter((l) => l.pack === pack.id).sort((a, b) => a.id - b.id);
  if (levels.length === 0) {
    packErr(pack.id, 'no levels assigned');
    continue;
  }
  for (let i = 1; i < levels.length; i++) {
    const prev = levels[i - 1].parMoves;
    const cur = levels[i].parMoves;
    if (prev > 0 && cur < prev * 0.4) {
      console.warn(
        `PACK[${pack.id}] WARN: big difficulty drop L${levels[i - 1].id} par=${prev} → L${levels[i].id} par=${cur} (breather?)`,
      );
    }
  }
}

// Unique level IDs
const seenIds = new Set<number>();
for (const lvl of LEVELS) {
  if (seenIds.has(lvl.id)) err(lvl.id, 'duplicate level id');
  seenIds.add(lvl.id);
}

console.log('---');
console.log('packs:');
for (const p of PACKS) {
  const lvls = LEVELS.filter((l) => l.pack === p.id);
  const pars = lvls.map((l) => l.parMoves);
  const minP = pars.length ? Math.min(...pars) : 0;
  const maxP = pars.length ? Math.max(...pars) : 0;
  console.log(`  ${p.id}: ${lvls.length} levels, par range [${minP}..${maxP}]`);
}
console.log('---');
console.log(`total levels: ${LEVELS.length}`);
console.log(`errors: ${errors}`);
if (errors > 0) process.exit(1);
