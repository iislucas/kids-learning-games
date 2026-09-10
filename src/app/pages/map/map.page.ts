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
import { AudioService } from '../../core/audio.service';
import { BADGES, BadgeId } from '../../core/mastery';
import { MasteryService } from '../../core/mastery.service';
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
import { mapSvg } from '../../explore/map-art';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  MapSpot,
  buildMapLayout,
  spotAt,
  spotFor,
} from '../../explore/map-layout';

/** Arrow keys and WASD, mapped onto the eight facings. */
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

/** One press of a key or the pad moves her this far. */
const NUDGE = 120;

interface SpotView {
  spot: MapSpot;
  ref: ChallengeRef;
  badges: BadgeId[];
  available: boolean;
  /** Why it is shut, when it is. */
  closedBecause: string | null;
  playHref: string;
}

/**
 * The landscape she walks around.
 *
 * The map is the collection screen and the menu at the same time: every place
 * on it is one complete set of questions, and the badges she has won are shown
 * where she won them. That is a far better answer to "what shall I do now?"
 * than a list of four cards, because it shows what is left as well as what is
 * done.
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

  // Deliberately not `required`: the effect below reads it to know when the
  // view has been created, and a required query throws rather than returning
  // undefined while it is still unresolved.
  private readonly viewport = viewChild<ElementRef<HTMLElement>>('viewport');

  /**
   * The landscape. A painting generated in the media studio if there is one,
   * otherwise the one drawn from the layout — which is what a fresh install
   * with no API keys gets, and it is a perfectly good map.
   */
  readonly background = computed(() => {
    const painted = this.media.pack().map?.src;
    if (painted) return `url("${painted}")`;
    return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(mapSvg(this.layout))}")`;
  });

  readonly position = signal<Point>(this.startingPoint());
  readonly facing = signal<Direction>('s');
  readonly moving = signal(false);
  private target: Point | null = null;
  private frame: number | null = null;
  private lastFrameAt = 0;

  /** Every place on the map, with what has been won there. */
  readonly spots = computed<SpotView[]>(() => {
    this.mastery.all();
    return this.layout.spots.flatMap((spot) => {
      const ref = findChallenge(spot.challengeId);
      if (!ref) return [];
      const selection = this.packOptions.selectionFor(ref.pack);
      const available = isChallengeAvailable(ref, selection);
      const href = this.router.hrefForView(Views.Play, { packId: ref.pack.id });
      return [
        {
          spot,
          ref,
          badges: this.mastery.badgesForChallenge(spot.challengeId),
          available,
          closedBecause: available ? null : this.closedReason(ref),
          playHref: `${href}?challenge=${encodeURIComponent(spot.challengeId)}`,
        },
      ];
    });
  });

  /** The signpost card that is open, if any. */
  readonly openSpot = computed<SpotView | null>(
    () => this.spots().find((view) => view.spot.challengeId === this.openParam()) ?? null,
  );

  readonly openRecord = computed(() => {
    const open = this.openSpot();
    return open ? this.mastery.recordFor(open.spot.challengeId) : null;
  });

  readonly homeHref = computed(() => this.router.hrefForView(Views.Home));

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

  /** Where she starts: the spot she was last on, or the crossroads. */
  private startingPoint(): Point {
    const spot = this.atParam() ? spotFor(this.layout, this.atParam()) : undefined;
    return spot ? { x: spot.x, y: spot.y } : { ...this.layout.start };
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

  /** Taps on open ground. The click coordinate is in map space already. */
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
    this.nudge(direction);
  }

  /** The on-screen pad, and the arrow keys. */
  nudge(direction: Direction): void {
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
    const spot = spotAt(this.layout, at.x, at.y);
    if (!spot) {
      this.atParam.set('');
      return;
    }
    this.audio.play('tap');
    this.atParam.set(spot.challengeId);
    this.openParam.set(spot.challengeId);
  }

  /** Tapping a signpost walks her over to it, which then opens it. */
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

  /** Opens the pack's settings so a closed spot can be switched back on. */
  openSettings(event: Event, view: SpotView): void {
    const href = this.router.hrefForView(Views.Play, { packId: view.ref.pack.id });
    this.go(event, `${href}?setup=1`);
  }

  hasBadge(view: SpotView, id: BadgeId): boolean {
    return view.badges.includes(id);
  }
}
