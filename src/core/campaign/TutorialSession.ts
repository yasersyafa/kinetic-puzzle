import type { Action } from '../puzzle/GameRules';
export interface DialogueStep { text: string; action?: Action; highlightExit?: boolean; highlightBlockId?: string; inspectBlockId?: string; highlightParentId?: string }
export class TutorialSession {
  index = 0;
  finished = false;
  constructor(readonly steps: readonly DialogueStep[]) {}
  get current(): DialogueStep | undefined { return this.finished ? undefined : this.steps[this.index]; }
  next(): boolean { if (!this.current || this.current.action || this.current.inspectBlockId) return false; return this.advance(); }
  moved(action: Action): boolean {
    const expected = this.current?.action;
    return !!expected && expected.blockId === action.blockId && expected.dir === action.dir && this.advance();
  }
  inspected(blockId: string): boolean {
    return this.current?.inspectBlockId === blockId && this.advance();
  }
  skip(): void { this.finished = true; }
  private advance(): boolean { this.index++; this.finished = this.index >= this.steps.length; return true; }
}
