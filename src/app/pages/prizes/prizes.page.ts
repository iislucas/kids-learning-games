import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ProgressService } from '../../core/progress.service';
import { PRIZE_SETS, prizesInSet } from '../../core/prizes';
import { MediaService } from '../../media/media.service';
import { SpriteCharacter } from '../../components/sprite-character/sprite-character';

@Component({
  selector: 'app-prizes-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpriteCharacter],
  templateUrl: './prizes.page.html',
  styleUrl: './prizes.page.scss',
})
export class PrizesPage {
  private readonly progress = inject(ProgressService);
  private readonly media = inject(MediaService);

  readonly character = this.media.character;
  readonly stars = this.progress.stars;
  readonly nextPrize = this.progress.nextPrize;
  readonly bestStreak = this.progress.bestStreak;
  readonly dayStreak = this.progress.dayStreak;

  readonly collectedCount = computed(() => this.progress.unlockedPrizes().length);

  readonly accuracyPercent = computed(() =>
    Math.round(this.progress.accuracy() * 100),
  );

  /**
   * Locked prizes are shown as silhouettes with their star cost rather than
   * hidden — seeing what is coming is most of the motivation.
   */
  readonly collections = computed(() => {
    const unlocked = this.progress.unlockedPrizeIds();
    return PRIZE_SETS.map((set) => {
      const prizes = prizesInSet(set.id).map((prize) => ({
        ...prize,
        unlocked: unlocked.has(prize.id),
      }));
      const owned = prizes.filter((p) => p.unlocked).length;
      return {
        set,
        prizes,
        owned,
        total: prizes.length,
        complete: owned === prizes.length,
      };
    });
  });

  readonly totalPrizes = computed(() =>
    this.collections().reduce((sum, c) => sum + c.total, 0),
  );
}
