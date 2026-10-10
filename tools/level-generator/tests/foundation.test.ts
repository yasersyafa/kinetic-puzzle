import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { LEVELS, SOLUTIONS } from '../../../src/config/Levels';
import { createState, gameRules, stateGrid, DIRECTIONS } from '../../../src/core/puzzle/GameRules';
import { validateLevel, validateCatalog } from '../../../src/core/puzzle/LevelValidator';
import { replaySolution } from '../../../src/core/puzzle/SolutionReplay';
import { solve } from '../core/SolverV2';
import { LegacyMovementOracle } from './LegacyMovementOracle';
import type { LevelData } from '../../../src/types/Game';
const tiny: LevelData = { id:1,cols:3,rows:1,blocks:[{id:'a',color:'red',position:[0,0],size:[1,1]}],exits:[{side:'RIGHT',index:0}],parMoves:1 };
test('BFS proves optimal exit and replay; path cannot skip invalid actions', () => {
  const r = solve(tiny); assert.equal(r.status,'SOLVED'); assert.equal(r.optimalMoves,1);
  assert.equal(replaySolution(tiny,r.solutionPath!).success,true);
  assert.equal(replaySolution(tiny,[{blockId:'missing',dir:'RIGHT'}]).failedAction,0);
});
test('exhaustion, timeout and resource limits have distinct statuses', () => {
  const impossible: LevelData = {...tiny,rows:2,blocks:[{...tiny.blocks[0],type:'constrained',direction:'LEFT'}]};
  assert.equal(solve(impossible).status,'UNSOLVABLE');
  assert.equal(solve(tiny,{timeoutMs:0}).status,'TIMEOUT');
  for (const limit of [{maxStates:1},{maxTransitions:0},{maxDepth:0}]) assert.equal(solve(tiny,limit).status,'RESOURCE_LIMIT');
});
test('schema errors are specific, reject unsupported rules, cycles, overlaps and malformed data', () => {
  assert.equal(validateLevel(tiny).length,0);
  for (const value of [null,{}, {...tiny,blocks:[{...tiny.blocks[0],type:null}]},{...tiny,blocks:[{...tiny.blocks[0],unlockAt:'1'}]}, {...tiny,cols:NaN},{...tiny,blocks:[{...tiny.blocks[0],size:[2,1]}]},
    {...tiny,blocks:[tiny.blocks[0],{...tiny.blocks[0],id:'b'}]},
    {...tiny,blocks:[{...tiny.blocks[0],type:'dependent',dependsOn:'a'}]},
    {...tiny,blocks:[{...tiny.blocks[0],allowedExits:['RIGHT']}]}]) {
    const errors = validateLevel(value); assert.ok(errors.length); assert.ok(errors.every(e=> e.path && e.message));
  }
  assert.ok(validateCatalog([tiny,tiny]).some(e => e.path==='id'));
});
test('all existing levels satisfy schema and stored paths replay without coercion', () => {
  assert.deepEqual(validateCatalog(LEVELS),[]);
  const failures = LEVELS.map(l => ({id:l.id,result:replaySolution(l,SOLUTIONS[l.id] ?? [])})).filter(r=>!r.result.success);
  assert.deepEqual(failures.map(f=>({id:f.id,reason:f.result.reason,step:f.result.failedAction})),[]);
});
test('ice and lock fixtures preserve runtime behavior', () => {
  for (const id of [73,74,75,76,77,78,79,80]) {
    const l = LEVELS.find(l=>l.id===id)!; const replay = replaySolution(l,SOLUTIONS[id]);
    assert.equal(replay.success,true,`L${id}`);
    if (id <= 75) assert.ok(replay.transitions.some(t=>t.trace.icePush));
  }
});
test('10,000+ state/action differential comparisons with frozen movement oracle', () => {
  const oracle = new LegacyMovementOracle(); let comparisons = 0;
  fc.assert(fc.property(fc.integer({min:0,max:LEVELS.length-1}),fc.array(fc.nat(),{minLength:8,maxLength:24}), (index,choices) => {
    let state = createState(LEVELS[index]);
    for (const choice of choices) {
      const grid = stateGrid(state); const snapshot = JSON.stringify(state);
      for (const b of state.blocks) for (const dir of DIRECTIONS) {
        const expected = oracle.slide(b,grid,dir,[...state.blocks]);
        const actual = gameRules.applyAction(state,{blockId:b.blockId,dir}); comparisons++;
        assert.deepEqual(actual.result,expected);
        assert.equal(JSON.stringify(state),snapshot);
        if (expected.kind==='invalid') assert.equal(actual.state,state);
      }
      const actions = gameRules.getLegalActions(state);
      if (!actions.length) break;
      state = gameRules.applyAction(state,actions[choice%actions.length]).state;
      const solids = state.blocks.filter(b=>!b.removed).map(b=>b.gridPos.join(','));
      assert.equal(new Set(solids).size,solids.length);
      assert.ok(state.blocks.filter(b=>!b.removed).every(b=> b.gridPos[0]>=0 && b.gridPos[0]<state.cols && b.gridPos[1]>=0 && b.gridPos[1]<state.rows));
      assert.equal(state.exitCount,state.blocks.filter(b=>b.removed).length);
      assert.equal(gameRules.serializeState(state),gameRules.serializeState(structuredClone(state)));
    }
  }),{seed:42,numRuns:150});
  assert.ok(comparisons>=10000,`${comparisons} comparisons`);
});

// Independent reference search for tiny simple-block boards. No shared transition code.
test('BFS optimality agrees with independent depth enumeration on tiny boards',()=>{
  function independent(level:LevelData):number|undefined {
    const initial=level.blocks.map(b=>[...b.position]);
    const walk=(positions:(number[]|null)[],remaining:number,path:Set<string>):boolean=>{
      if(positions.every(p=>p===null))return true;if(!remaining)return false;
      const key=JSON.stringify(positions);if(path.has(key))return false;
      const visited=new Set([...path,key]);
      for(let index=0;index<positions.length;index++){
        const pos=positions[index];if(!pos)continue;
        for(const [dx,dy,side]of [[0,-1,'TOP'],[0,1,'BOTTOM'],[-1,0,'LEFT'],[1,0,'RIGHT']] as const){
          let [x,y]=pos,removed=false;
          while(true){const nx=x+dx,ny=y+dy;
            if(nx<0||ny<0||nx>=level.cols||ny>=level.rows){removed=level.exits.some(e=>e.side===side&&e.index===(dx?y:x));break;}
            if(positions.some((p,i)=>i!==index&&p&&p[0]===nx&&p[1]===ny))break;
            x=nx;y=ny;
          }
          if(!removed&&x===pos[0]&&y===pos[1])continue;
          const next=positions.map(p=>p?[...p]:null);next[index]=removed?null:[x,y];
          if(walk(next,remaining-1,visited))return true;
        }
      }
      return false;
    };
    for(let depth=0;depth<=5;depth++)if(walk(initial,depth,new Set()))return depth;
  }
  for(const positions of [[[0,0],[1,1]],[[1,0],[0,1]],[[0,0],[1,0]]] as [number,number][][]){
    const level:LevelData={id:1,cols:2,rows:2,parMoves:1,exits:[{side:'RIGHT',index:1}],blocks:positions.map((p,i)=>({id:`b${i}`,color:'red',position:p,size:[1,1]}))};
    assert.equal(solve(level).optimalMoves,independent(level));
  }
});
