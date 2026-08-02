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
import { QuizSession, QuizSnapshot } from '../../quiz/quiz-session';
import { SpriteCharacter } from '../../components/sprite-character/sprite-character';
import { ConfettiBurst } from '../../components/confetti-burst/confetti-burst';

/** How long the result stays on screen before the next question. */
const REVEAL_MS = { correct: 1500, wrong: 2600 };

@Component({
  selector: 'app-play-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpriteCharacter, ConfettiBurst],
  templateUrl: './play.page.html',
  styleUrl: './play.page.scss',
})
export class PlayPage {
  private readonly router: RoutingService<AppPathPatterns> =
    inject(RoutingService<AppPathPatterns>);
  private readonly audio = inject(AudioService);
  private readonly progress = inject(ProgressService);
  private readonly media = inject(MediaService);

  readonly character = this.media.character;

  private readonly routeSignals = this.router.signals[Views.Play];
  readonly packId = this.routeSignals.pathVars.packId;
  private readonly levelParam = this.routeSignals.urlParams.level;

  readonly pack = computed(() => findPack(this.packId()));
  readonly level = computed(() => {
    const pack = this.pack();
    const parsed = Number.parseInt(this.levelParam(), 10);
    const requested = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    return pack ? Math.min(requested, pack.levels.length) : 1;
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

  readonly stars = this.progress.stars;

  private timer: ReturnType<typeof setTimeout> | null = null;

  readonly homeHref = computed(() => this.router.hrefForView(Views.Home));
  readonly prizesHref = computed(() => this.router.hrefForView(Views.Prizes));

  readonly accentColour = computed(() => this.pack()?.colour ?? 'var(--brand)');

  readonly canLevelUp = computed(() => {
    const pack = this.pack();
    return !!pack && this.level() < pack.levels.length;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearTimer());

    // Start (or restart) a round whenever the pack or level changes.
    effect(() => {
      const pack = this.pack();
      const level = this.level();
      untracked(() => {
        this.clearTimer();
        this.session.set(pack ? new QuizSession(pack, level) : null);
        this.revision.update((n) => n + 1);
        this.resetFeedback();
      });
    });
  }

  private resetFeedback(): void {
    this.animation.set('idle');
    this.lastWasCorrect.set(null);
    this.starsJustWon.set(0);
    this.newPrizes.set([]);
  }

  answer(index: number): void {
    const session = this.session();
    const pack = this.pack();
    if (!session || !pack) return;

    const result = session.answer(index);
    // Null means the tap was ignored (already answered, or round over).
    if (!result) return;
    this.revision.update((n) => n + 1);

    const outcome = this.progress.recordAnswer({
      packId: pack.id,
      wasCorrect: result.wasCorrect,
      streak: result.streak,
      level: this.level(),
    });

    this.lastWasCorrect.set(result.wasCorrect);
    this.starsJustWon.set(outcome.starsAwarded);
    this.newPrizes.set(outcome.newPrizes);

    if (result.wasCorrect) {
      this.animation.set('correct');
      this.audio.play(outcome.newPrizes.length > 0 ? 'prize' : 'correct');
      this.confettiTrigger.update((n) => n + 1);
    } else {
      this.animation.set('wrong');
      this.audio.play('wrong');
    }

    // A wrong answer lingers longer so there is time to read the explanation.
    this.timer = setTimeout(
      () => this.next(),
      result.wasCorrect ? REVEAL_MS.correct : REVEAL_MS.wrong,
    );
  }

  /** Skips the reveal delay when she taps "next" herself. */
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
    this.clearTimer();
    this.session.set(new QuizSession(pack, this.level()));
    this.revision.update((n) => n + 1);
    this.resetFeedback();
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
