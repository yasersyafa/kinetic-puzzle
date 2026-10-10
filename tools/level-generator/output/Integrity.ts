import { createHash } from 'node:crypto';
/** Canonical hashes ignore object insertion order; arrays retain semantic order. */
export function hash(value:unknown):string {
  const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([,x])=>x!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>[k,canonical(x)])):v;
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
export function stableProof(value:unknown):unknown {
  if(Array.isArray(value))return value.map(stableProof);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!['elapsedMs','createdAt','retrievedAt'].includes(k)).map(([k,v])=>[k,stableProof(v)]));
  return value;
}

export function legacyHash(value:unknown):string{return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
