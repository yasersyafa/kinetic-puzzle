import type { StageDefinition } from './Stage';
export interface ProgressCatalog { campaignId: string; campaignVersion: string; levelVersions: Record<number, string>; stages: readonly StageDefinition[] }
export interface CompletionRecord { levelVersion: string }
export type Completions = Record<number, CompletionRecord>;
export function compatibleCompletions(raw: unknown, catalog: ProgressCatalog): Completions {
  if (!raw || typeof raw !== 'object') return {};
  const result: Completions = {};
  for (const [key, record] of Object.entries(raw)) {
    const id = Number(key);
    if (record && typeof record === 'object' && catalog.levelVersions[id] && (record as CompletionRecord).levelVersion === catalog.levelVersions[id]) result[id] = { levelVersion: catalog.levelVersions[id] };
  }
  return result;
}
export function importCompletions(snapshot: Record<string, unknown>, catalog: ProgressCatalog): Completions {
  const sameId = snapshot.campaignId === catalog.campaignId || (!snapshot.campaignId && catalog.campaignId === 'existing');
  if (!sameId) return {};
  const result = compatibleCompletions(snapshot.completedLevels, catalog);
  const exactLegacy = catalog.campaignId === 'existing' || snapshot.campaignVersion === catalog.campaignVersion;
  if (exactLegacy && snapshot.bestStars && typeof snapshot.bestStars === 'object') {
    for (const [key, stars] of Object.entries(snapshot.bestStars)) {
      const id = Number(key);
      if (typeof stars === 'number' && [1, 2, 3].includes(stars) && catalog.levelVersions[id]) result[id] = { levelVersion: catalog.levelVersions[id] };
    }
  }
  return result;
}
export function stageCleared(stage: StageDefinition, completed: Completions): boolean {
  return Array.from({ length: stage.levelCount }, (_, i) => stage.firstLevel + i).every(id => !!completed[id]);
}
export function progression(completed: Completions, catalog: ProgressCatalog): number {
  const ids = Object.keys(catalog.levelVersions).map(Number).sort((a, b) => a - b);
  return ids.find(id => !completed[id]) ?? ids[ids.length - 1] ?? 1;
}
export function canPlayLevel(id: number, unlocked: number, completed: Completions, stages: readonly StageDefinition[]): boolean {
  return id <= unlocked && stages.filter(s => s.firstLevel < id && s.firstLevel + s.levelCount <= id).every(s => stageCleared(s, completed));
}
