# Marketing Copy

## Title

Kinetic Puzzle

## Short description (≤150 chars)

Slide blocks across the grid and escape through portals. Order matters — one wrong move dead-ends the level. Pure logic, no timer.

## Long description (≤1000 chars)

Kinetic Puzzle is a momentum-driven sliding block brain teaser. Blocks slide with momentum until they hit a wall, an obstacle, or another block. Drag them out through edge portals — but only if the order, direction, and dependencies line up.

Five block types to master:

- Red simple — slides any direction, exits through any portal.
- Yellow constrained — only moves and exits along its arrow direction.
- Blue dependent — locked until its prerequisite block leaves the board.
- Lock blocks — require a specific number of removals before they unlock.
- Gray obstacle — fixed walls that block momentum.

Plus ice tiles that override blocker physics — slide right through.

Features:

- 80 hand-crafted levels across 6 packs: Tutorial, Hook, Gears, Stones, Master, Fixture
- Per-pack unlock progression with 3-star ratings
- Three unlockable color palettes (Classic, Sunset, Ocean) with full UI theming
- Slide momentum mechanics — every push counts
- Neo-brutalism art style with chunky tiles and tactile feedback
- No timers, no ads mid-puzzle
- Auto-save progress, undo, and watch-solution support
- Plays great on mobile, tablet, and desktop

Perfect for puzzle fans who like to think before they move.

## How to Play

### Goal

Remove every red, yellow, blue, and lock block from the board through the orange edge portals. Gray obstacle blocks stay where they are.

### Block types

- **Red (Simple)** — slides any cardinal direction, exits through any aligned portal.
- **Yellow (Constrained)** — chevron arrow shows the only direction it can slide and exit.
- **Blue (Dependent)** — chained icon. Locked (dim) until its prerequisite block exits the board, then lights up and becomes movable.
- **Lock** — counter icon. Locked until the required number of other blocks have been removed.
- **Gray (Obstacle)** — immovable wall.

### Ice tiles

Some cells are icy. Blocks passing over ice keep sliding through as if the tile weren't there — useful for chaining long slides.

### Movement rule

Blocks slide with momentum: they keep going in the swiped direction until they hit a wall, an obstacle, or another block. To exit, line a block up with a portal and slide toward it.

### Desktop controls

- **Mouse swipe** — click and drag a block in a cardinal direction (up / down / left / right), then release. The block slides until it hits something.
- **Drag-to-exit** — drag a block past the board edge through an aligned portal to remove it.
- **Undo / Restart / Pause / I'M STUCK** — HUD buttons.
- **Esc** — pause.

### Mobile / touch controls

- **Swipe** — touch a block, swipe in a cardinal direction, release. Same momentum rule applies.
- **Drag-to-exit** — hold a block and drag it past the edge through a portal to remove.
- **Tap** — HUD buttons all tap-friendly.

### Stuck?

The **I'M STUCK** button shows a rewarded ad, then auto-plays the level's solution so you can learn the trick and move on.

### Tips

- Plan the exit order. Removing a blue block's prerequisite first unlocks it.
- Lock blocks open after enough removals — count what's needed before committing.
- Yellow blocks ignore swipes against their arrow — read the chevron.
- Use ice tiles to slip past blockers that would normally stop a slide.
- Watch for dead-ends: if no block can reach a portal, you're stuck. Undo, restart, or watch the solution.

## Tags

puzzle, logic, casual, sliding, block, brain, sokoban, unpuzzle, kinetic, momentum, html5, mobile

## Categories

- Puzzle (primary)
- Casual

## Submitted Platforms (May 2026)

- [x] Poki — `submission/poki-build-v0.4.1.zip`
- [x] CrazyGames — `submission/crazygames-build-v0.4.1.zip`
- [x] GameDistribution — `submission/gamedistribution-build-v0.4.1.zip`
- [x] Itch.io — `submission/itch-build-v0.4.1.zip`
- [x] Playgama (Bridge SDK, distributes to ~28 partner networks on approval) — `submission/playgama-build-v0.4.1.zip`

## Asset checklist

- [x] Logo SVG + PNG — `marketing/logo/kinetic-puzzle.svg`, `marketing/logo/kinetic-puzzle.png`
- [x] Multi-size logo JPGs — 200x120, 512x384, 512x512, 800x800, 800x1200, 1080x1920, 1280x550, 1280x720, 1920x1080 (covers most portal thumbnail requirements)
- [x] Poki thumbnail — `marketing/thumbnail-poki.png` (960x540)
- [x] CrazyGames thumbnail — `marketing/thumbnail-cg.png` (1280x720)
- [x] Source thumbnail SVG — `marketing/thumbnail.svg`
- [x] Screenshots (1280x720) — `marketing/screenshots/`
  - `ss-menu.png` — main menu
  - `ss-level.png` — level select grid
  - `ss-gameplay.png` — mid-puzzle
  - `ss-tutorial.png` — interactive tutorial overlay
  - `ss-win.png` — level complete

## Capture workflow (re-shoot if UI changes)

1. `npm run dev`
2. Open http://localhost:3000 in Chrome
3. Resize devtools viewport to 1280x720
4. DevTools → Cmd+Shift+P → "Capture screenshot"
5. Save into `marketing/screenshots/`
