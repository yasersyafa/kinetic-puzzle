import { levelContentVersion } from '../core/puzzle/LevelVersion';
import * as existing from './ExistingLevels';
import type { LevelData, Direction } from '../types/Game';
export type { WorldPack } from './ExistingLevels';
export { starsFor } from './ExistingLevels';
export interface SolutionMove { blockId: string; dir: Direction }
export interface CampaignData {
  schemaVersion: string; campaignId: string; campaignVersion: string; contentHash: string; rulesVersion: string;
  levels: LevelData[]; solutions: Record<number, SolutionMove[]>;
  tutorials: Record<number, { title: string; body: string }>; roles: Record<number,string>;
}
declare const __GENERATED_CAMPAIGN__: CampaignData | null;
const generated = typeof __GENERATED_CAMPAIGN__ !== 'undefined' ? __GENERATED_CAMPAIGN__ : null;
export const IS_GENERATED_CAMPAIGN = !!generated;
export const CAMPAIGN_ID = generated?.campaignId ?? 'existing';
export const CAMPAIGN_VERSION = generated?.campaignVersion ?? '0.4.2';
export const LEVELS = generated?.levels ?? existing.LEVELS;
export const SOLUTIONS = generated?.solutions ?? existing.SOLUTIONS;
export const GENERATED_TUTORIALS = generated?.tutorials ?? {};
export const MAX_LEVEL_COLS = Math.max(...LEVELS.map(l => l.cols));
export const MAX_LEVEL_ROWS = Math.max(...LEVELS.map(l => l.rows));
export const FIXTURE_IDS = generated ? [] : existing.FIXTURE_IDS;
export const PACKS = generated
  ? [...new Set(LEVELS.map(l => l.pack ?? 'generated'))].map((id, i, all) => ({
    id, name: id === 'generated' ? 'Generated Campaign' : id.charAt(0).toUpperCase() + id.slice(1), theme: 'mixed',
    levelIds: LEVELS.filter(l => (l.pack ?? 'generated') === id).map(l => l.id),
    unlockAfter: i === 0 ? 0 : Math.max(...LEVELS.filter(l => (l.pack ?? 'generated') === all[i - 1]).map(l => l.id)),
  })) : existing.PACKS;
export function getSolution(id: number): SolutionMove[] { return SOLUTIONS[id] ?? []; }
export function getLevel(id: number): LevelData { return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, id - 1))]; }
export function getPackOf(id: number) { return PACKS.find(p => p.levelIds.includes(id)); }
export function levelVersion(id:number):string{return levelContentVersion(getLevel(id));}
