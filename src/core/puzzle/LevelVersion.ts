import type { LevelData } from '../../types/Game';
/** Shared sync content fingerprint for runtime telemetry and offline predictions. */
export function levelContentVersion(level:LevelData):string {
  const text=JSON.stringify(level);let value=2166136261;
  for(let i=0;i<text.length;i++)value=Math.imul(value^text.charCodeAt(i),16777619);
  return (value>>>0).toString(16);
}
