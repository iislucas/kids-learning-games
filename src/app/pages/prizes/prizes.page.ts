import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AppPathPatterns, Views } from '../../app.config';
import { RoutingService } from '../../routing/routing.service';
import { ProgressService } from '../../core/progress.service';
import { PRIZE_SETS, PRIZES, prizesInSet } from '../../core/prizes';
import { buildMapLayout } from '../../explore/map-layout';
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
  readonly nextPrize = this.progress.nearestNextPrize;
  readonly bestStreak = this.progress.bestStreak;
  readonly dayStreak = this.progress.dayStreak;

  /** Stickers held across every place, counting repeats. */
  readonly collectedCount = this.progress.prizeTotal;

  readonly accuracyPercent = computed(() =>
    Math.round(this.progress.accuracy() * 100),
  );

  private readonly regions = buildMapLayout().regions;

  /**
   * Every place on the map with its own sticker book: how full it is and what
   * it is working towards. Places not played yet are shown too, so it is
   * obvious that a new place starts paying out from the first sticker.
   */
  readonly areas = computed(() => {
    this.progress.areas();
    return this.regions.map((region) => {
      const owned = this.progress.prizesIn(region.id).length;
      const next = this.progress.nextPrizeIn(region.id);
      return {
        region,
        owned,
        next,
        starsToGo: next
          ? Math.max(0, next.starsRequired - this.progress.areaStars(region.id))
          : 0,
        progressPercent: Math.round(this.progress.progressToNextPrizeIn(region.id) * 100),
      };
    });
  });

  /** Stickers each place can collect. */
  readonly perPlace = PRIZES.length;

  /** Name of the place the next sticker is in, if it is one particular place. */
  readonly nextPrizeArea = computed(() => {
    const area = this.nextPrize()?.area;
    return this.regions.find((region) => region.id === area) ?? null;
  });

  /**
   * The whole catalogue, counting how many places hold each sticker. Every
   * place can win one of each, so a sticker can be owned several times.
   * Stickers not won anywhere yet are shown as silhouettes with their star
   * cost rather than hidden — seeing what is coming is most of the motivation.
   */
  readonly collections = computed(() => {
    const counts = this.progress.prizeCounts();
    const areaIds = Object.keys(this.progress.areas());
    return PRIZE_SETS.map((set) => {
      const prizes = prizesInSet(set.id).map((prize) => {
        const count = counts.get(prize.id) ?? 0;
        return { ...prize, count, unlocked: count > 0 };
      });
      const owned = prizes.filter((p) => p.unlocked).length;
      // A trophy for every place that has finished this set.
      const trophies = areaIds.filter((area) =>
        this.progress.completedSetsIn(area).some((done) => done.id === set.id),
      ).length;
      return { set, prizes, owned, total: prizes.length, trophies };
    });
  });

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
