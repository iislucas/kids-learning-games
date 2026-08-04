# Play & Learn 🦊

A small collection of educational games for a 7-year-old: arithmetic, spelling,
French and a nature quiz. Answer correctly, the character celebrates, and stars
accumulate towards a collection of 30 prizes.

Built with Angular 22 (zoneless, signals, standalone components), no backend, and
no accounts. Progress lives in `localStorage`. It works offline once loaded, and
is designed for a phone first.

---

## Quick start

```bash
pnpm install
```

```bash
pnpm start
```

Then open http://localhost:4300.

Other commands:

```bash
pnpm test
```

```bash
pnpm build
```

```bash
pnpm run gen:media
```

### Node version

Angular 22 needs Node `^22.22.3 || ^24.15.0 || >=26`. `.npmrc` pins
`use-node-version=24.18.1`, so `pnpm` runs every script on the right Node no
matter what your shell has active — you should not need to `nvm use` anything.

---

## How it works

### Routing

The app uses the strongly-typed, signal-based router ported from
`ilc-members-manager` (`src/app/routing/`) rather than `@angular/router`. Routes
are declared once in [`app.config.ts`](src/app/app.config.ts):

```ts
export const initPathPatterns = {
  [Views.Play]: addUrlParams(pathPattern`play/${pv('packId')}`, [
    { name: 'level' as const, default: '1' },
  ]),
  ...
};
```

Path variables and query params become typed `WritableSignal<string>`s, bound
two-way to the URL. Writing `levelParam.set('2')` updates the address bar;
pressing back updates the signal. When injecting it, **the explicit type
annotation is required** or dot-notation access fails — see the comment at the
top of [`routing.service.ts`](src/app/routing/routing.service.ts).

### Question packs

Each subject is a `QuestionPack` ([`question.types.ts`](src/app/quiz/question.types.ts))
that generates a question for a given level from a seeded RNG. Maths generates
infinitely; the others sample from curated lists.

To add a subject: write a pack in `src/app/quiz/packs/`, then add it to
[`pack-registry.ts`](src/app/quiz/pack-registry.ts). It appears on the home
screen automatically, and the shared spec starts exercising it — 200 generated
questions per level, checking for duplicate options, empty choices and
out-of-range answers.

### Choosing what to practise

**Levels control how hard it is; options control what she practises.** Keeping
those separate is what lets you narrow a round to whatever is being taught this
term without also changing the difficulty.

Every pack can declare `options`: named sets of content toggles, edited from the
⚙️ on the home card or in the play screen. They are stored per device and
changing one restarts the round.

| Pack | Options |
| --- | --- |
| Number Fun | Which **times tables** (2–12, defaults 2/3/4/5/10); which operations appear in the mixed round |
| Word Play | Word difficulty — short, longer, tricky |
| Français | Word topics — animals, food, colours, school, family |
| Wonder Quiz | Quiz topics — animals, body, space, nature |

**Any category can be switched off completely** — "no adding at all" is a
legitimate thing to want. Emptying one is honoured rather than ignored: the
levels that depend on it become unavailable, shown struck through in the panel
with a line explaining which rounds went away.

`isLevelAvailable` in [`question.types.ts`](src/app/quiz/question.types.ts)
decides this. The generic rule is "any option feeding this level is empty", and
a pack can add `levelAvailable` for cases the generic rule cannot see:

- **Maths Mixed sums** can be left with nothing to do even though its own option
  is non-empty — if "Times" is the only operation chosen but every times table
  has been switched off. Multiplying also drops out of that round automatically
  whenever no tables are on.
- **French le/la** needs a topic containing nouns; colours are adjectives, so a
  colours-only selection closes that round.

Around that:

- If the requested level is unavailable the game falls back to the nearest one
  that is, so a stale bookmark still plays. The URL keeps the original request,
  so re-enabling the category returns you to it.
- If a whole pack is switched off (Wonder Quiz has one level fed by one option,
  so it can be) the play screen says so and offers the ⚙️ rather than failing.
- [`resolveSelection`](src/app/quiz/question.types.ts) reconciles a stored
  selection against the pack's current options, dropping values that no longer
  exist. An option that is *present but empty* stays empty — that is a
  deliberate "none of this" and must survive a reload — while an option that is
  *absent* picks up its defaults, so adding an option to a pack later does not
  break existing players.
- Generators keep a fallback for an empty pool, but it is unreachable: level
  availability gates them. Tests cover generating from every option value in
  isolation, and from every category switched off.

Note that Wonder Quiz has a single level: its four topics were previously
levels, which implied space was harder than animals. They are options now.

The rules of a round live in [`quiz-session.ts`](src/app/quiz/quiz-session.ts),
deliberately free of Angular so streaks, tap-guarding and level-up thresholds are
directly testable. Two rules there are worth knowing:

- **A wrong answer does not skip ahead.** The correct choice is shown in green
  with an explanation, then the *same question comes back* to be answered
  properly. The point is to learn the answer, not to be marked on it. That retry
  earns nothing and is not recorded, so a wrong answer still costs the streak and
  the round score stays first-attempt accuracy.
- **The same question never appears twice in a row.** Note the repeat key
  includes the correct answer, because some rounds (English sight words) ask
  through the options alone and share a fixed prompt.

### Prizes

30 collectible stickers across 6 themed sets, unlocked at cumulative star
thresholds and **interleaved across sets on purpose** — being partway through
several collections pulls harder than finishing one at a time.

Collected prizes are drawn faintly **behind the game itself**
([`prize-backdrop`](src/app/components/prize-backdrop/prize-backdrop.ts)), so the
collection is visible while playing rather than only on a separate screen. Each
prize holds one fixed slot forever, and slots fill in golden-ratio order so the
scatter stays balanced at any collection size instead of piling up in one
corner. A prize won mid-round pops into place and stays brighter for the rest of
the round.

Stars pay more during a streak (1 → 2 at 3 in a row → 3 at 5 → 4 at 10). The
curve in [`prizes.ts`](src/app/core/prizes.ts) is tuned so the first sticker
lands after 3 correct answers and the full set stays reachable over a few months
of regular play. A test guards it against being retuned into something
unwinnable.

---

## Media

Everything the game looks and sounds like is a **media pack**
([`media.types.ts`](src/app/media/media.types.ts)): one character sprite sheet
with four animations, six sound effects, and an optional music loop.

The repo ships a complete default pack, so a fresh clone is fully playable with
no API keys. Those defaults are generated by
[`scripts/generate-default-media.mts`](scripts/generate-default-media.mts) — the
fox is drawn programmatically as an SVG sprite sheet, and the sounds are
synthesised from scratch into WAVs. Edit that script and run `pnpm run gen:media`
to change them.

### The media studio (`/media`)

Generates replacements using your own API keys:

| What | Service | Key |
| --- | --- | --- |
| Character sprite sheet | Gemini `gemini-2.5-flash-image` | Gemini |
| Sound effects | ElevenLabs `/v1/sound-generation` | ElevenLabs |
| Music loop | Gemini Lyria RealTime | Gemini |

Anything you generate is saved to `localStorage` and overrides the default.
"Export pack" writes it out as JSON so it can be moved to another device or
committed as the new default.

> **On API keys.** Keys are stored in this browser and sent directly to Google
> and ElevenLabs. There is no server and nothing is proxied. That is fine on your
> own machine — but do not enter keys on a shared or public deployment. The game
> itself never touches them; only the studio does.

### The sprite pipeline

Image models will not place poses on an exact pixel grid, so the generated image
is analysed before use ([`sprite-grid.ts`](src/app/media/sprite-grid.ts), fully
unit-tested against synthetic images):

1. **Classify** every pixel as sprite or background. The background colour is the
   **median of the image border** — robust even when a pose runs off the edge,
   where sampling corners fails.
2. **Find gutters** via row/column projection profiles. Columns are measured
   *within each row band*, so a row of 3 poses and a row of 4 need not line up.
3. **Tighten** each cell to the pixels actually inside it.
4. **Plan a uniform grid**: one cell sized to the largest pose, with each pose
   centred horizontally and **bottom-aligned to a common baseline** — aligning
   feet rather than centres is what stops the character bobbing between frames.
5. **Redraw** into that grid with the background knocked out to transparency.

The result animates with nothing but a stepped `background-position`.

The prompt in [`sprite-prompt.ts`](src/app/media/sprite-prompt.ts) does the other
half of the work: it demands a flat background, wide gaps between poses, and a
consistent character at a consistent scale, because those are exactly what steps
1–4 depend on.

You can also **upload** any sprite sheet instead of generating one — it goes
through the same pipeline.

---

## Deploying

The game is live at
<https://iislucas.github.io/kids-learning-games/>. There is no
backend: `pnpm build` produces a static bundle in
`dist/kids-learning-games/browser`, and that is the whole site. API keys for the
media studio are typed in by whoever is using it and stay in that device's
`localStorage`, so nothing secret is ever in the build.

Every push to `main` runs
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): tests, then
`pnpm run build:pages`, then a Pages deploy. To reproduce that build locally:

```bash
pnpm run build:pages
```

That is `ng build --base-href /kids-learning-games/` plus
[`scripts/prepare-pages.mts`](scripts/prepare-pages.mts), which adds the two
things GitHub Pages needs:

- **`404.html`** — a copy of `index.html`. The router uses the History API, so
  a deep link like `/play/maths`, or a reload on one, has no file behind it;
  Pages serves `404.html` for those, which boots the app and lets the router
  read the URL as usual.
- **`.nojekyll`** — stops Pages putting the output through Jekyll, which drops
  files whose names start with an underscore.

Serving from a subpath rather than a domain root is handled in two places, both
keyed off `<base href>`: asset URLs resolve against `document.baseURI`
([`assetUrl`](src/app/media/default-pack.ts)), and the router strips the base
before matching a route and adds it back when it writes to the History API or
builds an href. Nothing else in the app knows what path it is served under, so
a different host or a custom domain only needs a different `--base-href`.

---

## Licence

Private family project. The default art and sounds are original, produced by the
generator script in this repo.
