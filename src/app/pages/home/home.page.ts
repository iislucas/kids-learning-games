import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AppPathPatterns, Views } from '../../app.config';
import { RoutingService } from '../../routing/routing.service';
import { withParam } from '../../routing/routing.utils';
import { AudioService } from '../../core/audio.service';
import { ProgressService } from '../../core/progress.service';
import { BADGES } from '../../core/mastery';
import { MasteryService } from '../../core/mastery.service';
import { MediaService } from '../../media/media.service';
import { QUESTION_PACKS } from '../../quiz/pack-registry';
import { PackOptionsService } from '../../quiz/pack-options.service';
import { ALL_CHALLENGES } from '../../quiz/challenges';
import { buildMapLayout } from '../../explore/map-layout';
import { describeBook } from '../../explore/sticker-books';
import { SpriteCharacter } from '../../components/sprite-character/sprite-character';

@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpriteCharacter],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  private readonly router: RoutingService<AppPathPatterns> =
    inject(RoutingService<AppPathPatterns>);
  private readonly audio = inject(AudioService);
  private readonly progress = inject(ProgressService);
  private readonly mastery = inject(MasteryService);
  private readonly media = inject(MediaService);
  private readonly packOptions = inject(PackOptionsService);

  readonly character = this.media.character;
  readonly packs = QUESTION_PACKS;
  readonly stars = this.progress.stars;
  readonly dayStreak = this.progress.dayStreak;
  /** The sticker closest to landing, in whichever area it is closest. */
  readonly nextPrize = this.progress.nearestNextPrize;
  private readonly layout = buildMapLayout();

  /** The game that sticker is in, or null when any game will pay it. */
  readonly nextPrizeBook = computed(() => {
    const book = this.nextPrize().book;
    return book ? describeBook(this.layout, book) : null;
  });

  readonly prizesHref = computed(() => this.router.hrefForView(Views.Prizes));
  readonly mapHref = computed(() => this.router.hrefForView(Views.Map));

  readonly badgeCount = this.mastery.badgeCount;
  readonly totalBadges = ALL_CHALLENGES.length * BADGES.length;

  /** Cards show where she got to, so picking up again feels continuous. */
  readonly cards = computed(() =>
    this.packs.map((pack) => {
      const stats = this.progress.statsFor(pack.id);
      const level = Math.min(stats.bestLevel, pack.levels.length);
      const href = this.router.hrefForView(Views.Play, { packId: pack.id });
      return {
        pack,
        level,
        levelName: pack.levels[level - 1]?.name ?? pack.levels[0].name,
        answered: stats.answered,
        customised: this.packOptions.isCustomised(pack),
        href,
        setupHref: withParam(href, 'setup', '1'),
      };
    }),
  );

  readonly progressPercent = computed(() =>
    Math.round(this.nextPrize().progress * 100),
  );

  go(event: Event, href: string, level?: number): void {
    const mouse = event as MouseEvent;
    if (mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.button > 0) return;
    event.preventDefault();
    this.audio.play('tap');
    const target = level && level > 1 ? `${href}?level=${level}` : href;
    this.router.navigateTo(target, { clearUrlParams: true });
  }
}
