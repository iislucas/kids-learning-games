import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { AppPathPatterns, Views } from '../../app.config';
import { RoutingService } from '../../routing/routing.service';
import { withParam } from '../../routing/routing.utils';
import { AudioService } from '../../core/audio.service';
import { storedSignal } from '../../core/stored-signal';
import { BADGES, BadgeId } from '../../core/mastery';
import { MasteryService } from '../../core/mastery.service';
import { Prize } from '../../core/prizes';
import { ProgressService } from '../../core/progress.service';
import { MediaService } from '../../media/media.service';
import {
  ChallengeRef,
  blockingOption,
  findChallenge,
  isChallengeAvailable,
} from '../../quiz/challenges';
import { PackOptionsService } from '../../quiz/pack-options.service';
import { WalkSprite } from '../../components/walk-sprite/walk-sprite';
import {
  Direction,
  Point,
  clampToMap,
  directionFor,
  stepToward,
  vectorFor,
} from '../../explore/explorer';
import {
  PlacedProp,
  cssUrl,
  noise,
  pathThrough,
  placeProps,
  propSvg,
  svgDataUrl,
  terrainTileSvg,
} from '../../explore/map-art';
import { BuildStage, buildDataUrl, stageFor } from '../../explore/spot-build';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  MapRegion,
  MapSpot,
  buildMapLayout,
  regionIdForPlace,
  spotAt,
  spotFor,
} from '../../explore/map-layout';

/** Arrow keys and WASD. Tapping is the main way about; these are for a laptop. */
const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: 'n',
  ArrowDown: 's',
  ArrowLeft: 'w',
  ArrowRight: 'e',
  w: 'n',
  s: 's',
  a: 'w',
  d: 'e',
};

/** One press of an arrow key moves her this far. */
const NUDGE = 130;

interface SpotView {
  spot: MapSpot;
  ref: ChallengeRef;
  region: MapRegion;
  badges: BadgeId[];
  stage: BuildStage;
  build: string;
  available: boolean;
  /** Why it is shut, when it is. */
  closedBecause: string | null;
  playHref: string;
}

interface PlacedPrize {
  prize: Prize;
  x: number;
  y: number;
}

interface RegionView {
  region: MapRegion;
  tile: string;
  props: (PlacedProp & { src: string })[];
  track: string;
}

/**
 * The landscape she walks around, and the first thing she sees.
 *
 * The map is the menu and the collection screen at once: every place on it is
 * one complete set of questions, what she has built there shows how far in she
 * is, and the prizes she has won sit where she won them. That answers "what
 * shall I do now?" far better than a list of games, because it shows what is
 * left as well as what is done.
 */
@Component({
  selector: 'app-map-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WalkSprite],
  templateUrl: './map.page.html',
  styleUrl: './map.page.scss',
})
export class MapPage {
  private readonly router: RoutingService<AppPathPatterns> =
    inject(RoutingService<AppPathPatterns>);
  private readonly audio = inject(AudioService);
  private readonly mastery = inject(MasteryService);
  private readonly progress = inject(ProgressService);
  private readonly media = inject(MediaService);
  private readonly packOptions = inject(PackOptionsService);

  private readonly routeSignals = this.router.signals[Views.Map];
  private readonly atParam = this.routeSignals.urlParams.at;
  private readonly openParam = this.routeSignals.urlParams.open;

  readonly character = this.media.character;
  readonly layout = buildMapLayout();
  readonly badges = BADGES;
  readonly mapWidth = MAP_WIDTH;
  readonly mapHeight = MAP_HEIGHT;

  // Deliberately not `required`: the render callback reads it before Angular
  // has necessarily resolved it, and a required query throws rather than
  // returning undefined.
  private readonly viewport = viewChild<ElementRef<HTMLElement>>('viewport');

  /**
   * A whole-map painting, if one has been generated. It covers the tiles and
   * props entirely, so it is all-or-nothing.
   */
  readonly painting = computed(() => this.media.map().background?.src ?? null);
  readonly paintingUrl = computed(() => {
    const painting = this.painting();
    return painting ? cssUrl(painting) : null;
  });

  /**
   * Each region as a patch of tiled ground with its scenery on top. Generated
   * art replaces any piece; anything not generated falls back to the drawn one,
   * so a half-finished media pack still looks like a landscape.
   */
  readonly regions = computed<RegionView[]>(() =>
    this.layout.regions.map((region) => {
      const spots = this.layout.spots.filter((spot) => spot.regionId === region.id);
      return {
        region,
        tile: cssUrl(
          this.media.mapTile(region.terrain) ??
            svgDataUrl(terrainTileSvg(region.terrain)),
        ),
        props: placeProps(region, spots).map((prop) => ({
          ...prop,
          src: this.media.mapProp(prop.kind) ?? svgDataUrl(propSvg(prop.kind)),
        })),
        track: pathThrough(spots),
      };
    }),
  );

  /**
   * Where she last stopped, kept across visits. The `at` url parameter only
   * knows about spots, and only survives a trip that carried it — this is what
   * puts her back where she was after the games list, the settings, or
   * tomorrow, rather than at the crossroads every time.
   */
  private readonly lastPosition = storedSignal<Point | null>('klg.mapAt', null);

  readonly position = signal<Point>(this.startingPoint());
  readonly facing = signal<Direction>('s');
  readonly moving = signal(false);
  private target: Point | null = null;
  private frame: number | null = null;
  private lastFrameAt = 0;

  /** Every place on the map, with what has been built there. */
  readonly spots = computed<SpotView[]>(() => {
    this.mastery.all();
    return this.layout.spots.flatMap((spot) => {
      const ref = findChallenge(spot.challengeId);
      const region = this.layout.regions.find((r) => r.id === spot.regionId);
      if (!ref || !region) return [];
      const selection = this.packOptions.selectionFor(ref.pack);
      const available = isChallengeAvailable(ref, selection);
      const badges = this.mastery.badgesForChallenge(spot.challengeId);
      const stage = stageFor(badges);
      const href = this.router.hrefForView(Views.Play, { packId: ref.pack.id });
      return [
        {
          spot,
          ref,
          region,
          badges,
          stage,
          build: buildDataUrl(region.terrain, stage, region.colour),
          available,
          closedBecause: available ? null : this.closedReason(ref),
          playHref: withParam(href, 'challenge', spot.challengeId),
        },
      ];
    });
  });

  /**
   * Prizes shown where they were won.
   *
   * One won at a spot sits just beside that spot. One won in an ordinary round
   * only knows its region, so it lies somewhere out in that region's ground.
   * Only a prize with no home at all gathers at the crossroads — which reads
   * fine, as the place she set out from.
   */
  readonly placedPrizes = computed<PlacedPrize[]>(() => {
    const places = this.progress.prizePlaces();
    return this.progress.unlockedPrizes().map((prize) => {
      const place = places[prize.id];
      const angle = noise(`${prize.id}-angle`) * Math.PI * 2;
      const spot = place ? spotFor(this.layout, place) : undefined;
      if (spot) {
        // Around the spot, so several won at one place do not stack.
        const distance = 62 + noise(`${prize.id}-dist`) * 46;
        return {
          prize,
          x: Math.round(spot.x + Math.cos(angle) * distance),
          y: Math.round(spot.y + Math.sin(angle) * distance * 0.7),
        };
      }
      const regionId = regionIdForPlace(this.layout, place, prize.id);
      const region = this.layout.regions.find((r) => r.id === regionId);
      if (region) {
        // Anywhere in the region's ground, clear of its outer edge.
        const reach = 0.3 + noise(`${prize.id}-dist`) * 0.55;
        return {
          prize,
          x: Math.round(region.cx + Math.cos(angle) * region.rx * reach),
          y: Math.round(region.cy + Math.sin(angle) * region.ry * reach),
        };
      }
      const distance = 40 + noise(`${prize.id}-dist`) * 50;
      return {
        prize,
        x: Math.round(this.layout.start.x + Math.cos(angle) * distance),
        y: Math.round(this.layout.start.y + Math.sin(angle) * distance * 0.7),
      };
    });
  });

  /** The signpost card that is open, if any. */
  readonly openSpot = computed<SpotView | null>(
    () =>
      this.spots().find((view) => view.spot.challengeId === this.openParam()) ?? null,
  );

  readonly openRecord = computed(() => {
    const open = this.openSpot();
    return open ? this.mastery.recordFor(open.spot.challengeId) : null;
  });

  readonly homeHref = computed(() => this.router.hrefForView(Views.Home));
  readonly prizesHref = computed(() => this.router.hrefForView(Views.Prizes));
  readonly settingsHref = computed(() => this.router.hrefForView(Views.Settings));

  readonly stars = this.progress.stars;
  readonly soundsOn = this.audio.soundsEnabled;
  readonly earnedCount = this.mastery.badgeCount;
  readonly totalBadges = computed(() => this.layout.spots.length * BADGES.length);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopWalking());

    // The opening shot. The effect below only fires when she moves, and on
    // arrival she has not moved yet — so without this the map opens at its
    // top-left corner with the fox somewhere off screen.
    afterNextRender(() => {
      const viewport = this.viewport()?.nativeElement;
      if (viewport) this.centreOn(viewport, this.position(), 'auto');
    });

    // Then follow her.
    effect(() => {
      const at = this.position();
      const viewport = this.viewport()?.nativeElement;
      if (!viewport) return;
      untracked(() => this.centreOn(viewport, at));
    });
  }

  /**
   * Where she starts: the spot named in the url, else wherever she last
   * stopped, else the crossroads.
   */
  private startingPoint(): Point {
    const spot = this.atParam() ? spotFor(this.layout, this.atParam()) : undefined;
    if (spot) return { x: spot.x, y: spot.y };
    const last = this.lastPosition();
    if (last && Number.isFinite(last.x) && Number.isFinite(last.y)) {
      // Clamped, in case it was saved against a bigger map than this one.
      return clampToMap(last, { width: this.mapWidth, height: this.mapHeight });
    }
    return { ...this.layout.start };
  }

  private closedReason(ref: ChallengeRef): string {
    const option = blockingOption(ref);
    return option
      ? `Switched off under “${option.label}” in ${ref.pack.title}`
      : `Switched off in ${ref.pack.title}`;
  }

  // ── Walking ────────────────────────────────────────────────────────────────

  /**
   * Reduced motion means arriving rather than travelling. The global CSS rule
   * in `styles.scss` cannot reach an animation driven by rAF, so it is checked
   * here explicitly.
   */
  private prefersReducedMotion(): boolean {
    return (
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  /** Taps on open ground: she walks to where the finger landed. */
  onMapClick(event: MouseEvent): void {
    const viewport = this.viewport()?.nativeElement;
    if (!viewport) return;
    const bounds = viewport.getBoundingClientRect();
    const scale = viewport.scrollWidth / this.mapWidth;
    this.walkTo({
      x: (event.clientX - bounds.left + viewport.scrollLeft) / scale,
      y: (event.clientY - bounds.top + viewport.scrollTop) / scale,
    });
  }

  onKeyDown(event: KeyboardEvent): void {
    const direction = KEY_DIRECTIONS[event.key];
    if (!direction) return;
    event.preventDefault();
    const from = this.target ?? this.position();
    const vector = vectorFor(direction);
    this.walkTo({ x: from.x + vector.x * NUDGE, y: from.y + vector.y * NUDGE });
  }

  walkTo(point: Point): void {
    const destination = clampToMap(point, {
      width: this.mapWidth,
      height: this.mapHeight,
    });
    this.target = destination;
    this.closeSpot();

    if (this.prefersReducedMotion()) {
      this.facing.set(
        directionFor(
          destination.x - this.position().x,
          destination.y - this.position().y,
          this.facing(),
        ),
      );
      this.position.set(destination);
      this.arrive(destination);
      return;
    }

    if (this.frame === null) {
      this.lastFrameAt = performance.now();
      this.moving.set(true);
      this.frame = requestAnimationFrame((now) => this.tick(now));
    }
  }

  private tick(now: number): void {
    const target = this.target;
    if (!target) {
      this.stopWalking();
      return;
    }

    const dt = Math.min(now - this.lastFrameAt, 100);
    this.lastFrameAt = now;

    const step = stepToward(this.position(), target, dt, {
      facing: this.facing(),
    });
    this.position.set(step.position);
    this.facing.set(step.direction);

    if (step.arrived) {
      this.stopWalking();
      this.arrive(step.position);
      return;
    }
    this.frame = requestAnimationFrame((next) => this.tick(next));
  }

  private stopWalking(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.moving.set(false);
  }

  /** Standing on a spot opens it; standing on grass just stops. */
  private arrive(at: Point): void {
    this.target = null;
    this.lastPosition.set({ x: Math.round(at.x), y: Math.round(at.y) });
    const spot = spotAt(this.layout, at.x, at.y);
    if (!spot) {
      this.atParam.set('');
      return;
    }
    this.audio.play('tap');
    this.atParam.set(spot.challengeId);
    this.openParam.set(spot.challengeId);
  }

  /** Tapping a place walks her over to it, which then opens it. */
  goToSpot(event: Event, view: SpotView): void {
    event.stopPropagation();
    this.walkTo({ x: view.spot.x, y: view.spot.y });
  }

  closeSpot(): void {
    if (this.openParam()) this.openParam.set('');
  }

  private centreOn(
    viewport: HTMLElement,
    at: Point,
    behavior?: ScrollBehavior,
  ): void {
    const scale = viewport.scrollWidth / this.mapWidth;
    viewport.scrollTo({
      left: at.x * scale - viewport.clientWidth / 2,
      top: at.y * scale - viewport.clientHeight / 2,
      // Smooth panning fights a walk that is already animating frame by frame,
      // and reduced motion should not pan at all.
      behavior:
        behavior ??
        (this.prefersReducedMotion() || this.moving() ? 'auto' : 'smooth'),
    });
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  go(event: Event, href: string): void {
    const mouse = event as MouseEvent;
    if (mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.button > 0) return;
    event.preventDefault();
    this.audio.play('tap');
    this.router.navigateTo(href, { clearUrlParams: true });
  }

  toggleSounds(): void {
    this.audio.toggleSounds();
  }

  /** Opens the pack's settings so a closed spot can be switched back on. */
  openSettings(event: Event, view: SpotView): void {
    const href = this.router.hrefForView(Views.Play, { packId: view.ref.pack.id });
    this.go(event, withParam(href, 'setup', '1'));
  }

  hasBadge(view: SpotView, id: BadgeId): boolean {
    return view.badges.includes(id);
  }
}
