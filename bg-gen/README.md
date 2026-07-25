# bg-gen

Tileable background generator: PixiJS + TypeScript, driven by a Wave Function
Collapse solver.

`src/wfc/WaveFunctionCollapse.ts` is an original TypeScript implementation of
the "simple tiled model" described in
[mxgmn/WaveFunctionCollapse](https://github.com/mxgmn/WaveFunctionCollapse) —
not a port of that repo's C# code, just the same algorithm: collapse the
lowest-entropy cell to one tile, propagate the resulting edge constraint to
its neighbors, repeat.

The six base tiles in `src/wfc/tileset.ts` (blank / straight / corner /
t-junction / cross / dead end) expand to all 16 possible edge combinations
across their rotations, so the solver always has a legal tile for any
neighbor configuration — no backtracking ever actually triggers, though the
solver still handles it correctly if the tileset changes. Tiles are drawn
procedurally with Pixi `Graphics` and baked to textures, so there are no
external art assets.

## Run

```
npm install
npm run dev
```

Grid dimensions are derived from the window size and the tile-size control,
and "Seamless wrap" makes the edges tile — turn it off to see collapse
failures happen at the border with a non-exhaustive tileset.
