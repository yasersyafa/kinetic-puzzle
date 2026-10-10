import { createState,gameRules,type Action } from '../../../src/core/puzzle/GameRules';
import type { LevelData, Direction, ExitSide } from '../../../src/types/Game';
// Identity-independent graph canonicalization: per-cell labels replace block IDs in dependencies.
export function canonicalSignature(level: LevelData): string {
  const transforms = [
    {point:(x:number,y:number)=>[x,y],dir:{UP:'UP',DOWN:'DOWN',LEFT:'LEFT',RIGHT:'RIGHT'},side:{TOP:'TOP',BOTTOM:'BOTTOM',LEFT:'LEFT',RIGHT:'RIGHT'}},
    {point:(x:number,y:number)=>[level.cols-1-x,y],dir:{UP:'UP',DOWN:'DOWN',LEFT:'RIGHT',RIGHT:'LEFT'},side:{TOP:'TOP',BOTTOM:'BOTTOM',LEFT:'RIGHT',RIGHT:'LEFT'}},
    {point:(x:number,y:number)=>[x,level.rows-1-y],dir:{UP:'DOWN',DOWN:'UP',LEFT:'LEFT',RIGHT:'RIGHT'},side:{TOP:'BOTTOM',BOTTOM:'TOP',LEFT:'LEFT',RIGHT:'RIGHT'}},
    {point:(x:number,y:number)=>[level.cols-1-x,level.rows-1-y],dir:{UP:'DOWN',DOWN:'UP',LEFT:'RIGHT',RIGHT:'LEFT'},side:{TOP:'BOTTOM',BOTTOM:'TOP',LEFT:'RIGHT',RIGHT:'LEFT'}},
  ];
  // Transposition also covers 90/270 degree rotations and diagonal reflections on rectangular boards.
  const signatures:string[]=[];
  for (const t of transforms) for (const transpose of [false,true]) {
    const point = (x:number,y:number):number[] => {const p=t.point(x,y);return transpose?[p[1],p[0]]:p;};
    const transDir:Record<string,string>={UP:'LEFT',DOWN:'RIGHT',LEFT:'UP',RIGHT:'DOWN'};
    const transSide:Record<string,string>={TOP:'LEFT',BOTTOM:'RIGHT',LEFT:'TOP',RIGHT:'BOTTOM'};
    const labels=new Map(level.blocks.map(b=>[b.id,point(...b.position).join(',')]));
    const blocks=level.blocks.map(b=> {
      const type=b.type==='lock'&&(b.unlockAt??0)===0?'simple':b.type??'simple';
      const dir=type==='constrained'&&b.direction?t.dir[b.direction as Direction]:'';
      return [type,labels.get(b.id),dir && transpose?transDir[dir]:dir,type==='dependent'&&b.dependsOn?labels.get(b.dependsOn):'',type==='lock'?b.unlockAt??0:0,
        transpose?[b.size[1],b.size[0]]:b.size];
    }).map(v=>JSON.stringify(v)).sort();
    const exits=level.exits.map(e=> {
      const x=e.side==='LEFT'?0:e.side==='RIGHT'?level.cols-1:e.index;
      const y=e.side==='TOP'?0:e.side==='BOTTOM'?level.rows-1:e.index;
      const p=point(x,y); const s=t.side[e.side as ExitSide]; const side=transpose?transSide[s]:s;
      return `${side}:${side==='LEFT'||side==='RIGHT'?p[1]:p[0]}`;
    }).sort();
    signatures.push(JSON.stringify([transpose?level.rows:level.cols,transpose?level.cols:level.rows,blocks,exits,(level.iceCells??[]).map(p=>point(...p).join(',')).sort()]));
  }
  return signatures.sort()[0];
}
export function similarity(a: LevelData,b:LevelData):number {
  if (canonicalSignature(a)===canonicalSignature(b)) return 1;
  const x=structuralFeatures(a),y=structuralFeatures(b);const intersection=[...x].filter(v=>y.has(v)).length;
  return intersection/new Set([...x,...y]).size;
}
export interface DiversityAnalysis { exactDuplicate:boolean;solutionSimilarity?:number;solutionSimilarLevelId?:number; similarLevelId?:number; similarity:number; reasons:string[] }
export function evaluateDiversity(level:LevelData,catalog:readonly LevelData[]):DiversityAnalysis {
  const signature=canonicalSignature(level); let best=0, id:number|undefined; let exact=false;
  for (const other of catalog) {
    const same=signature===canonicalSignature(other);const score=same?1:similarity(level,other);
    if (score>best) {best=score;id=other.id;} if(same)exact=true;
  }
  return {exactDuplicate:exact,similarLevelId:id,similarity:best,reasons:exact?['Equivalent layout under valid geometric transform and ID renaming']:best>0?['Structural feature similarity (estimate; not equivalence proof)']:[]};
}

export function solutionPattern(level:LevelData,path:readonly Action[]):string[] {
  let state=createState(level);const labels=new Map<string,number>();let next=0;
  return path.map(action=>{if(!labels.has(action.blockId))labels.set(action.blockId,next++);const t=gameRules.applyAction(state,action),block=state.blocks.find(b=>b.blockId===action.blockId)!;const stopper=state.blocks.find(b=>b.blockId===t.trace.stopperId);
    const token=`${labels.get(action.blockId)}:${block.type}:${t.result.kind}:${t.trace.icePush?'ice':stopper?stopper.type==='obstacle'?'obstacle':'stopper':'free'}`;state=t.state;return token;});
}
export function solutionPatternSimilarity(a:readonly string[],b:readonly string[]):number {
  if(!a.length||!b.length)return 0;
  let row=Array(b.length+1).fill(0) as number[];
  for(const token of a){const next=Array(b.length+1).fill(0) as number[];for(let j=1;j<=b.length;j++)next[j]=token===b[j-1]?row[j-1]+1:Math.max(row[j],next[j-1]);row=next;}
  return 2*row[b.length]/(a.length+b.length);
}

export function structuralFeatures(l:LevelData):Set<string>{return new Set([
    `grid:${Math.min(l.cols,l.rows)}:${Math.max(l.cols,l.rows)}`,
    ...l.blocks.map(x=>`type:${x.type??'simple'}:${x.type==='lock'?x.unlockAt??0:''}`),
    `movables:${l.blocks.filter(b=>b.type!=='obstacle').length}`,`obstacles:${l.blocks.filter(b=>b.type==='obstacle').length}`,
    `exits:${l.exits.length}`,`ice:${l.iceCells?.length??0}`,`par:${Math.floor(l.parMoves/3)}`,
  ]);}
