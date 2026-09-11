import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { AppPathPatterns, Views } from '../../app.config';
import { RoutingService } from '../../routing/routing.service';
import { withParam } from '../../routing/routing.utils';
import { AudioService } from '../../core/audio.service';
import { Rng } from '../../core/rng';
import { ProgressService } from '../../core/progress.service';
import { Prize } from '../../core/prizes';
import { Badge, badgesFor } from '../../core/mastery';
import { MasteryService } from '../../core/mastery.service';
import { MediaService } from '../../media/media.service';
import { AnimationName } from '../../media/media.types';
import { findPack } from '../../quiz/pack-registry';
import { ChallengeRef, findChallenge, isChallengeAvailable } from '../../quiz/challenges';
import { QuestionPack } from '../../quiz/question.types';
import { PackOptionsService } from '../../quiz/pack-options.service';
import { buildMapLayout, regionForRound } from '../../explore/map-layout';
import { cssUrl, svgDataUrl, terrainTileSvg } from '../../explore/map-art';
import { QuizSession, QuizSnapshot } from '../../quiz/quiz-session';
import { SpriteCharacter } from '../../components/sprite-character/sprite-character';
import { ConfettiBurst } from '../../components/confetti-burst/confetti-burst';
import { PrizeBackdrop } from '../../components/prize-backdrop/prize-backdrop';
import { GameSetup } from '../../components/game-setup/game-setup';

/**
 * How long the result stays on screen before moving on. A wrong answer lingers
 * because there is an explanation to read before the question comes back.
 */
const REVEAL_MS = { correct: 1500, wrong: 3200 };

@Component({
  selector: 'app-play-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpriteCharacter, ConfettiBurst, PrizeBackdrop, GameSetup],
  templateUrl: './play.page.html',
  styleUrl: './play.page.scss',
})
export class PlayPage {
  private readonly router: RoutingService<AppPathPatterns> =
    inject(RoutingService<AppPathPatterns>);
  private readonly audio = inject(AudioService);
  private readonly progress = inject(ProgressService);
  private readonly mastery = inject(MasteryService);
  private readonly media = inject(MediaService);
  private readonly packOptions = inject(PackOptionsService);

  readonly character = this.media.character;
  readonly characterName = computed(() => this.character().name);

  /**
   * The drawing for this question, when the media pack has one. Spelling asks
   * "how do you write this?", so the picture *is* the question; without one the
   * emoji stands in.
   */
  readonly questionPicture = computed(() => {
    const id = this.snapshot()?.question.picture;
    return id ? (this.media.picture(id) ?? null) : null;
  });

  private readonly routeSignals = this.router.signals[Views.Play];
  readonly packId = this.routeSignals.pathVars.packId;
  private readonly levelParam = this.routeSignals.urlParams.level;
  private readonly setupParam = this.routeSignals.urlParams.setup;
  private readonly challengeParam = this.routeSignals.urlParams.challenge;

  readonly showSetup = computed(() => this.setupParam() === '1');

  readonly pack = computed(() => findPack(this.packId()));

  /**
   * The challenge being played, if any. A challenge whose category has since
   * been switched off is dropped rather than played anyway — the same rule that
   * closes its place on the map — and the round falls back to a normal one.
   */
  readonly challengeRef = computed<ChallengeRef | null>(() => {
    const id = this.challengeParam();
    if (!id) return null;
    const ref = findChallenge(id);
    if (!ref || ref.pack.id !== this.packId()) return null;
    return isChallengeAvailable(ref, this.packOptions.selectionFor(ref.pack))
      ? ref
      : null;
  });

  readonly challenge = computed(() => this.challengeRef()?.challenge ?? null);

  /** Badges won by the round that just finished. */
  readonly badgesJustWon = signal<Badge[]>([]);

  /**
   * Nudge towards the badge still to come. Only shown after a perfect round
   * that earned the gold star but not yet the crown — "do it again" is a real
   * invitation at that moment, and nagging at any other time is not.
   */
  readonly nextBadgeHint = computed(() => {
    const challenge = this.challenge();
    if (!challenge) return '';
    const record = this.mastery.recordFor(challenge.id);
    if (badgesFor(record).includes('mastered')) return '';
    return record.currentPerfectStreak === 1
      ? 'Do that once more and the crown is yours! 👑'
      : '';
  });

  /** The level asked for in the URL, clamped to the pack's range. */
  private readonly requestedLevel = computed(() => {
    const pack = this.pack();
    const parsed = Number.parseInt(this.levelParam(), 10);
    const requested = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    return pack ? Math.min(requested, pack.levels.length) : 1;
  });

  /**
   * The level actually played. A category can be switched off entirely, which
   * takes the levels that depend on it out of play — so the requested level may
   * not be available, and we fall back to the nearest one that is.
   */
  readonly level = computed(() => {
    const pack = this.pack();
    if (!pack) return 1;
    return this.packOptions.resolveLevel(pack, this.requestedLevel()) ?? 1;
  });

  /**
   * True when every level has been switched off for this pack. A challenge
   * carries its own questions, so it is playable regardless of the levels.
   */
  readonly nothingPlayable = computed(() => {
    if (this.challengeRef()) return false;
    const pack = this.pack();
    return !!pack && this.packOptions.availableLevelsFor(pack).length === 0;
  });
  readonly levelName = computed(
    () => this.pack()?.levels[this.level() - 1]?.name ?? '',
  );

  private readonly session = signal<QuizSession | null>(null);
  /** Bumped on every session mutation so the template re-reads the snapshot. */
  private readonly revision = signal(0);

  readonly snapshot = computed<QuizSnapshot | null>(() => {
    this.revision();
    return this.session()?.snapshot() ?? null;
  });

  readonly animation = signal<AnimationName>('idle');
  readonly confettiTrigger = signal(0);
  readonly lastWasCorrect = signal<boolean | null>(null);
  readonly starsJustWon = signal(0);
  readonly newPrizes = signal<Prize[]>([]);
  /** True when the reveal is showing after a corrected retry, not a first go. */
  readonly wasRetry = signal(false);

  readonly stars = this.progress.stars;
  readonly collectedPrizes = this.progress.unlockedPrizes;

  /**
   * Prizes won during this round, kept for the whole round so the backdrop
   * keeps them highlighted rather than dimming them a second later.
   */
  readonly prizesWonThisRound = signal<string[]>([]);

  private timer: ReturnType<typeof setTimeout> | null = null;

  readonly homeHref = computed(() => this.router.hrefForView(Views.Home));
  readonly prizesHref = computed(() => this.router.hrefForView(Views.Prizes));

  private readonly layout = buildMapLayout();

  /**
   * The part of the map this round belongs to. The question is asked on that
   * region's own ground, so a round of the 7× table happens in the hills and a
   * French round in the village — the map and the game stay one place rather
   * than a map and then a separate quiz screen.
   */
  readonly region = computed(() => {
    const pack = this.pack();
    if (!pack) return null;
    return (
      regionForRound(this.layout, {
        packId: pack.id,
        level: this.level(),
        challengeId: this.challenge()?.id,
      }) ?? null
    );
  });

  /** That region's ground tile — generated if the pack has one, else drawn. */
  readonly groundUrl = computed(() => {
    const region = this.region();
    if (!region) return null;
    return cssUrl(
      this.media.mapTile(region.terrain) ?? svgDataUrl(terrainTileSvg(region.terrain)),
    );
  });

  /** Back to where she was standing, rather than to the top of the map. */
  readonly mapHref = computed(() => {
    const href = this.router.hrefForView(Views.Map);
    const challenge = this.challenge();
    return challenge ? withParam(href, 'at', challenge.id) : href;
  });

  readonly accentColour = computed(() => this.pack()?.colour ?? 'var(--brand)');

  /** Only offer the next level up if it is actually switched on. */
  readonly canLevelUp = computed(() => {
    const pack = this.pack();
    // A challenge is a set of questions, not a rung on the ladder — there is no
    // "next level" of the 7× table.
    if (!pack || this.challengeRef()) return false;
    const next = this.level() + 1;
    return next <= pack.levels.length && this.packOptions.isLevelPlayable(pack, next);
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearTimer());

    // Start (or restart) a round whenever the pack, the level or the chosen
    // content changes. The selection is tracked via a string key because the
    // object itself is rebuilt on every read, which would re-fire constantly.
    effect(() => {
      const pack = this.pack();
      const level = this.level();
      const playable = !this.nothingPlayable();
      this.challengeRef();
      this.packOptions.selectionKeyFor(pack);
      untracked(() => this.startRound(playable ? pack : undefined, level));
    });
  }

  private startRound(pack: QuestionPack | undefined, level: number): void {
    this.clearTimer();
    // A challenge deals its own complete set of questions; the deck is drawn
    // fresh each round so the order changes but the content cannot.
    const challenge = this.challenge();
    this.session.set(
      pack
        ? new QuizSession(
            pack,
            level,
            undefined,
            undefined,
            this.packOptions.selectionFor(pack),
            challenge?.deck(new Rng()),
          )
        : null,
    );
    this.revision.update((n) => n + 1);
    this.resetFeedback();
    this.prizesWonThisRound.set([]);
    this.badgesJustWon.set([]);
  }

  openSetup(): void {
    this.audio.play('tap');
    this.setupParam.set('1');
  }

  closeSetup(): void {
    this.setupParam.set('');
  }

  /** Chosen from the setup panel; the effect above restarts the round. */
  setLevel(level: number): void {
    this.levelParam.set(String(level));
  }

  private resetFeedback(): void {
    this.animation.set('idle');
    this.lastWasCorrect.set(null);
    this.starsJustWon.set(0);
    this.newPrizes.set([]);
    this.wasRetry.set(false);
  }

  answer(index: number): void {
    const session = this.session();
    const pack = this.pack();
    if (!session || !pack) return;

    const result = session.answer(index);
    // Null means the tap was ignored (already answered, or round over).
    if (!result) return;
    this.revision.update((n) => n + 1);

    this.lastWasCorrect.set(result.wasCorrect);
    this.wasRetry.set(!result.isFirstAttempt);

    // A retry earns nothing and is not recorded — the first attempt already
    // told us whether she knew it, and this go is for learning the answer.
    if (result.isFirstAttempt) {
      const outcome = this.progress.recordAnswer({
        packId: pack.id,
        wasCorrect: result.wasCorrect,
        streak: result.streak,
        level: this.level(),
        // So a prize won here can be left on the map where it was won.
        place: this.challenge()?.id,
      });
      this.starsJustWon.set(outcome.starsAwarded);
      this.newPrizes.set(outcome.newPrizes);
      if (outcome.newPrizes.length > 0) {
        this.prizesWonThisRound.update((ids) => [
          ...ids,
          ...outcome.newPrizes.map((prize) => prize.id),
        ]);
      }
    } else {
      this.starsJustWon.set(0);
      this.newPrizes.set([]);
    }

    if (result.wasCorrect) {
      this.animation.set('correct');
      this.audio.play(this.newPrizes().length > 0 ? 'prize' : 'correct');
      // No confetti for a corrected answer — that celebration belongs to
      // getting it right first time.
      if (result.isFirstAttempt) this.confettiTrigger.update((n) => n + 1);
    } else {
      this.animation.set('wrong');
      this.audio.play('wrong');
    }

    this.timer = setTimeout(
      () => this.next(),
      result.wasCorrect ? REVEAL_MS.correct : REVEAL_MS.wrong,
    );
  }

  /**
   * Leaves the reveal early when she taps the button rather than waiting.
   * After a wrong answer this puts the same question back up.
   */
  next(): void {
    this.clearTimer();
    const session = this.session();
    if (!session) return;

    session.advance();
    this.revision.update((n) => n + 1);
    this.resetFeedback();

    if (session.isFinished) {
      this.animation.set('celebrate');
      this.finishChallenge(session);
      this.audio.play(this.badgesJustWon().length > 0 ? 'prize' : 'finish');
      this.confettiTrigger.update((n) => n + 1);
    }
  }

  /**
   * Records a finished challenge round. `correctCount` is first attempts only,
   * so a question that had to be corrected keeps the round off perfect — which
   * is the whole point of the badge.
   */
  private finishChallenge(session: QuizSession): void {
    const challenge = this.challenge();
    if (!challenge) return;
    this.badgesJustWon.set(
      this.mastery.recordChallengeRound({
        challengeId: challenge.id,
        correct: session.correctCount,
        total: session.totalQuestions,
      }),
    );
  }

  playAgain(): void {
    const pack = this.pack();
    if (!pack) return;
    this.startRound(pack, this.level());
    this.audio.play('tap');
  }

  nextLevel(): void {
    if (!this.canLevelUp()) return;
    this.audio.play('levelUp');
    // Writing the URL param restarts the round through the effect above.
    this.levelParam.set(String(this.level() + 1));
  }

  go(event: Event, href: string): void {
    const mouse = event as MouseEvent;
    if (mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.button > 0) return;
    event.preventDefault();
    this.audio.play('tap');
    this.router.navigateTo(href, { clearUrlParams: true });
  }

  /** Visual state for one answer button once the answer is revealed. */
  choiceState(index: number): 'idle' | 'right' | 'wrong' | 'dimmed' {
    const snapshot = this.snapshot();
    if (!snapshot || snapshot.phase === 'asking') return 'idle';
    if (index === snapshot.question.correctIndex) return 'right';
    if (index === snapshot.chosenIndex) return 'wrong';
    return 'dimmed';
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
