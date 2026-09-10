import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AppPathPatterns, Views } from '../../app.config';
import { RoutingService } from '../../routing/routing.service';
import { ProgressService } from '../../core/progress.service';
import { PRIZE_SETS, prizesInSet } from '../../core/prizes';
import { BADGES, BadgeId } from '../../core/mastery';
import { MasteryService } from '../../core/mastery.service';
import { MediaService } from '../../media/media.service';
import { QUESTION_PACKS } from '../../quiz/pack-registry';
import { challengesFor } from '../../quiz/challenges';
import { SpriteCharacter } from '../../components/sprite-character/sprite-character';

@Component({
  selector: 'app-prizes-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpriteCharacter],
  templateUrl: './prizes.page.html',
  styleUrl: './prizes.page.scss',
})
export class PrizesPage {
  private readonly router: RoutingService<AppPathPatterns> =
    inject(RoutingService<AppPathPatterns>);
  private readonly progress = inject(ProgressService);
  private readonly mastery = inject(MasteryService);
  private readonly media = inject(MediaService);

  readonly character = this.media.character;
  readonly badges = BADGES;
  readonly mapHref = computed(() => this.router.hrefForView(Views.Map));
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

  /**
   * The badges won out on the map, grouped by game. Shown next to the stickers
   * because they are the other half of the collection — stickers come from
   * playing a lot, badges come from knowing one thing right through.
   */
  readonly masteryGroups = computed(() => {
    this.mastery.all();
    return QUESTION_PACKS.map((pack) => {
      const places = challengesFor(pack.id).map((ref) => ({
        id: ref.challenge.id,
        short: ref.challenge.short,
        name: ref.challenge.name,
        badges: this.mastery.badgesForChallenge(ref.challenge.id),
      }));
      return {
        pack,
        places,
        owned: places.reduce((sum, place) => sum + place.badges.length, 0),
        total: places.length * BADGES.length,
      };
    });
  });

  readonly badgeCount = this.mastery.badgeCount;
  readonly totalBadges = computed(() =>
    this.masteryGroups().reduce((sum, group) => sum + group.total, 0),
  );

  hasBadge(badges: BadgeId[], id: BadgeId): boolean {
    return badges.includes(id);
  }

  go(event: Event, href: string): void {
    const mouse = event as MouseEvent;
    if (mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.button > 0) return;
    event.preventDefault();
    this.router.navigateTo(href, { clearUrlParams: true });
  }
}
