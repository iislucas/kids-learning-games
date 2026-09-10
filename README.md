# Play & Learn 🦊

A small collection of educational games for a 7-year-old: arithmetic, spelling,
French and a nature quiz. Answer correctly, the character celebrates, and stars
accumulate towards a collection of 30 prizes. There is also a landscape to walk
around, with a badge to win at every place on it.

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
  [Views.Map]: addUrlParams(pathPattern``, [{ name: 'at' as const, default: '' }]),
  [Views.Home]: pathPattern`games`,
  [Views.Play]: addUrlParams(pathPattern`play/${pv('packId')}`, [
    { name: 'level' as const, default: '1' },
    { name: 'challenge' as const, default: '' },
  ]),
  ...
};
```

**The map is the front door**; the list of games lives at `/games`.

One trap worth knowing: `hrefForView` carries the pattern's *current* url params
across, so its result often already has a query string on it. Adding another
parameter by hand produces `play/maths?level=2?challenge=x`, where everything
after the second `?` is swallowed into the first value — which looks like the
app ignoring the link rather than like a malformed URL. Use
[`withParam`](src/app/routing/routing.utils.ts) instead of concatenating.

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

### Challenges and the map

A normal round is ten questions sampled from a level, so the best it can say is
"nine out of ten of *some* questions". A **challenge** is the complete set for
one narrow thing — the 7× table is exactly 7×1 … 7×10, the Space topic is
exactly its six facts — asked once each, in a shuffled order.

That makes a real milestone visible: getting every question right, first time,
means the whole thing is known. There are two badges per challenge, and the
second is the interesting one:

| | | |
| --- | --- | --- |
| ⭐ | **Gold star** | Every question right in one go |
| 👑 | **Crown** | Do that twice in a row |

A round that is not perfect breaks the run, so "twice in a row" is not the same
as "twice ever" — but `bestPerfectStreak` only ever grows, so **a badge is never
taken away**. The rules live in [`mastery.ts`](src/app/core/mastery.ts) and the
badges are derived from the record rather than stored, the same discipline as
prizes being derived from the star total.

Because a corrected answer does not count (see the retry rule above), a wrong
answer costs the badge for that round — which is exactly what makes it mean
something.

Challenges are declared on the pack that owns their content
([`Challenge`](src/app/quiz/question.types.ts)) and flattened into a registry by
[`challenges.ts`](src/app/quiz/challenges.ts). There are 47: the eleven times
tables, the ten adding families, the ten take-away families, the three word
bands plus sight words and rhymes, the five French topics plus numbers, and the
four quiz topics. One is played with `?challenge=<id>` on the play screen;
`QuizSession` takes the deck instead of generating, and the round is as long as
the deck.

A take-away family is the exact inverse of its adding family — `n + b` becomes
`(n + b) − n`, so both have the answers 1–10 and can be practised against each
other, which is how subtraction is taught at this age.

A challenge gated on an option value **closes when that value is switched off**,
the same rule as `isLevelAvailable` applied to a single value: turning the 8×
table off has to close its place on the map too, or the switch would be a lie.
The spot stays on the map, struck through, saying which setting closed it.

### The map (`/`)

The 47 challenges are places in a landscape the fox walks around in eight
directions. **Tapping is the whole interface** — tap the ground and she walks
there, tap a place and she walks to it and it opens. Arrow keys and WASD work
too, for a laptop.

Three things make the map the collection screen as well as the menu:

- **What she has built at each place** shows how far in she is: an empty
  signpost, then walls up, then the finished thing with a flag or a beacon.
  Each region builds something of its own — a jetty and a boat on the ponds, a
  treehouse in the wood, a cairn on the hills — so a finished place is
  recognisable from across the map. See
  [`spot-build.ts`](src/app/explore/spot-build.ts).
- **Prizes sit where they were won.** They unlock on a cumulative star total,
  which knows nothing about place, so the place is recorded as it happens
  (`prizePlaces` in [`progress.service.ts`](src/app/core/progress.service.ts)).
  Anything won before that was recorded gathers at the crossroads.
- **A closed place stays on the map**, struck through, naming the setting that
  closed it.

Three files, all pure and Angular-free:

- [`map-layout.ts`](src/app/explore/map-layout.ts) — the regions, and a
  serpentine path that places each challenge's spot inside its region. Adding a
  challenge places itself.
- [`explorer.ts`](src/app/explore/explorer.ts) — `directionFor` (eight 45°
  wedges, screen coordinates so north is negative y) and `stepToward`, which
  never overshoots on a long frame.
- [`map-art.ts`](src/app/explore/map-art.ts) — the tiles, the props and the
  labelled sketch.

The walk is driven by `requestAnimationFrame`, which the global
`prefers-reduced-motion` rule in `styles.scss` cannot reach, so the map checks
`matchMedia` itself and has her arrive instead of travel.

### How the landscape is drawn

**Tiles and sprites, not one big picture.** Each region is a patch of ground
filled with a seamless 256px tile, with props — trees, boulders, cottages,
ponds — scattered over it at positions derived from the layout. Three reasons:

- Every piece can be replaced on its own by a generated image, and a tile plus a
  handful of sprites is a fraction of the bytes of a 1700×1400 painting, which
  matters when the media pack lives in `localStorage`.
- A tile repeats to fill any area, so moving or adding a region needs no art
  regenerated.
- An image model asked for one tree gets one tree right. Asked for a whole map
  with forty-seven clearings in exact positions, it does not.

The seamlessness comes from drawing every mark at all nine wrap offsets and
clipping to the tile, so anything running off one edge is already arriving at
the opposite one. Without that, every tile boundary shows as a hard line — which
on a repeating background is the first thing the eye finds.

There is deliberately no committed map asset: it is all built at runtime from
the layout, so a new challenge needs no regenerated file.

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
fox is drawn programmatically as an SVG sprite sheet (a pose sheet and a
walk sheet), and the sounds are synthesised from scratch into WAVs. Edit that script and run `pnpm run gen:media`
to change them.

### The media studio (`/media`)

Generates replacements using your own API keys:

| What | Service | Key |
| --- | --- | --- |
| Character sprite sheet | Gemini `gemini-3.1-flash-image` | Gemini |
| Map ground tiles and scenery sprites | Gemini `gemini-3.1-flash-image` | Gemini |
| Pictures for the spelling questions | Gemini `gemini-3.1-flash-image` | Gemini |
| Sound effects | ElevenLabs `/v1/sound-generation` | ElevenLabs |
| Music loop | Gemini Lyria RealTime | Gemini |

Anything you generate is saved to `localStorage` and overrides the default.
"Export pack" writes it out as JSON so it can be moved to another device or
committed as the new default.

#### Keys

A key comes from one of two places, and what is typed into the studio always
wins over the file:

1. **Typed into the studio**, kept in that browser's `localStorage`.
2. **`public/local-keys.json`** — copy `public/local-keys.example.json` and
   paste your keys in:

   ```json
   { "gemini": "AIza…", "elevenLabs": "sk_…" }
   ```

   Two things that catch people out, both of which the studio now says out
   loud rather than surfacing as raw API JSON:

   - **Gemini image generation has no free tier.** A valid key still fails on
     every picture with a `limit: 0` quota error until billing is enabled on
     its Google Cloud project.
   - **An ElevenLabs key starts with `sk_`.** The long hex string the
     dashboard lists next to a key is its *id*, not the key; the key itself is
     only shown when it is created or rotated.

   It is git-ignored, and read **only when running the dev server**
   (`isDevMode()`), so generating a batch of pictures survives a cleared
   browser without pasting keys in again.

   Its value is deliberately *not* copied into `localStorage`, so the file
   stays the single source of truth: delete it and the key is gone, rather than
   lingering in a browser you have to remember to clear.

Everything in `public/` is copied into the build, and the build is published to
GitHub Pages for anyone to read — so `.gitignore` alone would not be enough.
[`prepare-pages.mts`](scripts/prepare-pages.mts) **refuses to prepare a build**
containing `local-keys.json`, and `build:pages` is the workflow's only build
command. CI never has the file, so the only thing that check can catch is a
local `pnpm run build:pages` on a machine that has keys — which is exactly the
case worth stopping.

> **The rest of the caveat still stands.** Keys are sent directly from the
> browser to Google and ElevenLabs; there is no server and nothing is proxied.
> That is fine on your own machine — but do not enter keys on a shared or public
> deployment. The game itself never touches them; only the studio does.

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

### The walk sheet

Walking the map needs the character from eight sides, so `CharacterDef` has an
optional `walk`: a second sheet, four frames across by eight directions down,
in the same row order as `DIRECTIONS` in `explorer.ts`. It is optional rather
than four more `AnimationName`s because a saved media pack writes
`Record<AnimationName, Animation>` out in full — widening that union would leave
every existing pack missing keys. A pack without a walk sheet falls back to the
idle pose, so the map still works.

The default one is drawn by the same generator script as the fox. Facing drives
where the muzzle, ears and tail sit and whether the face is drawn at all (north
shows the back of the head); the frame drives the leg swing. From the side the
stride sells the walk and from the front it cannot be seen, so the lifted foot
does that work instead.

### The landscape (`/media`, Landscape tab)

The map's art is generated a piece at a time: one seamless tile per kind of
ground, one sprite per kind of scenery. Anything not generated falls back to the
drawn version, so a half-finished pack still looks like a landscape.

The prompts do most of the work, and both are mostly about constraints. A tile
must **tile** — so it asks for even lighting, no vignette, no focal point and no
border, because any of those turn into a visible grid the moment it repeats. A
prop must sit on whatever ground it lands on — so it asks for one object on a
flat plain background, which is then cut away to transparency by the same
median-of-the-border analysis the sprite sheet uses
([`cutOutSubject`](src/app/media/raster.ts)).

Everything is rescaled before storing: a full-size PNG data URI trips the
`localStorage` quota that `saveOverride` guards.

### Question pictures (`/media`, Pictures tab)

The spelling round asks "how do you write this?", so the picture *is* the
question — and an emoji is a poor stand-in, since several words share one and
some are ambiguous (`☂️` is as much *rain* as *umbrella*). A question can name a
`picture`, and the media pack holds a drawing for it; without one the emoji
still shows.

The list of pictures to draw is *discovered* rather than written down: every
pack is asked for a pile of questions and the ones naming a picture are
collected ([`pictures.ts`](src/app/quiz/pictures.ts)). A word added to a pack
therefore appears in the studio to be drawn, with no second list to keep in
step.

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
