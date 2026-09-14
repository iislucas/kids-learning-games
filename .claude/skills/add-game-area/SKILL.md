---
name: add-game-area
description: Add a new area to the map in Elyse's Learning Game — a new place with its own ground, scenery, a landmark that grows with the star and crown, random extras, and the tasks (challenges) that live there. Use when asked to add an area, region, land, world or theme to the map, or a new game that needs a place of its own. Also covers adding tasks to an existing area.
---

# Adding a game area

An **area** (a *region* in the code) is a patch of the map with its own look,
holding the tasks of one game. Every area needs four things:

| Piece | What it is | Where |
| --- | --- | --- |
| Ground | A seamless 256px tile, generated, with a drawn fallback | `terrains.ts` + `public/media/map/tile-<id>.webp` |
| Scenery | A few kinds of prop scattered over the ground | `terrains.ts` + `props.ts` |
| Landmark | One prop that grows at each task: small for ⭐, big for 👑 | `terrains.ts` + `props.ts` |
| Extras | Two or more props; one is picked at random per region | `terrains.ts` + `props.ts` |

…plus the **tasks** themselves (challenges on a pack) and the **region** that
places them on the map.

Read `README.md` and `CLAUDE.md` first. Use `pnpm`, never npx.

## 1. The tasks

Tasks are `Challenge`s on a `QuestionPack` in `src/app/quiz/packs/`. Build each
one with `completeSet` from `question.types.ts`: give it the items and how to
ask one, and it deals the deck and writes the "Get all N right!" goal.

```ts
completeSet({
  id: 'shapes.corners',        // unique; its prefix decides the region
  name: 'Count the corners',
  short: '△',                  // signpost text, 4 characters at most
  emoji: '🔺',
  items: SHAPES,               // 4–12 of them
  ask: (rng, shape) => cornersQuestion(rng, shape),
  requires: { optionId: 'kinds', value: 'polygons' }, // only if an option gates it
})
```

- **A new game** is a new pack, registered in `pack-registry.ts`. It then shows
  on the games list and is covered by the pack spec (200 questions per level)
  and the challenge spec automatically. Update the pack count in
  `quiz-session.spec.ts` ("registers N packs").
- **More tasks for an existing area** only need more `completeSet` entries with
  the region's id prefix. The map places them itself; if a row gets crowded,
  raise `perRow` or the region's `rx`/`ry`.
- Questions are built with `makeChoice` (a `choice` question). If the game needs
  a different way of answering, see "A new kind of question" below.
- Levels are difficulty; options are content. Do not encode one as the other.

## 2. The look: `src/app/explore/terrains.ts` and `props.ts`

Add any new pictures to `PROPS` in `props.ts`. Each needs a `description` (the
image model's prompt: one object, plainly described) and, unless it is one of
the drawn kinds, `looksLike`: the drawn prop to fall back on. Use `scale` for
scenery that is small by nature.

Then add one entry to `TERRAINS` in `terrains.ts`:

```ts
snow: {
  description: 'soft fresh snow with faint blue shadows',  // tile prompt
  tile: { top: '#f4f8ff', bottom: '#dfe8f5', count: 24, marks: (x, y, size, seed) => `…svg…` },
  scenery: ['pine', 'pine', 'boulder'],    // repeat a kind to weight it
  sceneryCount: 20,
  landmark: 'igloo',                       // grows at every task here
  extras: ['snowman', 'sledge'],           // one is picked at random
},
```

Rules the specs enforce:

- Every prop falls back to a drawing, and every prop is used by some terrain.
- A landmark is unique to its terrain and never doubles as an extra.
- Every tile and prop has its `.webp` committed (`default-pack.spec.ts`).

The `tile` recipe must tile seamlessly. `terrainTileSvg` draws each mark at all
nine wrap offsets, so marks may cross the edge. Keep it to small marks on a
gradient.

## 3. The region: `src/app/explore/map-layout.ts`

Add a `RegionPlan` to `REGION_PLANS`:

```ts
{
  id: 'snow', packId: 'shapes', prefix: 'shapes.',
  name: 'Shape Snowfield', emoji: '❄️', colour: '#6fa8dc',
  cx: 870, cy: 2020, rx: 420, ry: 170,
  terrain: 'snow', perRow: 4,
},
```

- Keep it clear of the other ellipses. The map is `MAP_WIDTH` × `MAP_HEIGHT`
  (1700 × 1800); grow `MAP_HEIGHT` for a new row along the bottom.
- A pack split across several regions gives each one `levels`, so an ordinary
  round lands in the right place (see the maths regions).
- The layout spec checks that spots are inside their region, far enough apart to
  tap, and that every level of every pack has a region.

## 4. Generate the art

The pictures are generated, never hand-drawn (`CLAUDE.md`). With a Gemini key in
`public/local-keys.json` (billing enabled):

1. `pnpm start`, open `/media`, **Landscape** tab. The new tile and props appear
   as rows automatically. Press **Make it** on each: the tile, any new scenery,
   the landmark and every extra.
2. Look at every result. Make another if a picture is off-style, cropped, or
   too close to existing scenery; the landmark must read clearly as *the* thing
   that grew there.
3. **Export pack**, then save the files into the repo:

   ```bash
   pnpm run extract:map-art ~/Downloads/media-pack.json --only snow,igloo,snowman,sledge
   ```

   Without `--only` it writes every generated tile and prop in the pack, which
   replaces committed art you may not mean to touch.
4. In the studio, **Restore built-in media** so the browser uses the committed
   files again.

If you are driving the in-app browser and cannot download the export, read
`klg.mediaPack` from `localStorage` in the page and POST each `data:image/webp`
URI to a tiny local HTTP server that writes it to `public/media/map/`. Don't
paste image data through the conversation.

## 5. Check it

```bash
pnpm test
```

Then `pnpm start` and check at **375px wide**:

- The area's tile and scenery on `/`, its name label, and the random extra.
- A task with no badge shows bare earth, with ⭐ a small landmark, with 👑 a big
  one. To see those without playing, set `klg.mastery` in `localStorage`, e.g.
  `{"shapes.corners": {"attempts":2,"bestCorrect":5,"total":5,"perfectRuns":2,"currentPerfectStreak":2,"bestPerfectStreak":2}}`,
  and remove it afterwards.
- A round played from a task uses the area's ground behind the question.

Update the README: the pack table, the challenge count, and the region list
under "The map".

## A new kind of question

Every question has a `kind`. The round (`QuizSession`), stars, retries and
challenges never look inside it. To add one, e.g. typing a number:

1. `question.types.ts`: add `TypeQuestion` (`kind: 'type'`, plus its fields) to
   the `Question` union and `TypeAnswer` to `Answer`.
2. `game-kinds.ts`: add its rules to `GAME_KINDS`: `isCorrect`, `key` (must
   include the right answer), `problems` (what makes one malformed), and
   `retryHint` (said after a wrong answer).
3. A component in `src/app/components/` that takes the answer, like
   `choice-answers`: inputs `question`, `answer`, `revealed`; output `answered`.
   Mark its host `data-prize-avoid`, keep tap targets at least 56px and in thumb
   reach at the bottom, and keep wrong answers gentle.
4. `play.page.html`: add a `@case` for the kind in the answer `@switch`.

What the question *shows* (prompt, picture, things to count) is shared by every
kind through `app-question-prompt`, so a new kind only adds how it is answered.
