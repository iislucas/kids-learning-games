# Working in this repo

Educational games for a 7-year-old. Angular 22, zoneless, signals, standalone
components. No backend. Read `README.md` first — it explains the architecture.

## Commands

Use **pnpm**, never npx or npm.

```bash
pnpm test
```

`.npmrc` pins `use-node-version=24.18.1` because Angular 22 rejects older Node.
Do not prefix commands with `PATH=...`; pnpm handles the Node version itself.

## Conventions

- **Router**: this project uses its own signal-based router in
  `src/app/routing/`, not `@angular/router`. Add routes to `initPathPatterns` in
  `app.config.ts` and a `@case` in `app.html`. When injecting `RoutingService`,
  always write the explicit type annotation
  (`readonly router: RoutingService<AppPathPatterns> = inject(...)`) or
  dot-notation access to `pathVars` / `urlParams` fails to compile.
- **Signals over observables.** `ChangeDetectionStrategy.OnPush` everywhere.
- Wrap side effects inside `effect()` in `untracked()` so writing a signal that
  the effect also reads does not re-trigger it.
- **Strict TypeScript**, including `noPropertyAccessFromIndexSignature`. Do not
  reach for `any` or bracket-notation workarounds.
- Keep game rules in plain classes (`quiz-session.ts`) and pure functions
  (`sprite-grid.ts`, `prizes.ts`) rather than in components — that is where the
  tests live.

## Pack options

Levels = difficulty. Options = content (which times tables, which topics). Do
not encode content choices as levels — that is what the `options` field on a
`QuestionPack` is for.

**Any category can be emptied**, and that must be honoured, not ignored —
"no adding" means none. Emptying an option makes the levels that depend on it
unavailable (`isLevelAvailable`); it must never silently fall back to showing
everything. When a level can be closed for a reason the generic empty-option
rule cannot see, add `levelAvailable` to the pack.

Generators still keep a fallback for an empty pool, but it should be
unreachable — level availability gates them. The spec generates from every
option value in isolation and from every category switched off.

## Testing

`ng test` runs Vitest. Prefer testing the pure layer directly. The pack spec
generates 200 questions per level per pack; any new pack is covered
automatically once registered in `pack-registry.ts`.

## Media

Nothing in `public/media/` is hand-drawn, and nothing there should be
hand-edited.

- **Sounds** are synthesised by `scripts/generate-default-media.mts`. Edit that
  and run `pnpm run gen:media`, then commit the outputs.
- **Pictures** — the character sheets, the map's ground tiles and scenery, and
  the spelling-word pictures — are generated with an image model in the media
  studio (`/media`) and committed from there.
  `src/app/media/default-pack.ts` points at them. To change one, generate a new
  one in the studio and replace the file.

Two rules for anything that cuts a subject out of a generated image: background
is what the *border can reach*, not what matches its colour (or white pixels
inside the sprite become holes), and a cut-out keeps its own aspect ratio (only
ground tiles are squared off, because they tile).

The studio needs a Gemini key. Put one in `public/local-keys.json` (git-ignored,
copy `local-keys.example.json`); note that image generation has no free tier and
needs billing enabled on the key's project.

## This is for a child

- Every tappable thing is at least 56px (`--tap`), and answer buttons sit at the
  bottom of the screen within thumb reach.
- Wrong answers are gentle: a soft sound, a warm "Not quite!", and an
  explanation. Never a harsh buzzer or anything that reads as failure.
- A wrong answer shows the correct choice and then **puts the same question
  back** so she answers it properly. Do not "fix" this into skipping ahead — the
  retry is the teaching. It deliberately earns no star, so wrong answers still
  cost the streak.
- Mobile-first. Check changes at 375px wide before anything else.
- Respect `prefers-reduced-motion`.
