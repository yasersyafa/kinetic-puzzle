# Implementation status

## Current staged release: Connections

The default snapshot now contains 40 levels: Stage 1 is unchanged and Stage 2 adds L21–40. Campaign `kinetic-stages`, content `1a7993503381`, audit `445ff8f460ac`, is selected by `generated/runs/stage-one/latest.json`. The old 20-level snapshot remains available for rollback. Per-level completion hashes preserve existing Stage 1 progress; Connections opens after completing all 20 first-stage levels.

Connections teaches the optimum +2 move budget at L21, dependencies at L22, and exit-count locks at L31. L27/L28 teach a two-link dependency chain. L30/L39 are verified relief levels, and L40 has the highest estimated Stage 2 difficulty. Every level has a shortest-path proof, successful replay and verified mechanic evidence. The batch rejects layout duplicates including rotations/reflections, layout similarity above 0.9, and recorded solution similarity above 0.88 against the preceding two levels. These are design and heuristic checks, not human difficulty measurements.

Manual palette selection, unlocks, scene and saved selection are removed. Stage palettes cycle Classic/Ocean/Sunset, beginning with Classic on Stage 1 and Ocean on Stage 2. Level select uses the selected stage; replaying earlier levels restores their palette. Mechanic block colors stay fixed. Legacy palette preferences are ignored without discarding completion or audio preferences. New Blue/Purple dialogue lessons spotlight the locked block and guide a valid prefix through its first move. The Blue lesson additionally requires tapping the dependent block, explains the parent circle, and waits for NEXT before guiding the release. Only L22 uses the newer dialogue version so players who saw the old Blue lesson receive the tap instruction.

Validation: 74 full-suite unit tests, four focused Stage 2 checks, typecheck, and the default production build pass. All 27 targeted renderer-enabled browser checks pass: all 20 Stage 2 live solution replays, Stage 1 L1/L3/L20 regressions, stage palette/navigation/removal checks, old-save import and stage gating, and both new guided tutorials. The production build independently re-verifies the 40-level snapshot before bundling. Stage 2 still needs human playtesting for puzzle feel and perceived pacing.

## Stage 1 baseline (historical)

Stage 1 contains 20 independently verified levels, using one exit, red simple blocks, yellow direction-constrained blocks and obstacles. Moves are unlimited. The game now reports SUCCESS/FAILED, removes Undo, provides current-state hints, and teaches through interactive dialogue with an animated red square character. Restart resets the full puzzle; demonstration playback cannot award completion.

Campaign `kinetic-stages`, content `3bacc398317c`, audit `192dac966e1b`, is the default build/playtest snapshot. Each solution has BFS optimum proof, replay, mandatory contract evidence and final artifact verification. Optimal moves: 2/7/9/9/10/9/12/12/10/15/13/14/14/13/18/15/14/10/15/17. Levels 6–20 prove required movable stoppers. Levels 17, 19 and 20 prove premature-exit traps across reachable winning states; this scope differs from earlier canonical-path-only trap counts. Layout-and-structure diversity compares geometry as well as structural features; legacy evaluator results remain compatible.

The stage builder uses seeded proposals and mutations of the previously player-tested shared-exit layout. Bounded heuristic search only proposes solution paths; BFS and mandatory evaluators remain approval authorities. Budgets, checkpoints, candidate provenance and immutable approved snapshots support bounded regeneration and exact artifact reuse.

The campaign foundation supports up to 1,000 levels in complete 20-level batches. Stage 2 is configured for dependent and lock blocks with optimal+2 moves, Stage 3 optimal+1, and Stage 4 onward optimal. These future stages have no published content yet. Completion records bind to individual content versions so appending a batch preserves unchanged progress; stages unlock sequentially and unpublished content remains unavailable.

Current validation: all 71 unit/property/solver/generation/evaluation/integration tests and all 29 renderer-enabled browser tests pass. Browser coverage includes all 20 live Phaser replays, Restart, consent/export/revocation, tutorial interaction/replay, SUCCESS persistence, move-limit boundaries, nonmutating hints, demonstration progression protection and matching legacy-save migration. TypeScript checks pass, and the production build independently verifies the 20-level snapshot before compiling.

Run `bun run playtest` (or `npm run playtest`). The new 20-level batch still needs human playtesting; approval of the previous six levels does not establish the experience of these twenty. Historical validation below describes earlier snapshots and behavior, including the former stars/Undo systems.


## Rendering optimization follow-up

The dotted background is now one cached 2× density tile; exit geometry is cached by orientation and cell size. Scene-local bounded pooling reuses ambient exit particles, dust, bursts, confetti, rings and dead-end overlays, with 32 prewarmed rectangles and a 192-object cap. Shutdown cancels effects and disposes the scene pool; textures survive level changes. Redundant periodic Hint-label updates were removed. Text resolution and procedural block visuals are unchanged.

TypeScript checks and production build pass. All 30 renderer-enabled browser tests pass, including stable ambient particle identities, cached exit texture reuse, pool cleanup on Restart, all 20 puzzle replays and tutorial/progression integration. FPS improvement on the player's Intel MacBook has not been measured.

## Shared block body textures

Red, yellow, blue and purple block bodies and hatched gray obstacles now use shared 2× density canvas-baked textures. Body geometry, shadow padding and center alignment are preserved; each block retains its own Image and original Container, icons, countdown, input, hover, squash and movement. Cache keys include dimensions, fill, obstacle pattern and border/shadow style. Shared textures survive individual block removal and level changes.

All 22 targeted renderer-enabled checks pass (20 live Stage 1 replays plus cache/pooling checks). Pixel tests verify body fills/borders for all five types, density, alignment, size separation, independent offsets, dependency/lock unlocks and texture survival. Five HEADLESS checks pass, including advanced existing L73/L74/L80 replays. Texture GPU refresh is guarded when no renderer exists, fixing HEADLESS startup for background, exit and block caches. The default generated production build passed final campaign verification and compilation; the emitted bundle includes these guards. TypeScript checks pass. No measured player-device FPS improvement is claimed.

## Delivered

- Shared Phaser-independent rules, deterministic transitions/state serialization, schema validation, BFS optimum proof, replay and bounded workers. Gameplay and movement-only Undo behavior are preserved.
- Seeded constraint proposals, constructive mechanic templates, reverse design, targeted mutation and validated crossover. Candidate pools, beam campaign selection, prerequisites, relief pacing, final re-evaluation, integrity-bound checkpoints, cumulative budgets and resume.
- Versioned design contracts distinguish gameplay inventory from formal interaction evidence. Universal avoiding-path search, constraint counterfactuals, dependency chains, forced positioning, structural multi-step requirements and reachable traps have explicit definitions and positive/negative fixtures. `UNKNOWN` never passes a mandatory gate.
- Difficulty features include distinct successor branching, dependency depth, repositioning, solution complexity, graph coverage/dead-end risk and curriculum novelty. Incomplete dead-end analysis is reported as unknown. Layout transformations, structural features and recorded solution patterns support diversity evaluation.
- Atomic versioned export binds reports, contexts, contracts, predictions and provenance. Runtime content and audit versions are separate so audit-only changes preserve progress. Generated builds reverify all mandatory gates; the existing campaign remains default.
- Generic configurable AI endpoint with versioned task prompts, validated output, retry/byte/time/request/token/cost budgets, response caching and protected product constraints. Director, Architect, Critic and bounded revision workflows are implemented. Research supports configured retrieval or a curated source corpus with fetched provenance; citations alone are not scientific validation.
- Local opt-in playtest consent/export/revocation UI, persistent bounded records, stable tester/session IDs, versioned human/autoplay separation and active-time tracking. Calibration reports, first-observed tester completion intervals, tester-disjoint ridge fitting and explicit model proposals are implemented. No online ingestion is required.
- CLI, developer documentation, CI, frozen regression fixtures and browser replay tests.

## Validation evidence

- 36 unit/property/solver/worker/AI-fixture/evaluation/integration tests passed. Seven additional frozen baseline tests passed across all six mechanics and the combined mastery finale.
- Differential fixtures exercise more than 10,000 state/action comparisons against the frozen movement implementation. Tiny-board independent enumeration checks BFS optimality.
- TypeScript checks and the default production build passed.
- All 14 default-campaign browser tests passed, including live Phaser/rules comparison, movement-only Undo/restart and local consent/export/revocation.
- All 80 existing stored solutions replay. The initial audit proved optimum for 77 levels; larger-budget follow-up proved L32 = 13, L35 = 14 and L79 = 32. Existing content is unchanged.
- Eight existing par mismatches: L12 10→9, L22 10→9, L25 11→10, L28 15→14, L32 14→13, L44 15→14, L47 17→16 and L65 20→19.
- HTTP fixtures validate the generic agent protocol, retries, provenance and protected gates. Synthetic telemetry fixtures validate analytics and fitting safeguards.
- V2 run `campaign-v2-acceptance` evaluated 109 candidates and exported 80 levels as content version `18dfa1f7311e`, audit version `be4b538a6cf3`. All 80 reports are ELIGIBLE and all 151 required evidence claims are VERIFIED. Campaign validation has no errors and 10 soft structural-similarity findings.
- The generated production build passed mandatory artifact re-verification. The separate tracked 80-level regression baseline passed schema, contracts, frozen optimum, replay and all required evidence checks.
- All 80 generated solutions passed live Phaser transition comparisons in HEADLESS mode, and the local consent/export/revocation test passed (81 browser passes; two default-only Undo fixtures skipped here and covered by the 14-test default suite). This checks runtime transitions, not visual rendering of all generated layouts.
- The earlier `18dfa1f7311e` campaign is a verification/acceptance artifact. Its heuristic predictions were 22 TUTORIAL, 37 EASY and 21 MEDIUM, with no HARD/EXPERT levels. Those preferred targets are unmet and explicitly reported; difficulty labels must not be relabeled to hide this gap.

Latest generated campaign acceptance results are recorded in `generated/runs/campaign-controlled-diverse/`; the HTML report is `generated/reports/campaign-controlled-diverse/report.html`. The earlier foundation report remains in `generated/reports/campaign-v2/report.html`. Earlier v1 exports are historical artifacts and do not establish v2 approval. Export requires completion of the full final verification; partial runs cannot be published.

## Controlled difficulty and diversity follow-up

- Generator 2.2.2 adds variable-length alignment chains, switchbacks and return routes, with relief variants and targeted score/diversity regeneration. The heuristic model remains `heuristic-2.0.0`; its weights and category boundaries were not changed.
- `--require-advanced-targets` intersects existing mandatory bands with HARD/EXPERT score ranges for non-relief levels. `--max-similarity` adds a mandatory structural limit without relaxing an existing stricter limit. Both policies are included in Director input and frozen contracts; AI still cannot bypass evaluation.
- Run `campaign-controlled-diverse` exported content version `fb3ad2e73a40`, audit version `58423c4060b6`. All 80 levels have a mandatory structural limit of 0.9; 36 non-relief advanced levels have mandatory score bands. All 151 mechanic claims are VERIFIED, campaign validation has zero errors/warnings, and maximum reported structural similarity is 0.875.
- Predicted categories: 21 TUTORIAL, 8 EASY, 13 MEDIUM, 15 HARD and 23 EXPERT. This closes the missing advanced-tier coverage under the existing model. Lower-tier categories and recorded solution-pattern similarity remain soft targets.
- All 53 automated tests passed. TypeScript checks passed. Two frozen campaigns (160 levels) passed optimum, replay, evidence and runtime-identity regression; the controlled snapshot also passed difficulty/similarity policy and pacing checks. Generated build and all 80 live Phaser HEADLESS replays passed, plus consent/export/revocation (81 browser passes; two default-only tests skipped).
- Renderer-enabled browser replays also passed for L41, L55 and L80, covering the advanced obstacle, lock and combined-mechanic layouts. All observed transitions matched the pure rules after animation; this is not human playtesting.
- A [local playtest protocol](PLAYTEST_PROTOCOL.md) documents how to test perceived challenge, clarity and repetitive forced movements. Neither a higher score nor a passing structural limit establishes player enjoyment.

## Acceptance boundaries

- No real AI endpoint/key is configured in this workspace; no live-model acceptance or real research-agent run is claimed. Configure `LEVEL_AI_ENDPOINT_URL` and `LEVEL_AI_API_KEY`, then evaluate the stored real-model decisions and revision cycle.
- No human playtest dataset has been collected. Difficulty scores and confidence remain heuristic; synthetic fixtures do not prove enjoyment or empirical calibration. Model fitting requires sufficient independent testers and remains an explicit proposal, never automatic promotion.
- Formal mechanic evidence covers `SWIPES_ONLY` winning paths, plus explicitly described relaxed-rule counterfactual witnesses. Undo and hints retain their existing gameplay behavior; there is no universal certification that an Undo-assisted strategy cannot bypass an intended insight.
- Multi-step evidence certifies defined action structure, not a player's cognitive planning. Counterfactual influence is distinct from universal mechanic necessity. Each report records its scope.
- Beam selection is bounded and can miss a feasible campaign. Resource exhaustion and incomplete proofs produce partial/HOLD results, not an infeasibility or correctness claim. Wall-clock outcomes can vary by hardware; approved artifacts provide exact reuse.
- Structural and recorded solution-pattern similarity are soft unless the contract makes them mandatory. One stored optimal path does not characterize all solutions. Player difficulty, frustration and novelty still require human testing.
- The current release is code and local validation readiness, not completion of empirical M6 or a guarantee of player experience. Online analytics and public release policies are outside the authorized local-playtest scope.

## Selected playtest entrypoint

`npm run playtest` opens the verified controlled campaign with a welcome panel and eight directly selectable sample levels. Recording requires explicit consent and starts on the next attempt. Selection, next-sample navigation, local export, revocation and disabled automatic fullscreen are covered by two passing browser tests with the renderer active. TypeScript checks pass. The entrypoint does not constitute human playtest evidence. See PLAYTEST_PROTOCOL.md for tester instructions.

## Product correction after player feedback

The earlier 80-level generated campaign is withdrawn from the playtest entrypoint: its advanced labels did not establish meaningful challenge, and multiple exits/random colors violated the intended game direction. Historical verification remains evidence of solvability within those earlier contracts, not approval under the revised product policy.

New pipeline contracts enforce one shared exit and semantic colors (simple red, constrained yellow, dependent blue, lock purple). Rendering preserves those colors across cosmetic palettes. Product-policy generation uses interacting actors on a shared board rather than the old isolated lanes/forced route templates. The 80-slot proposal now has two onboarding slots, earlier mechanic introductions and decision/stopper requirements; a new 80-level campaign has not yet been generated or accepted under this policy.

The small shared-exit playtest batch searches seeded candidates and verifies necessary movable stoppers, mechanic evidence, optimum and decision structure before export. Decision metrics are structural evidence, not a guarantee that a player will find the puzzle difficult. Three stars retain the proven-optimum threshold.

Shared-exit follow-up validation: 57 automated tests passed (including the revised 10-level export/resume integration); TypeScript and generated production build passed. Six renderer-enabled replays also verified fixed mechanic fills with the Ocean palette. Consent/export/revocation and sample navigation passed separately. The final small pack is content version `9e20156ca972`, audit version `7632ef0884d7`, with optimal moves 3/10/15/12/17/17. Its five post-onboarding levels all verify required movable stoppers; L2 has three premature-exit traps along the recorded optimum. The renderer run used the preceding snapshot `b0420ac2664b`; the final snapshot revises onboarding placement/text and preserves L2–L6 layouts. Final export and production build reverified every final solution and contract.

Product owner playtest feedback: one self-described experienced puzzle player tried the shared-exit batch and reported that its direction and challenge were acceptable. This is qualitative feedback from one player; no exported telemetry dataset or population-level difficulty calibration is claimed.
