import { campaignStorage } from './CampaignStorage';
import { createStore } from 'zustand/vanilla';
import { persist, createJSONStorage } from 'zustand/middleware';
import { TOTAL_LEVELS } from '../config/Constants';
import { CAMPAIGN_ID, CAMPAIGN_VERSION, IS_GENERATED_CAMPAIGN, LEVELS, STAGES, levelVersion } from '../config/Levels';
import { importCompletions, compatibleCompletions, progression, canPlayLevel, type Completions, type ProgressCatalog } from '../core/campaign/Progress';

export const PERSIST_KEY = IS_GENERATED_CAMPAIGN ? `fpp-game-state-v3-${CAMPAIGN_ID}` : 'fpp-game-state-v2';
const LEGACY_KEY = IS_GENERATED_CAMPAIGN ? `fpp-game-state-v2-${CAMPAIGN_ID}-${CAMPAIGN_VERSION}` : undefined;
const catalog: ProgressCatalog = { campaignId: CAMPAIGN_ID, campaignVersion: CAMPAIGN_VERSION, levelVersions: Object.fromEntries(LEVELS.map(l => [l.id, levelVersion(l.id)])), stages: STAGES };
const tutorialKey = (level: number, version = 'dialogue-1') => `${level}:${catalog.levelVersions[level]}:${version}`;

interface GameState {
  currentLevel: number; unlockedLevel: number; movesThisLevel: number;
  sfxEnabled: boolean; audioEnabled: boolean;
  completedLevels: Completions; tutorialSeen: string[];
  setCurrentLevel: (n: number) => void; unlockNext: () => void; incMoves: () => void; resetMoves: () => void;
  toggleAudio: () => void; hasSeenTutorial: (level: number, version?: string) => boolean; markTutorialSeen: (level: number, version?: string) => void;
  recordCompletion: (id: number) => void; isCompleted: (id: number) => boolean; canPlay: (id: number) => boolean;
  resetProgress: () => void; unlockAll: () => void; unlockUpTo: (id: number) => void;
}
export function persistedSlice(s: GameState): Record<string, unknown> {
  return { campaignId: CAMPAIGN_ID, campaignVersion: CAMPAIGN_VERSION, currentLevel: s.currentLevel,
    unlockedLevel: progression(s.completedLevels, catalog), completedLevels: s.completedLevels, tutorialSeen: s.tutorialSeen,
    sfxEnabled: s.sfxEnabled, audioEnabled: s.audioEnabled };
}
function restore(raw: unknown): Partial<GameState> {
  const p = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const completedLevels = importCompletions(p, catalog), unlockedLevel = progression(completedLevels, catalog);
  return { completedLevels, unlockedLevel, currentLevel: Math.max(1, Math.min(unlockedLevel, typeof p.currentLevel === 'number' && Number.isInteger(p.currentLevel) ? p.currentLevel : 1)),
    tutorialSeen: Array.isArray(p.tutorialSeen) ? p.tutorialSeen.filter((k): k is string => typeof k === 'string' && LEVELS.some(l => k.startsWith(`${l.id}:${catalog.levelVersions[l.id]}:`))) : [],
    sfxEnabled: typeof p.sfxEnabled === 'boolean' ? p.sfxEnabled : typeof p.audioEnabled === 'boolean' ? p.audioEnabled : true,
    audioEnabled: typeof p.audioEnabled === 'boolean' ? p.audioEnabled : typeof p.sfxEnabled === 'boolean' ? p.sfxEnabled : true };
}
export function mergeCloudSnapshot(cloud: unknown): boolean {
  if (!cloud || typeof cloud !== 'object') return false;
  const root = cloud as Record<string, unknown>, snap = (root.state ?? root) as Record<string, unknown>;
  if (!snap || typeof snap !== 'object' || (snap.campaignId !== CAMPAIGN_ID && !(CAMPAIGN_ID === 'existing' && !snap.campaignId))) return false;
  const cur = store.getState(), incoming = importCompletions(snap, catalog), completedLevels = { ...cur.completedLevels, ...incoming };
  const tutorialSeen = [...new Set([...cur.tutorialSeen, ...(restore(snap).tutorialSeen ?? [])])];
  if (JSON.stringify(completedLevels) === JSON.stringify(cur.completedLevels) && tutorialSeen.length === cur.tutorialSeen.length) return false;
  store.setState({ completedLevels, unlockedLevel: progression(completedLevels, catalog), tutorialSeen }); return true;
}
const baseStorage = typeof localStorage !== 'undefined' ? campaignStorage(localStorage) : undefined;
const storage = baseStorage && { ...baseStorage, getItem(name: string) { return !localStorage.getItem(name) && LEGACY_KEY && localStorage.getItem(LEGACY_KEY) ? baseStorage.getItem(LEGACY_KEY) : baseStorage.getItem(name); } };
const store = createStore<GameState>()(persist((set, get) => ({
  currentLevel: 1, unlockedLevel: 1, movesThisLevel: 0, sfxEnabled: true, audioEnabled: true,
  completedLevels: {}, tutorialSeen: [],
  setCurrentLevel: n => set({ currentLevel: Math.max(1, Math.min(TOTAL_LEVELS, n)), movesThisLevel: 0 }),
  unlockNext: () => set(s => ({ unlockedLevel: progression(s.completedLevels, catalog) })),
  incMoves: () => set(s => ({ movesThisLevel: s.movesThisLevel + 1 })), resetMoves: () => set({ movesThisLevel: 0 }),
  toggleAudio: () => set(s => ({ sfxEnabled: !s.sfxEnabled, audioEnabled: !s.sfxEnabled })),
  hasSeenTutorial: (level, version) => get().tutorialSeen.includes(tutorialKey(level, version)),
  markTutorialSeen: (level, version) => set(s => ({ tutorialSeen: [...new Set([...s.tutorialSeen, tutorialKey(level, version)])] })),
  recordCompletion: id => { if (catalog.levelVersions[id]) set(s => ({ completedLevels: { ...compatibleCompletions(s.completedLevels, catalog), [id]: { levelVersion: catalog.levelVersions[id] } } })); },
  isCompleted: id => !!catalog.levelVersions[id] && get().completedLevels[id]?.levelVersion === catalog.levelVersions[id],
  canPlay: id => !!catalog.levelVersions[id] && canPlayLevel(id, get().unlockedLevel, get().completedLevels, STAGES),
  resetProgress: () => set({ currentLevel: 1, unlockedLevel: 1, movesThisLevel: 0, completedLevels: {}, tutorialSeen: [] }),
  unlockAll: () => set({ unlockedLevel: TOTAL_LEVELS }),
  unlockUpTo: id => set(s => ({ unlockedLevel: Math.min(TOTAL_LEVELS, Math.max(s.unlockedLevel, id)) })),
}), { name: PERSIST_KEY, version: 3, storage: storage ? createJSONStorage(() => storage) : undefined,
  partialize: s => persistedSlice(s) as Partial<GameState>, migrate: raw => ({ ...restore(raw), campaignId: CAMPAIGN_ID, campaignVersion: CAMPAIGN_VERSION }), merge: (raw, current) => ({ ...current, ...restore(raw) }) }));
export const useGameStore = { getState: () => store.getState(), setState: store.setState, subscribe: store.subscribe };
