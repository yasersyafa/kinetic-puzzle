import { createStore } from 'zustand/vanilla';
import { persist, createJSONStorage } from 'zustand/middleware';
import { TOTAL_LEVELS } from '../config/Constants';

declare const __DEV__: boolean;
const DEV = typeof __DEV__ !== 'undefined' && __DEV__;

export const WATCH_COOLDOWN_MS = 3 * 60 * 1000;
export const PERSIST_KEY = 'fpp-game-state-v2';

export type StarCount = 1 | 2 | 3;

interface GameState {
  currentLevel: number;
  unlockedLevel: number;
  movesThisLevel: number;
  sfxEnabled: boolean;
  audioEnabled: boolean;
  tutorialSeenLevels: number[];

  bestStars: Record<number, StarCount>;

  equippedPalette: string;

  watchCooldownUntil: number;

  setCurrentLevel: (n: number) => void;
  unlockNext: () => void;
  incMoves: () => void;
  resetMoves: () => void;
  toggleAudio: () => void;
  hasSeenTutorial: (level: number) => boolean;
  markTutorialSeen: (level: number) => void;
  recordStars: (levelId: number, stars: StarCount) => StarCount;
  starsFor: (levelId: number) => StarCount | 0;
  totalStars: () => number;

  setEquippedPalette: (id: string) => void;
  resetProgress: () => void;
  unlockAll: () => void;
  unlockUpTo: (levelId: number) => void;

  startWatchCooldown: () => void;
  isWatchOnCooldown: () => boolean;
  getWatchCooldownSecondsLeft: () => number;
}

export function persistedSlice(s: GameState): Record<string, unknown> {
  return {
    currentLevel: s.currentLevel,
    unlockedLevel: s.unlockedLevel,
    sfxEnabled: s.sfxEnabled,
    audioEnabled: s.audioEnabled,
    tutorialSeenLevels: s.tutorialSeenLevels,
    bestStars: s.bestStars,
    equippedPalette: s.equippedPalette,
    watchCooldownUntil: s.watchCooldownUntil,
  };
}

interface CloudSnapshot {
  currentLevel?: number;
  unlockedLevel?: number;
  sfxEnabled?: boolean;
  audioEnabled?: boolean;
  tutorialSeenLevels?: number[];
  bestStars?: Record<string, StarCount>;
  equippedPalette?: string;
  watchCooldownUntil?: number;
}

export function mergeCloudSnapshot(cloud: unknown): boolean {
  if (!cloud || typeof cloud !== 'object') return false;
  // Zustand persist serializes as { state: {...}, version: n }
  const root = cloud as { state?: CloudSnapshot } & CloudSnapshot;
  const snap: CloudSnapshot = root.state ?? root;
  const cur = store.getState();

  const cloudStars = snap.bestStars
    ? Object.values(snap.bestStars).reduce((a, b) => a + (b as number), 0)
    : 0;
  const localStars = cur.totalStars();
  const cloudUnlock = snap.unlockedLevel ?? 0;
  const cloudWins = cloudUnlock > cur.unlockedLevel || cloudStars > localStars;
  if (!cloudWins) return false;

  const patch: Partial<GameState> = {};
  if (typeof snap.unlockedLevel === 'number') {
    patch.unlockedLevel = Math.max(cur.unlockedLevel, snap.unlockedLevel);
  }
  if (typeof snap.currentLevel === 'number') {
    patch.currentLevel = Math.max(cur.currentLevel, snap.currentLevel);
  }
  if (Array.isArray(snap.tutorialSeenLevels)) {
    const set = new Set<number>([...cur.tutorialSeenLevels, ...snap.tutorialSeenLevels]);
    patch.tutorialSeenLevels = [...set];
  }
  if (snap.bestStars && typeof snap.bestStars === 'object') {
    const merged: Record<number, StarCount> = { ...cur.bestStars };
    for (const [k, v] of Object.entries(snap.bestStars)) {
      const id = Number(k);
      if (!Number.isFinite(id)) continue;
      const prev = merged[id] ?? 0;
      const next = Math.max(prev, v as number) as StarCount;
      if (next !== prev) merged[id] = next;
    }
    patch.bestStars = merged;
  }
  if (typeof snap.equippedPalette === 'string') {
    patch.equippedPalette = snap.equippedPalette;
  }
  if (Object.keys(patch).length === 0) return false;
  store.setState(patch);
  return true;
}

const store = createStore<GameState>()(
  persist(
    (set, get) => ({
      currentLevel: 1,
      unlockedLevel: 1,
      movesThisLevel: 0,
      sfxEnabled: true,
      audioEnabled: true,
      tutorialSeenLevels: [],

      bestStars: {},

      equippedPalette: 'classic',

      watchCooldownUntil: 0,

      setCurrentLevel: (n) => set({ currentLevel: n, movesThisLevel: 0 }),
      unlockNext: () =>
        set((s) => ({
          unlockedLevel: Math.min(TOTAL_LEVELS, Math.max(s.unlockedLevel, s.currentLevel + 1)),
        })),
      incMoves: () => set((s) => ({ movesThisLevel: s.movesThisLevel + 1 })),
      resetMoves: () => set({ movesThisLevel: 0 }),
      toggleAudio: () =>
        set((s) => {
          const next = !s.sfxEnabled;
          return { sfxEnabled: next, audioEnabled: next };
        }),
      hasSeenTutorial: (level) => get().tutorialSeenLevels.includes(level),
      markTutorialSeen: (level) =>
        set((s) =>
          s.tutorialSeenLevels.includes(level)
            ? s
            : { tutorialSeenLevels: [...s.tutorialSeenLevels, level] },
        ),
      recordStars: (levelId, stars) => {
        const prev = get().bestStars[levelId] ?? 0;
        const next: StarCount = (Math.max(prev, stars) as StarCount);
        if (next !== prev) {
          set((s) => ({ bestStars: { ...s.bestStars, [levelId]: next } }));
        }
        return next;
      },
      starsFor: (levelId) => get().bestStars[levelId] ?? 0,
      totalStars: () =>
        Object.values(get().bestStars).reduce((sum, s) => sum + (s as number), 0),
      setEquippedPalette: (id) => set({ equippedPalette: id }),
      resetProgress: () =>
        set({
          currentLevel: 1, unlockedLevel: 1, movesThisLevel: 0, tutorialSeenLevels: [],
          bestStars: {}, watchCooldownUntil: 0,
        }),
      unlockAll: () => set({ unlockedLevel: TOTAL_LEVELS }),
      unlockUpTo: (levelId) =>
        set((s) => ({
          unlockedLevel: Math.min(TOTAL_LEVELS, Math.max(s.unlockedLevel, levelId)),
        })),

      startWatchCooldown: () => {
        if (DEV) return;
        set({ watchCooldownUntil: Date.now() + WATCH_COOLDOWN_MS });
      },
      isWatchOnCooldown: () => {
        if (DEV) return false;
        return Date.now() < get().watchCooldownUntil;
      },
      getWatchCooldownSecondsLeft: () => {
        if (DEV) return 0;
        const remain = get().watchCooldownUntil - Date.now();
        return Math.max(0, Math.ceil(remain / 1000));
      },
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => persistedSlice(s) as Partial<GameState>,
      migrate: (persisted: unknown) => {
        if (persisted && typeof persisted === 'object') {
          const p = persisted as Record<string, unknown>;
          if (p.sfxEnabled === undefined && typeof p.audioEnabled === 'boolean') {
            p.sfxEnabled = p.audioEnabled;
          }
          if (p.audioEnabled === undefined && typeof p.sfxEnabled === 'boolean') {
            p.audioEnabled = p.sfxEnabled;
          }
          if (!Array.isArray(p.tutorialSeenLevels)) {
            p.tutorialSeenLevels = p.tutorialDone === true ? [1, 3, 5] : [];
          }
          if (!p.bestStars || typeof p.bestStars !== 'object') {
            p.bestStars = {};
          }
          // Migrate equippedSkin → equippedPalette
          if (typeof p.equippedPalette !== 'string') {
            if (typeof p.equippedSkin === 'string') {
              p.equippedPalette = 'classic';
            } else {
              p.equippedPalette = 'classic';
            }
          }
          delete p.streak;
          delete p.lastPlayDate;
          delete p.dailyHistory;
          delete p.dailyMode;
          delete p.dailyLevelId;
          delete p.equippedSkin;
          delete p.tutorialDone;
        }
        return persisted as GameState;
      },
    }
  )
);

export const useGameStore = {
  getState: () => store.getState(),
  setState: store.setState,
  subscribe: store.subscribe,
};
