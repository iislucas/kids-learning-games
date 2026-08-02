import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AppPathPatterns, Views } from '../../app.config';
import { RoutingService } from '../../routing/routing.service';
import { AudioService } from '../../core/audio.service';
import { ProgressService } from '../../core/progress.service';
import { MediaService } from '../../media/media.service';
import { QUESTION_PACKS } from '../../quiz/pack-registry';
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
  private readonly media = inject(MediaService);

  readonly character = this.media.character;
  readonly packs = QUESTION_PACKS;
  readonly stars = this.progress.stars;
  readonly dayStreak = this.progress.dayStreak;
  readonly nextPrize = this.progress.nextPrize;
  readonly progressToNextPrize = this.progress.progressToNextPrize;

  readonly prizesHref = computed(() => this.router.hrefForView(Views.Prizes));

  /** Cards show where she got to, so picking up again feels continuous. */
  readonly cards = computed(() =>
    this.packs.map((pack) => {
      const stats = this.progress.statsFor(pack.id);
      const level = Math.min(stats.bestLevel, pack.levels.length);
      return {
        pack,
        level,
        levelName: pack.levels[level - 1]?.name ?? pack.levels[0].name,
        answered: stats.answered,
        href: this.router.hrefForView(Views.Play, { packId: pack.id }),
      };
    }),
  );

  readonly progressPercent = computed(() =>
    Math.round(this.progressToNextPrize() * 100),
  );

  readonly starsToNextPrize = computed(() => {
    const next = this.nextPrize();
    return next ? Math.max(0, next.starsRequired - this.stars()) : 0;
  });

  go(event: Event, href: string, level?: number): void {
    const mouse = event as MouseEvent;
    if (mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.button > 0) return;
    event.preventDefault();
    this.audio.play('tap');
    const target = level && level > 1 ? `${href}?level=${level}` : href;
    this.router.navigateTo(target, { clearUrlParams: true });
  }
}
