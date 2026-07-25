# daze-gaze

Multi-project repo, not a single app. Check which subfolder you're actually working in before assuming conventions carry over between them.

## Layout

- `stress/` — the active project: a Pixi.js + Vue + TypeScript "wander field" stress test/toy. Units spawn, idle/wander, and flee the mouse cursor (see `stress/src/pixi/CharacterActor.ts` and `stress/src/pixi/WanderField.ts`). Has its own `package.json`; run commands from inside `stress/`.
- `bg-gen/` — placeholder for background/tileset generation tooling. Currently empty.
- `_info/` — scratch reference links (procedural generation, Wang tiles, wave function collapse, pixel-art tilesets). Not code, just research notes.

## Preferences
- Write short comments
- JSON files with arrays of small, uniform objects (e.g. tileset data):
  one compact object per line instead of full pretty-print
  ```json
  {
    "tiles": [
      { "name": "bridge", "symmetry": "I", "weight": 1 },
      { "name": "ground", "symmetry": "X", "weight": 1 }
    ],
    "neighbors": [
      { "left": "bridge 1", "right": "river 1" },
      { "left": "bridge 1", "right": "riverturn 1" }
    ]
  }
  ```

## Tech Stack
- Frontend: TypeScript, Vuejs, Tailwind CSS
- Backend: Nodejs, DynamoDB.


