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

Any generator reading a selection must fall back to a wider pool rather than
drawing from an empty one; a hand-edited store or a future option edit can
otherwise leave a round unable to produce a question. The spec generates from
every option value in isolation to catch this.

## Testing

`ng test` runs Vitest. Prefer testing the pure layer directly. The pack spec
generates 200 questions per level per pack; any new pack is covered
automatically once registered in `pack-registry.ts`.

## Media

Default art and sounds are **generated, not hand-drawn** — edit
`scripts/generate-default-media.mts` and run `pnpm run gen:media`, then commit
the outputs in `public/media/`. Do not hand-edit files in `public/media/`.

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
