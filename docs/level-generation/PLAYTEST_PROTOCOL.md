## Quick start: shared-exit playtest

Run `bun run playtest` (or `npm run playtest`). The command selects `generated/runs/shared-exit-playtest/latest.json`, opens `/?playtest=1`, and re-verifies the campaign before serving. The older 80-level multi-exit campaign is no longer the playtest default.

Choose a level in the welcome panel and press **Start selected level**. The short batch includes all its levels in the selector; **Next sample** wraps after the last. **Enable collection** is optional and starts recording on the next attempt. Rate a finished attempt and **Export JSONL** when done. **Revoke and delete** removes local records; use it between different testers after exporting.

To regenerate the batch, run `bun run levels:playtest:build`. It uses Node workers through tsx; invoke the package script rather than running the TypeScript file directly with Bun, whose worker resource limits are unsupported. Generation has attempt and wall-clock limits and never substitutes the previous multi-exit campaign if it fails.

All blocks share exactly one exit. Colors are fixed by mechanic, regardless of equipped cosmetic palette: red ordinary, yellow one direction, blue dependent, purple count lock. The first level is brief onboarding; later levels require temporary stoppers and carry verified choice metrics. Ask whether those choices actually require planning, rather than assuming optimal move count establishes difficulty.

# Local playtest protocol

The controlled campaign adds advanced score gates and new route families. A higher heuristic score is a design hypothesis, not evidence that players find a puzzle difficult or enjoyable. In particular, long forced routes and dependency chains can increase the score without creating an interesting decision.

## Prepare

Use the approved campaign's explicit build target, keeping the existing campaign and its progress separate. Start the dev server with `--env campaign=<approved-directory>/campaign.json`, open `/?playtest=1`, and explain the data fields and local storage before the participant enables collection. Collection begins on the next attempt. Export uses a local JSONL file; revocation deletes the local records. No upload is configured.

Choose a small set covering an alignment chain, both advanced route families, a relief level and the combined-mechanic finale. Keep the exact campaign/level/model versions and `predictions.json` with the dataset. Include earlier campaign examples as a comparison. Counterbalance the order across participants; do not tell participants the predicted category before they give their rating.

## Run

Let the participant play with normal Undo/restart behavior. Record completion, active completion time, moves, restart/Undo/hint counts and a difficulty rating. Ask separately which interaction was unclear, where planning was needed, whether repeated movements felt tedious, and whether the puzzle was enjoyable. Observation notes are qualitative evidence; they must not be presented as measured telemetry or causal findings.

Keep human and autoplay records separate. A tester ID is a device identifier, not proof of a distinct person: do not count repeated browsers/devices as independent participants. Preserve the same person's identity when curating multiple exports. Do not collect names or other identifying fields merely for this comparison.

## Analyse

Import the consented JSONL with the matching exported predictions using `levels:calibrate`. Inspect per-level completion, first-observed tester completion intervals, unassisted time and rating residuals. Examine each route family and relief transition. High hints, abandonment or long times can indicate confusion as well as intended challenge; do not infer the cause from a correlation alone.

The fitting code requires at least 20 tester identities, 100 distinct tester/level ratings and five levels. These are minimum safeguards, not a claim that the sample is sufficient for every conclusion. Fit proposals use a tester-disjoint holdout and compare error with the unchanged heuristic baseline. Preserve the original model and never promote a fitted proposal automatically.

If players rate nominal expert puzzles easy, revise the design/model rather than changing labels to disguise the mismatch. If a forced route is tedious, add a meaningful positioning decision and prove its necessity. Re-run schema, solver, replay, evidence, diversity, score and campaign gates for any revision. Record the resulting version as a new artifact; keep the earlier artifact for comparison and rollback.
