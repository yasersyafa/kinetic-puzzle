import type { LevelData } from '../../types/Game';
export interface ValidationIssue { code: string; levelId?: number; path: string; message: string }
export interface ValidationOptions { minGrid?: number; maxGrid?: number; packIds?: readonly string[] }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);
const pair = (v: unknown): v is [number,number] => Array.isArray(v) && v.length === 2 && v.every(integer);
const types = ['simple','constrained','dependent','obstacle','lock'];
const dirs = ['UP','DOWN','LEFT','RIGHT'];
const sides = ['TOP','BOTTOM','LEFT','RIGHT'];
const colors = ['red','blue','green','yellow','purple','orange'];
export function validateLevel(input: unknown, options: ValidationOptions = {}): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  const add = (path: string, message: string, code = 'INVALID_FIELD') => errors.push({
    code, levelId: record(input) && integer(input.id) ? input.id : undefined, path, message,
  });
  if (!record(input)) { add('$','Expected a level object'); return errors; }
  const l = input;
  if (!integer(l.id) || l.id < 1) add('id','Expected positive integer');
  const min = options.minGrid ?? 1, max = options.maxGrid ?? 12;
  for (const name of ['cols','rows']) if (!integer(l[name]) || (l[name] as number) < min || (l[name] as number) > max)
    add(name,`Expected integer between ${min} and ${max}`);
  if (!integer(l.parMoves) || l.parMoves < 1) add('parMoves','Expected positive integer');
  if (l.pack !== undefined && (typeof l.pack !== 'string' || !l.pack || (options.packIds && !options.packIds.includes(l.pack))))
    add('pack','Unknown or invalid pack');
  const cols = integer(l.cols) ? l.cols : 0, rows = integer(l.rows) ? l.rows : 0;
  const inGrid = ([x,y]: [number,number]) => x >= 0 && y >= 0 && x < cols && y < rows;
  const ids = new Map<string,Record<string,unknown>>();
  const occupied = new Set<string>();
  if (!Array.isArray(l.blocks) || !l.blocks.length) add('blocks','Expected nonempty blocks array');
  else {
    let movables = 0;
    l.blocks.forEach((b: unknown,i: number) => {
      const p = `blocks[${i}]`;
      if (!record(b)) { add(p,'Expected block object'); return; }
      if (typeof b.id !== 'string' || !b.id.trim()) add(`${p}.id`,'Expected nonempty ID');
      else { if (ids.has(b.id)) add(`${p}.id`,'Duplicate block ID','DUPLICATE'); ids.set(b.id,b); }
      const t = b.type === undefined ? 'simple' : b.type;
      if (!types.includes(t as string)) add(`${p}.type`,'Unknown block type');
      if (t !== 'obstacle') movables++;
      if (!colors.includes(b.color as string)) add(`${p}.color`,'Unknown color');
      if (!pair(b.size) || b.size[0] !== 1 || b.size[1] !== 1) add(`${p}.size`,'Rules v1 supports only 1x1 blocks','UNSUPPORTED_RULE');
      if (!pair(b.position) || !inGrid(b.position)) add(`${p}.position`,'Expected in-grid integer coordinates');
      else { const k = b.position.join(','); if (occupied.has(k)) add(`${p}.position`,'Solid block overlap','OVERLAP'); occupied.add(k); }
      if ((t === 'constrained' || b.direction !== undefined) && !dirs.includes(b.direction as string)) add(`${p}.direction`,'Missing or invalid direction');
      if ((t === 'dependent' || b.dependsOn !== undefined) && (typeof b.dependsOn !== 'string' || !b.dependsOn)) add(`${p}.dependsOn`,'Missing dependency');
      if ((t === 'lock' || b.unlockAt !== undefined) && (!integer(b.unlockAt) || b.unlockAt < 0)) add(`${p}.unlockAt`,'Expected nonnegative integer');
      if (b.allowedExits !== undefined && (!Array.isArray(b.allowedExits) || b.allowedExits.length !== 4 || new Set(b.allowedExits).size !== 4 || !b.allowedExits.every(s => sides.includes(s))))
        add(`${p}.allowedExits`,'Restricted exits are not implemented by runtime','UNSUPPORTED_RULE');
    });
    if (!movables) add('blocks','At least one movable block required');
    l.blocks.forEach((b: unknown,i: number) => {
      if (!record(b)) return;
      if (b.type === 'lock' && integer(b.unlockAt) && b.unlockAt > movables - 1) add(`blocks[${i}].unlockAt`,'Threshold cannot be reached before this block exits','IMPOSSIBLE_LOCK');
      if (b.type !== 'dependent' || typeof b.dependsOn !== 'string') return;
      const dep = ids.get(b.dependsOn);
      if (!dep) add(`blocks[${i}].dependsOn`,'Reference does not exist');
      else if (dep.type === 'obstacle') add(`blocks[${i}].dependsOn`,'Obstacle cannot exit');
      const seen = new Set<string>(); let cursor: Record<string,unknown> | undefined = b;
      while (cursor && cursor.type === 'dependent' && typeof cursor.id === 'string') {
        if (seen.has(cursor.id)) { add(`blocks[${i}].dependsOn`,'Dependency cycle','DEPENDENCY_CYCLE'); break; }
        seen.add(cursor.id); cursor = typeof cursor.dependsOn === 'string' ? ids.get(cursor.dependsOn) : undefined;
      }
    });
  }
  if (!Array.isArray(l.exits) || !l.exits.length) add('exits','At least one exit required');
  else {
    const seen = new Set<string>();
    l.exits.forEach((e: unknown,i: number) => {
      if (!record(e)) { add(`exits[${i}]`,'Expected exit object'); return; }
      if (!sides.includes(e.side as string)) add(`exits[${i}].side`,'Unknown exit side');
      const bound = e.side === 'LEFT' || e.side === 'RIGHT' ? rows : cols;
      if (!integer(e.index) || e.index < 0 || e.index >= bound) add(`exits[${i}].index`,'Exit out of range');
      const k = `${e.side}:${e.index}`; if (seen.has(k)) add(`exits[${i}]`,'Duplicate exit','DUPLICATE'); seen.add(k);
    });
  }
  if (l.iceCells !== undefined) {
    if (!Array.isArray(l.iceCells)) add('iceCells','Expected array');
    else { const seen = new Set<string>(); l.iceCells.forEach((c: unknown,i: number) => {
      if (!pair(c) || !inGrid(c)) add(`iceCells[${i}]`,'Invalid ice coordinate');
      else { const k = c.join(','); if (seen.has(k)) add(`iceCells[${i}]`,'Duplicate ice cell','DUPLICATE'); seen.add(k); }
    }); }
  }
  return errors;
}
export function validateCatalog(levels: unknown[], options: ValidationOptions = {}): ValidationIssue[] {
  const issues = levels.flatMap(l => validateLevel(l,options)); const ids = new Set<number>();
  for (const l of levels) if (record(l) && integer(l.id)) {
    if (ids.has(l.id)) issues.push({ code:'DUPLICATE',levelId:l.id,path:'id',message:'Duplicate level ID' }); ids.add(l.id);
  }
  return issues;
}
export function assertLevel(input: unknown, options: ValidationOptions = {}): asserts input is LevelData {
  const issues = validateLevel(input,options);
  if (issues.length) throw new Error(issues.map(e => `L${e.levelId ?? '?'} ${e.path}: ${e.message}`).join('\n'));
}
