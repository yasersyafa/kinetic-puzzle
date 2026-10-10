# Stage 1 playtest

Run `bun run playtest` or `npm run playtest`. It selects `generated/runs/stage-one/latest.json`, verifies all 20 levels, and opens `/?playtest=1`. To rebuild, run `bun run levels:stage:build`; repeat the same command to resume a partial run.

Test levels 1–20 in order first. They introduce sliding, obstacles, then yellow one-direction blocks before deepening stopper and exit-order decisions. There are no dependent/locked/ice mechanics or move limits in this stage. Every puzzle has one shared exit. All blocks must exit to succeed; Undo is unavailable. Use Restart to try a different order. Hint only suggests an action.

The red square character guides the tutorial. NEXT advances dialogue, highlighted swipes advance action steps, and SKIP leaves free play. TUTORIAL restarts the current level and replays its dialogue. Check that instructions and character never cover a block or control.

The welcome panel lists all 20 levels for direct debugging; Next sample wraps. Collection is optional and starts with the next attempt. Rate a finished attempt, then Export JSONL. Records remain local; Revoke and delete removes them. Keep the exact campaign, level versions, and predictions.json with exported data. The six-level reference remains available through its explicit campaign path.

Future-stage move caps have automated fixtures, but dependent/locked Stage 2 content needs its own generation and player test before release.

# Local playtest protocol

Verified contracts add structural interaction and diversity gates. A higher heuristic score is a design hypothesis, not evidence that players find a puzzle difficult or enjoyable. In particular, long forced routes and dependency chains can increase the score without creating an interesting decision.

## Prepare

Use the approved campaign's explicit build target, keeping the existing campaign and its progress separate. Start the dev server with `--env campaign=<approved-directory>/campaign.json`, open `/?playtest=1`, and explain the data fields and local storage before the participant enables collection. Collection begins on the next attempt. Export uses a local JSONL file; revocation deletes the local records. No upload is configured.

Compare onboarding, stopper practice, positioning twists, the level 18 relief, and levels 19–20 mastery. Keep the exact campaign/level/model versions and `predictions.json` with the dataset. Include earlier campaign examples as a comparison. Counterbalance the order across participants; do not tell participants the predicted category before they give their rating.

## Run

Let the participant play with Restart and optional Hint. Record completion, active completion time, moves, restart/hint counts and a difficulty rating. Ask separately which interaction was unclear, where planning was needed, whether repeated movements felt tedious, and whether the puzzle was enjoyable. Observation notes are qualitative evidence; they must not be presented as measured telemetry or causal findings.

Keep human and autoplay records separate. A tester ID is a device identifier, not proof of a distinct person: do not count repeated browsers/devices as independent participants. Preserve the same person's identity when curating multiple exports. Do not collect names or other identifying fields merely for this comparison.

## Analyse

Import the consented JSONL with the matching exported predictions using `levels:calibrate`. Inspect per-level completion, first-observed tester completion intervals, unassisted time and rating residuals. Examine each learning phase and the relief transition. High hints, abandonment or long times can indicate confusion as well as intended challenge; do not infer the cause from a correlation alone.

The fitting code requires at least 20 tester identities, 100 distinct tester/level ratings and five levels. These are minimum safeguards, not a claim that the sample is sufficient for every conclusion. Fit proposals use a tester-disjoint holdout and compare error with the unchanged heuristic baseline. Preserve the original model and never promote a fitted proposal automatically.

If players rate nominal expert puzzles easy, revise the design/model rather than changing labels to disguise the mismatch. If a forced route is tedious, add a meaningful positioning decision and prove its necessity. Re-run schema, solver, replay, evidence, diversity, score and campaign gates for any revision. Record the resulting version as a new artifact; keep the earlier artifact for comparison and rollback.
