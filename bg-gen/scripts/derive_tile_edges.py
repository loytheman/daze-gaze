#!/usr/bin/env python3
"""
Rewrites a tileset JSON's tile list to carry an explicit, ground-truth
`edges` signature per tile ([N, E, S, W]) instead of the mxgmn `symmetry`
+ top-level `neighbors` rules.

Why: the old format only states one anchor orientation per neighbor rule
(e.g. "connection 1 / component"), and expanding that into all 4
directions requires guessing which physical rotation the original mxgmn
tool meant by "1" — a convention that isn't written down anywhere and
that we verified doesn't reduce to a simple clockwise/counter-clockwise
choice (see bg-gen conversation history). This script sidesteps that
entirely by reading each tile's actual edge pixels directly from its PNG,
the same approach tiledModel2.ts already uses successfully (hand-typed
there; here, derived automatically from the art instead of guessed).

Edge signature: each of the 4 unrotated edges is sampled as a sequence of
per-pixel color codes (a single letter per distinct color encountered
across the whole tileset — same style as the original Coding Train
tiled-model's 'AAA'/'BCB' labels, just machine-derived), always along a
fixed image axis (N/S left-to-right, E/W top-to-bottom) rather than a
clockwise perimeter walk. Because of that fixed axis, two touching edges
of unrotated tiles compare directly (no reversal) — unlike tiledModel2.ts,
whose hand-typed edges assume a clockwise reading and so need reversing.
Rotated tiles need their own care: edgeSpecTileset.ts's rotateEdges()
reverses the perpendicular sides' strings per 90° step (derived from the
actual pixel-rotation coordinate math), not just a cyclic relabel — see
its comments for why. No external rotation-direction convention is
needed either way, since both the label rotation and the pixel rotation
are defined by our own code and only need to agree with each other.

Not every tileset fits this model: Summer's tiles are marked "unique" in
the old format because each rotation is its own hand-drawn PNG rather
than a code-rotation of one base image, and its art relies on broad
hand-designed color blending across tile edges rather than pixel-exact
matching (verified: even the *original* mxgmn neighbor rules' declared-
compatible pairs differ by up to 255 in raw edge pixels, e.g. cliff-brown
against grass-green — that's real, deliberate blending, not AA noise a
quantize bucket could absorb). Summer is intentionally left on the old
symmetry+neighbors engine (realTileset.ts); this script assumes a single
base image per tile and isn't meant to be pointed at it.

Usage: python3 scripts/derive_tile_edges.py <TilesetName>
  e.g. python3 scripts/derive_tile_edges.py Circuit
Reads src/assets/tilesets/<TilesetName>.json + .../<TilesetName>/*.png,
overwrites the .json in place with the new {name, weight, edges} shape.
"""
import json
import sys
from pathlib import Path
from PIL import Image

def to_pixels(im):
    w, h = im.size
    px = im.load()
    return [[px[x, y] for x in range(w)] for y in range(h)]

def edge(pixels, n, direction):
    # 0=N(top row, L->R), 1=E(right col, T->B), 2=S(bottom row, L->R), 3=W(left col, T->B)
    if direction == 0:
        return pixels[0]
    if direction == 2:
        return pixels[n - 1]
    if direction == 1:
        return [pixels[y][n - 1] for y in range(n)]
    return [pixels[y][0] for y in range(n)]

# Anti-aliased curved art (e.g. circles) draws mirror-image tiles with
# genuinely non-identical AA fringes on their touching sides - not a bug,
# just independently-rendered pixels that were never going to line up
# exactly. Rounding each channel to the nearest bucket absorbs that noise
# so intentionally-compatible edges compare equal, while leaving simple
# hard-edged tilesets (few, widely-separated colors) untouched. Widened
# only as far as each tileset's own color variety demands (most bundled
# tilesets need no widening past 32 at all), since a needlessly coarse
# bucket risks merging colors that are meaningfully different rather than
# just noisy.
LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

def quantize(color, bucket):
    return tuple(min(255, (v + bucket // 2) // bucket * bucket) for v in color)

def main():
    if len(sys.argv) != 2:
        print("usage: derive_tile_edges.py <TilesetName>")
        sys.exit(1)
    name = sys.argv[1]
    base = Path(__file__).parent.parent / "src" / "assets" / "tilesets"
    json_path = base / f"{name}.json"
    tileset_dir = base / name

    data = json.load(open(json_path))
    tile_defs = data["tiles"]

    raw_edges = {}
    all_raw_colors = set()
    for t in tile_defs:
        im = Image.open(tileset_dir / f"{t['name']}.png").convert("RGB")
        n = im.size[0]
        pixels = to_pixels(im)
        edges = [edge(pixels, n, d) for d in range(4)]
        raw_edges[t["name"]] = edges
        for e in edges:
            all_raw_colors.update(e)

    bucket = 32
    while len({quantize(c, bucket) for c in all_raw_colors}) > len(LETTERS):
        bucket *= 2
    if bucket > 32:
        print(f"  ({name}: widened quantize bucket to {bucket} to fit {len(all_raw_colors)} raw colors into {len(LETTERS)} letters)")

    quantized_edges = {k: [[quantize(c, bucket) for c in e] for e in v] for k, v in raw_edges.items()}
    all_colors = {c for edges in quantized_edges.values() for e in edges for c in e}
    color_letter = {c: LETTERS[i] for i, c in enumerate(sorted(all_colors))}

    out_tiles = []
    for t in tile_defs:
        sigs = ["".join(color_letter[c] for c in e) for e in quantized_edges[t["name"]]]
        out_tiles.append({"name": t["name"], "weight": t["weight"], "edges": sigs})

    lines = ["{", '  "tiles": [']
    for i, t in enumerate(out_tiles):
        comma = "," if i < len(out_tiles) - 1 else ""
        edges_str = ", ".join(json.dumps(e) for e in t["edges"])
        lines.append(f'    {{ "name": {json.dumps(t["name"])}, "weight": {t["weight"]}, "edges": [{edges_str}] }}{comma}')
    lines.append("  ]")
    lines.append("}")
    json_path.write_text("\n".join(lines) + "\n")

    print(f"{name}: {len(out_tiles)} tiles, {len(all_colors)} distinct edge colors ({''.join(color_letter[c] for c in sorted(all_colors))})")
    for c, l in sorted(color_letter.items(), key=lambda kv: kv[1]):
        print(f"  {l} = rgb{c}")

if __name__ == "__main__":
    main()
