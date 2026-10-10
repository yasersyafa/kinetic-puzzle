# Stage campaign tooling

The active campaign grows in verified batches of 20 toward 500–1000 levels. Stage 1 contains only red ordinary blocks, yellow one-direction blocks and gray static obstacles, with one shared exit and unlimited moves. Stage 2 introduces blue dependent blocks followed by purple exit-count locks; its move limit is the proven optimum +2. Stage 3 uses +1; Stage 4 onward uses the optimum. Only Stage 1 content is currently published; future stage definitions are not playable placeholders.

`bun run playtest` (or `npm run playtest`) opens the approved Stage 1 snapshot selected by `generated/runs/stage-one/latest.json`. Normal `dev` and `build` select that same snapshot. Each generated build independently verifies its proofs and artifact integrity before bundling. Use `--env legacy` to load the original campaign, or `--env campaign=<approved/campaign.json>` for another verified snapshot.

```sh
bun run levels:stage:build
bun run playtest
npm run typecheck
npm test
npm run build
```

`levels:stage:build` / `levels:playtest:build` run through tsx/Node, including memory-bounded final verification workers. Do not invoke the TypeScript file directly with Bun. `--help` documents seed, attempt, candidate and time budgets. Repeat the same command to resume checkpointed work. Every stored candidate is regenerated from its seed/attempt and reevaluated before reuse. A partial run never replaces `latest.json`; exports are immutable and atomic. `previous.json` retains the preceding selection after a later successful export, allowing rollback of the pointer.

The stage metadata is part of the runtime content hash (campaign schema 2.1). Publishing a stage requires all 20 positions, compatible mechanics, one exit, proven optimum, replay, design evidence, diversity and campaign pacing checks. The earlier six-level shared-exit pack remains a reference; `levels:reference:build` rebuilds it. Historical 80-slot tooling below is retained for regression and research, not the new campaign's progression plan.

Runtime results are SUCCESS or FAILED. Undo is removed; Restart resets the board and moves. Invalid swipes do not consume moves, and a win on the last allowed move succeeds. Hint searches the current state with the shared rules and displays a suggested action without moving blocks. Autoplay demonstrations never award completion. Palette customization changes interface colors only.

Progress uses a stable campaign storage key and per-level content versions. Appending levels preserves matching completions; changed levels must be cleared again. Legacy stars migrate only for matching content identity. Cloud merges use the same compatibility checks. Stage access requires completing the previous stage. Tutorial history is keyed by level content and dialogue version. The red speaking square guides actions in a side panel; Skip ends guidance, and Tutorial restarts the level to replay it.

# Autonomous level tooling

Offline Node.js/TypeScript tooling shares deterministic transition rules with the Phaser runtime. Runtime gameplay never calls AI. The original campaign remains available through the legacy build target; campaign identities keep their progress separate.

## Commands

```sh
npm ci
npm run typecheck
npm test
npm run levels:regression
npx playwright install chromium
npm run test:browser
npm run levels:build -- --count 10 --seed 42 --output generated/runs/preview
npm run levels:build -- --count 80 --seed 42 --output generated/runs/campaign
npm run levels:report -- --run generated/runs/campaign
```

`generate` produces evaluated candidate pools and checkpoints; `build` additionally exports verified campaign artifacts. `--count` is the number of curriculum slots (1–80); candidate attempts are controlled separately. All commands support `--help`; exit codes are 0 success, 1 failed/unresolved, 2 configuration/internal error.

```sh
npm run levels:build -- --count 80 --seed 42 --pool-size 5 --beam-width 32 \
  --max-states 10000 --timeout-ms 30000 --attempts-per-slot 300 \
  --candidate-budget 24000 --max-run-ms 1800000 \
  --output generated/runs/campaign
# Resume with the same options and --resume.
```

Budgets are cumulative across resume, including final verification/export. Interrupts cancel active evaluation workers. Checkpoint schema, configuration/version identity and integrity are checked before resume. A wall-clock timeout preserves the pending candidate/attempt and returns HOLD/PARTIAL; it does not silently select a different campaign. State/transition/depth limits give reproducible logical search cutoffs. No unresolved proof is published.

`--reuse <checkpoint.json>` reuses prior candidates as proposals identified by contract ID; it never carries over approval. Current contracts, rules, budgets and contexts are verified again. Original candidate data and provenance are recorded in the exported generation metadata. Custom contracts use `--contracts <contracts.json>`. Contract IDs must be unique ASCII identifiers of 1–80 characters.

Generator 2.2.2 adds alignment chains for medium progression, switchbacks and return routes for advanced levels, and lighter variants for relief. These proposals increase dependency depth and required repositioning with bounded reachable graphs. Their geometry and solution patterns differ; every proposal still passes the same evidence and diversity checks. A difficulty-gate failure can trigger a new constructive proposal, with its mutation history recorded.

To require advanced tiers rather than treating their target category as a preference:

```sh
npm run levels:build -- --count 80 --seed 42 --pool-size 2 --beam-width 32 \
  --require-advanced-targets --max-similarity 0.9 --max-states 10000 --timeout-ms 30000 \
  --max-run-ms 3600000 --output generated/runs/controlled
```

`--require-advanced-targets` intersects existing mandatory score bands with the configured model's HARD/EXPERT ranges for non-RELIEF slots. It never changes model weights or thresholds, weakens an existing constraint, or approves an out-of-range candidate. Relief intentionally remains below the surrounding level. Incompatible bands fail before generation. This policy also appears in Director inputs, frozen contracts, checkpoints and exported run metadata. Model categories remain predictions until human calibration.

`--max-similarity 0.9` makes the structural threshold mandatory for every slot, intersecting any stricter existing contract limit. It applies to the existing catalog and the selected campaign, with final re-evaluation after ranking. Exact geometric duplicates are always rejected. Structural similarity is an estimate based on reported features; the separate recorded-solution-pattern score remains advisory. Medium alignment proposals vary chain length to provide more than cosmetic position variations. Tight thresholds can exhaust the configured generation budget and produce a partial run; they are never relaxed automatically.

## Rules and proof boundaries

Rules v1 preserve existing movement, exit, ice landing/push, single-direction constraints, dependency unlock and exit-count locks. Blocks are 1x1; obstacles are permanent; ice may overlap a block. Dependency cycles, invalid references/overlap and unsupported restricted exits are rejected. Undo is unavailable. All solver and evidence searches cover swipes; Hint does not alter state.

BFS proves shortest solutions; paths are replayed against the shared rules. TIMEOUT and RESOURCE_LIMIT are distinct from UNSOLVABLE. Candidate, evidence and final verification run in workers with a 256 MB heap limit and watchdog. Audit CLI supports individual levels:

```sh
npm run levels:evaluate -- --level 32 --timeout-ms 30000 --max-states 1000000
npm run levels:replay -- --level 73
```

Audit reports include hardware/runtime and budget information. CI permits unresolved existing audits but blocks UNSOLVABLE, ERROR and failed stored replays.

`levels:regression` checks two tracked 80-level frozen campaign baselines: schema, contract schema, proven optimum, winning replay, every required evidence claim and runtime identity. The controlled baseline additionally checks mandatory score/similarity policies, spikes and relief pacing using its frozen model. These 160 levels are not regenerated during tests. Intentional rules changes require reviewing and updating it; seven representative mechanic fixtures also run in the regular unit suite.

## Contract v2 and mechanic evidence

`schemaVersion: "2.0.0"` contracts separate gameplay `requiredMechanics` from formal `requiredEvidence`. `primaryEvidenceId` links the design objective to a required proof. All mandatory predicates must pass; grid, move range, mechanic inventory and optional mandatory similarity/difficulty/dead-end limits are checked. Preferred difficulty and similarity remain soft targets, with explicit findings and ranking penalties. Legacy contracts can be audited; generation and export require v2 approval.

Each evidence spec contains a unique ID, claim, scope and optional actor `blockIds`, position or minimum step count:

| Scope | Claims and exact meaning |
|---|---|
| ALL_WINNING_PATHS | `sliding-required`: positive displacement; `ice-push`: successful ice push; `block-as-stopper`: non-ice interaction with a movable stopper; `obstacle-interaction`: stopping at or ice-jumping an obstacle |
| ALL_WINNING_PATHS | `forced-positioning`: reaches a specified noninitial position; `dependency-chain`: exits specified chain in order; `multi-step-planning`: at least the specified number of nonexit actions on selected actors |
| COUNTERFACTUAL_EFFECT | `direction-interaction`, `dependency-planning`, `lock-planning`: relaxing selected constraints changes proven optimal cost or enables a winning path forbidden by the original constraint |
| EXISTS_REACHABLE_TRAP | `false-opportunity`, `dead-end-avoidance`: complete reachable graph proves a reachable choice between winning and losing successors |

Proof reports explicitly identify the SWIPES_ONLY action domain. Universal claims search for a winning counterexample in the shared rules swipe graph. Runtime Undo is unavailable; hints suggest actions without altering state. History-sensitive claims retain monitor progress in state keys. Counterfactual witnesses are replayed using relaxed rules; they are not claimed as original-game solutions. Incomplete searches remain UNKNOWN. Structural planning/trap proofs do not prove a player's cognitive process or perceived fairness. Learning text expresses intent; human learning/enjoyment still requires playtesting.

Every default slot requires primary evidence. TEACH adds a mechanic only after its prerequisites were taught earlier with evidence. The final contract includes all mechanics and verifies displacement, ice, direction, dependency, lock and obstacle interactions.

## Difficulty, diversity and selection

Difficulty model weights/thresholds are configurable and versioned. Metrics include optimal moves, distinct successor branching, dependency depth, repositioning, mechanic count, solution interaction complexity and learned-insight novelty. Dead-end risk uses reverse winning reachability on a complete graph; partial coverage is explicit and produces a null risk rather than a fabricated zero estimate. A mandatory dead-end threshold cannot pass incomplete coverage.

Exact geometric duplicate detection preserves exits, directions, dependencies, locks and ice while ignoring cosmetic identities/colors. Near similarity includes structural features and normalized recorded solution patterns. One-path similarity is not a proof of equivalence between complete solution spaces.

The generator supports seeded proposals, feedback-targeted mutations, an elite pool, crossover proposals and reverse design from replayable slide-only solution prefixes. All proposals undergo full verification. Default candidate pool size is five; deterministic beam width is 32. The optimizer selects combinations across fixed curriculum slots, recomputes context-dependent novelty, penalizes repetition/similarity and retains alternatives needed for relief pacing. It does not claim globally optimal campaign quality. RELIEF must reduce estimated difficulty; upward spikes over 30 are blocked. Rejected final selections trigger bounded replacement/reverification. Budget exhaustion reports unresolved work, never unproven infeasibility.

## Export, integration and rollback

Export writes an immutable directory `generated-<content-version>-<audit-version>`. Runtime hash covers levels, solutions, roles, tutorials and rules version. Audit identity separately binds contracts, stable proofs, generation provenance and validation. Changes to audit alone preserve campaign content version and player progress. Each file has a manifest checksum; metadata/contexts cannot be silently replaced.

Artifacts include campaign, contracts, reports, contexts, predictions, generation metadata, manifest and campaign validation. `export-status.json` identifies the artifact path. Source reports remain unchanged during export. All writes stay within `generated/`, with atomic staging/rename and symlink/traversal checks.

```sh
npm run levels:validate -- --source campaign --input <artifact-path>/campaign.json
npm run build -- --env campaign=<artifact-path>/campaign.json
```

Webpack re-verifies all mandatory gates and embeds the exact verified snapshot. Reports alone cannot authorize a build. Legacy artifacts remain readable for auditing/replay but require reapproval before a new production build. Rollback selects a previous verified artifact. Generated hint replay stops on invalid actions; no AI is used in game runtime.

## Generic AI endpoint

Set `LEVEL_AI_ENDPOINT_URL` or `--director-url`; credentials use `LEVEL_AI_API_KEY`. No provider/model is selected implicitly. The client sends task, schema version 2.0.0, prompt version 2.1.0, task instructions, mechanic brief, input, parameters and remaining token/cost budget. Responses contain `modelId`, `output` and usage `{inputTokens,outputTokens,estimatedCost}`.

Tasks: Director returns strategy/contracts; Architect returns contract-linked valid level proposals; Critic copies facts from the request’s verifiedFacts allowlist and returns predictions and `hasPlaytested:false`; Research returns principles with retrieved-source provenance and supporting excerpts. Source excerpts establish provenance, not independent scientific verification.

```sh
npm run levels:build -- --count 80 --director-url https://your-agent-endpoint \
  --knowledge knowledge.json --ai-max-requests 30 --ai-max-tokens 100000 \
  --ai-max-cost 5 --output generated/runs/ai-campaign
npm run levels:research -- --director-url https://your-agent-endpoint --input sources.json
```

Research input: `{ "sources": ["https://primary-reference"] }`. Discovery can use `LEVEL_RESEARCH_SEARCH_URL`, a configured JSON search endpoint returning `{urls:[...]}`; `LEVEL_RESEARCH_SOURCES` supplies a comma-separated curated corpus. Research source content is untrusted and never grants tool/code authority.

The operational loop sends failures to Critic/Director/Architect and revalidates revisions. Frozen contracts and gates cannot be overridden. Requests use bounded retries/backoff, response-size/deadline limits, cumulative usage accounting, content-addressed caches and saved raw responses. Missing usage prevents further bounded AI calls. API cost checks use provider-reported estimates; the endpoint must honor remaining budgets. Architect failure can fall back to procedural generation with valid Director contracts. Without valid contracts, Director failure stops with a report. Resume reuses the saved plan/cache rather than calling the model again. Successful model/prompt/request provenance is attached to AI candidates and exported metadata. Secrets are not written to artifacts.

The adapter/workflow is tested with local HTTP fixtures. Live model acceptance requires a configured endpoint; tests do not impersonate real model or player results.

## Local playtest and calibration

Open the game with `?playtest=1`. The panel offers explicit opt-in, deletion/revocation, optional difficulty rating and JSONL export. Recording starts with the next level attempt. Collection is OFF until enabled; nothing in this collector is uploaded. Data stays in browser local storage until deletion/revocation, eviction at 1,000 attempts or browser cleanup. Tester IDs are random and local; export is a tester action. Production online ingestion is outside this selected local-playtest scope.

Attempts record campaign/level version, tester/session/attempt IDs, completion/abandonment, active time, moves, undo/restart/hints/dead ends and HUMAN/AUTOPLAY. Pause, background and playtest-panel time are excluded. Runtime and offline predictions share the same level-version function.

```sh
npm run levels:calibrate -- --input attempts.jsonl \
  --source <artifact-path>/predictions.json --output generated/calibration/session
```

Reports isolate versions, exclude autoplay, distinguish unassisted completion time, show first-observed per-tester completion intervals and rating residuals. Repeated attempts are not counted as independent testers. Fitting requires at least 20 testers, 100 unique tester/level ratings and five distinct levels. Ridge regression uses a fixed penalty and tester-disjoint held-out evaluation; repeated ratings for a tester/level are aggregated. Insufficient data produces INSUFFICIENT_DATA. A fitted model proposal is not automatically promoted.

An explicitly selected model can be supplied with `--model <model-proposal.json>`. Calibration feedback can be supplied to Director with `--calibration <calibration.json>`. Human observations, correlation and causal explanations are kept distinct. No real player calibration is claimed without a human dataset.

## Runtime validation

```sh
LEVEL_TEST_CAMPAIGN=<artifact-path>/campaign.json LEVEL_TEST_HEADLESS=1 npm run test:browser
```

This replays every generated solution through actual Phaser movement and compares after-animation state. Without the headless flag, tests use the renderer. Test bridges are opt-in and absent from normal builds. Human reports show predicted and preferred difficulty curves, evidence coverage, soft findings and unresolved metrics. See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for current validation evidence.

## Rendering performance

The dotted background uses one cached 80×80 canvas tile drawn at 2× density and repeated at the original 40px spacing. Exit shapes are cached images by orientation/cell size; their pulse remains a single image tween. Text resolution is unchanged. Block bodies now use shared cached textures as described below.

Ambient exit particles, swipe dust, bursts, confetti, removal rings, portal effects and the dead-end overlay use a scene-local pool. It prewarms 32 rectangles, grows on demand to a shared cap of 192 effects, hides released objects and resets their visual properties before reuse. Cosmetic emissions are skipped if the pool is full. Scene shutdown cancels animations and destroys that scene's pool; cached textures remain available across levels. This avoids recurring particle create/destroy churn during play, while bounding retained objects.

Hint labels update only when their status changes. Renderer-enabled browser checks exercise texture reuse, stable particle identities across ambient cycles, pool disposal on restart and puzzle replay. These checks do not establish a measured FPS improvement on a player's laptop.

Block bodies (red, yellow, blue, purple and gray obstacles) are generated once into tightly bounded 2× density textures keyed by dimensions, fill, obstacle pattern and border/shadow style. Textures are baked with a canvas context so creation also works in HEADLESS verification without a GPU renderer. Each block owns an Image inside its original Container; equal appearances share the same texture across blocks and levels. Padding preserves the shadow and the image origin preserves the original body center. Static icons and dynamic lock countdowns remain separate. Hover, squash, visual offsets, unlock transparency, input and movement still act on each block independently. Destroying a block leaves its shared texture available.
