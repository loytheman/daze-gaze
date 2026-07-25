# daze-gaze

Multi-project repo, not a single app. Check which subfolder you're actually working in before assuming conventions carry over between them.

## Layout

- `stress/` — the active project: a Pixi.js + Vue + TypeScript "wander field" stress test/toy. Units spawn, idle/wander, and flee the mouse cursor (see `stress/src/pixi/CharacterActor.ts` and `stress/src/pixi/WanderField.ts`). Has its own `package.json`; run commands from inside `stress/`.
- `bg-gen/` — placeholder for background/tileset generation tooling. Currently empty.
- `_info/` — scratch reference links (procedural generation, Wang tiles, wave function collapse, pixel-art tilesets). Not code, just research notes.

## Preferences
- Write short comments

## Tech Stack
- Frontend: TypeScript, Vuejs, Tailwind CSS
- Backend: Nodejs, DynamoDB.


