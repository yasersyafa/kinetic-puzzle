import {test} from 'node:test';
import assert from 'node:assert/strict';
import { blockColor,BLOCK_FILLS } from '../../../src/config/BlockColors';
import { PRODUCT_POLICY,productErrors } from '../generation/ProductPolicy';
import { generateCandidate } from '../generation/CandidateGenerator';
import { defaultCurriculum } from '../director/DesignContract';
import { evaluate } from '../evaluation/Evaluators';
import { validateLevel } from '../../../src/core/puzzle/LevelValidator';
import { productCurriculum } from '../generation/ProductPolicy';
import { analyzeDecisions } from '../evaluation/DecisionAnalysis';
import type {LevelData} from '../../../src/types/Game';
test('mechanic colors and new generation preserve one shared exit',()=>{
  assert.deepEqual(['simple','constrained','dependent','lock'].map(t=>blockColor(t as 'simple')),['red','yellow','blue','purple']);
  assert.equal(BLOCK_FILLS[blockColor('lock')],0xc9a4d8);
  for(const contract of defaultCurriculum(80))for(let attempt=0;attempt<3;attempt++){
    const candidate=generateCandidate({...contract,productPolicy:PRODUCT_POLICY},1,42,attempt);
    assert.deepEqual(productErrors(candidate.level),[]);assert.deepEqual(validateLevel(candidate.level),[]);
  }
});
test('product gates reject multiple exits or wrong semantic colors before solver',()=>{
  const contract={...defaultCurriculum(1)[0],productPolicy:PRODUCT_POLICY};
  const level:LevelData={id:1,cols:3,rows:3,parMoves:1,blocks:[{id:'a',type:'simple',color:'red',position:[0,1],size:[1,1]}],exits:[{side:'RIGHT',index:1}]};
  assert.equal(evaluate({...level,exits:[...level.exits,{side:'LEFT',index:1}]},contract,[]).gates.product,'FAIL');
  assert.equal(evaluate({...level,blocks:[{...level.blocks[0],color:'blue'}]},contract,[]).gates.product,'FAIL');
});
test('forced exit lane is not a decision puzzle and incomplete analysis remains unknown',()=>{
  const level:LevelData={id:1,cols:3,rows:1,parMoves:1,blocks:[{id:'a',type:'constrained',direction:'RIGHT',color:'yellow',position:[0,0],size:[1,1]}],exits:[{side:'RIGHT',index:0}]};
  assert.equal(analyzeDecisions(level).decisionPoints,0);
  assert.equal(analyzeDecisions(level,{maxStates:1}).status,'UNKNOWN');
  const contract={...defaultCurriculum(1)[0],productPolicy:PRODUCT_POLICY,grid:{minCols:3,maxCols:3,minRows:1,maxRows:1},optimalMoves:{min:1,max:10},allowedMechanics:['sliding','constrained'] as const,mandatoryDecisionPoints:1};
  assert.equal(evaluate(level,{...contract,allowedMechanics:[...contract.allowedMechanics]},[]).gates.decisions,'FAIL');
});

test('product curriculum has brief onboarding and earlier prerequisites in the intended order',()=>{
  const curriculum=productCurriculum(80);
  assert.deepEqual(curriculum.filter(c=>c.progressionRole==='TEACH').map(c=>[c.contractId,c.introducedMechanic]),[['slot-001','sliding'],['slot-003','obstacle'],['slot-006','constrained'],['slot-011','dependent'],['slot-019','lock'],['slot-031','ice']]);
  assert.ok(curriculum.slice(2).every(c=>c.mandatoryDecisionPoints!>=2&&c.requiredEvidence!.some(e=>e.claim==='block-as-stopper')));
  assert.deepEqual([...curriculum[79].requiredMechanics].sort(),['constrained','dependent','ice','lock','obstacle','sliding']);
});
