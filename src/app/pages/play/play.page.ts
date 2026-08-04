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
import { AudioService } from '../../core/audio.service';
import { ProgressService } from '../../core/progress.service';
import { Prize } from '../../core/prizes';
import { MediaService } from '../../media/media.service';
import { AnimationName } from '../../media/media.types';
import { findPack } from '../../quiz/pack-registry';
import { QuestionPack } from '../../quiz/question.types';
import { PackOptionsService } from '../../quiz/pack-options.service';
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
  private readonly media = inject(MediaService);
  private readonly packOptions = inject(PackOptionsService);

  readonly character = this.media.character;

  private readonly routeSignals = this.router.signals[Views.Play];
  readonly packId = this.routeSignals.pathVars.packId;
  private readonly levelParam = this.routeSignals.urlParams.level;
  private readonly setupParam = this.routeSignals.urlParams.setup;

  readonly showSetup = computed(() => this.setupParam() === '1');

  readonly pack = computed(() => findPack(this.packId()));

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

  /** True when every level has been switched off for this pack. */
  readonly nothingPlayable = computed(() => {
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

  readonly accentColour = computed(() => this.pack()?.colour ?? 'var(--brand)');

  /** Only offer the next level up if it is actually switched on. */
  readonly canLevelUp = computed(() => {
    const pack = this.pack();
    if (!pack) return false;
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
      this.packOptions.selectionKeyFor(pack);
      untracked(() => this.startRound(playable ? pack : undefined, level));
    });
  }

  private startRound(pack: QuestionPack | undefined, level: number): void {
    this.clearTimer();
    this.session.set(
      pack
        ? new QuizSession(
            pack,
            level,
            undefined,
            undefined,
            this.packOptions.selectionFor(pack),
          )
        : null,
    );
    this.revision.update((n) => n + 1);
    this.resetFeedback();
    this.prizesWonThisRound.set([]);
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
      this.audio.play('finish');
      this.confettiTrigger.update((n) => n + 1);
    }
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
