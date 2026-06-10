# ⚡ Infrastructure Simulator

An interactive, browser-based tool for learning distributed systems design through packet animation.

## Getting Started

```bash
npm install
npm run dev        # starts dev server at http://localhost:5173
```

## Building for Distribution

```bash
npm run build      # produces a single self-contained dist/index.html
```

The `vite-plugin-singlefile` plugin inlines all CSS and JS so the build output is a single portable HTML file.

## Architecture

The project uses Vite + ES modules. All source lives in `src/`:

```
src/
├── main.js                    # entry — imports everything, exposes window globals, bootstraps
├── state/
│   ├── store.js               # mutable S object — single source of truth
│   ├── history.js             # undo / redo
│   └── serializer.js          # localStorage persistence
├── components/
│   ├── types.js               # TYPES definitions + PALETTE_GROUPS
│   ├── palette.js             # drag-to-place palette
│   ├── inspector.js           # right-panel inspector + config forms
│   └── canvas/
│       ├── renderer.js        # renderComps(), renderConns()
│       ├── interaction.js     # drag, click, connect, delete, placeComp
│       └── camera.js          # worldPt, updateCamera, fitToScreen, bezier, connPath
├── simulation/
│   ├── engine.js              # startSim, stopSim, spawnCycle, animLoop
│   ├── packets.js             # spawnPkt, spawnResponsePkt, validateConnection
│   ├── behaviors.js           # recordArrival, recordCompletion, updateQueueHealth, showLatencyFlash
│   └── metrics.js             # computeMetrics, renderMetricsPanel
├── levels/
│   ├── registry.js            # LEVELS map
│   ├── goals.js               # checkGoals, showWin, dismissWin
│   └── data/
│       ├── level_01.js        # Level 1: Hello Infrastructure
│       └── level_02.js        # Level 2: The Bottleneck
└── ui/
    ├── views.js               # render() — the single full-redraw entry point
    ├── mode.js                # applyMode() — low-level, no stopSim side-effect
    ├── header.js              # setMode, clearAll, loadLevel, camera controls
    ├── notifications.js       # hint()
    ├── level-hud.js           # renderLevelHUD()
    └── metrics-panel.js       # 500ms polling loop
```

### Key Design Decisions

- **No circular imports** — `engine.js` calls `applyMode()` (not `setMode()`) to avoid importing `header.js`; `renderer.js` dispatches interaction events through `window._on*` callbacks set by `main.js`.
- **Single source of truth** — all state lives in `S` (store.js), mutated in place.
- **`render()` is the only full-redraw** — imported from `ui/views.js` by anything that needs it.
- **`vite-plugin-singlefile`** — dev uses native ES module HMR; `npm run build` produces a single portable `.html`.

## Historical Reference

The v0.2 monolithic prototype (before this refactor) lives in `historical_implementation/`.
