import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AppPathPatterns, Views } from '../../app.config';
import { RoutingService } from '../../routing/routing.service';
import { ProgressService } from '../../core/progress.service';
import { PRIZE_SETS, PRIZES, prizesInSet } from '../../core/prizes';
import { buildMapLayout } from '../../explore/map-layout';
import { CROSSROADS, describeBook } from '../../explore/sticker-books';
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

  private readonly layout = buildMapLayout();

  /**
   * Every game's own sticker book, grouped by area: how full each is and how
   * near its next sticker. Every spot on the map is shown, played or not, so
   * it is obvious that a new game starts paying out from the first sticker.
   * Books from ordinary rounds (one per game level) join their area once
   * something has been earned in them.
   */
  readonly areas = computed(() => {
    const books = this.progress.books();
    const view = (key: string) => {
      const info = describeBook(this.layout, key);
      const next = this.progress.nextPrizeIn(key);
      return {
        ...info,
        owned: this.progress.prizesIn(key).length,
        next,
        starsToGo: next ? Math.max(0, next.starsRequired - this.progress.starsIn(key)) : 0,
        progressPercent: Math.round(this.progress.progressToNextPrizeIn(key) * 100),
      };
    };
    const groups = this.layout.regions.map((region) => {
      const spotKeys = this.layout.spots
        .filter((spot) => spot.regionId === region.id)
        .map((spot) => spot.challengeId);
      const otherKeys = Object.keys(books)
        .filter((key) => books[key].area === region.id && !spotKeys.includes(key))
        .sort();
      const shelf = [...spotKeys, ...otherKeys].map(view);
      return {
        id: region.id,
        name: region.name,
        emoji: region.emoji,
        books: shelf,
        owned: shelf.reduce((sum, book) => sum + book.owned, 0),
      };
    });
    const known = new Set(this.layout.regions.map((region) => region.id));
    const stray = Object.keys(books)
      .filter((key) => !known.has(books[key].area))
      .map(view);
    if (stray.length > 0) {
      groups.push({
        id: CROSSROADS,
        name: 'The crossroads',
        emoji: '🧭',
        books: stray,
        owned: stray.reduce((sum, book) => sum + book.owned, 0),
      });
    }
    return groups;
  });

  /** Stickers each game can collect. */
  readonly perBook = PRIZES.length;

  /** The game the next sticker is in, if it is one particular game. */
  readonly nextPrizeBook = computed(() => {
    const book = this.nextPrize().book;
    return book ? describeBook(this.layout, book) : null;
  });

  /**
   * The whole catalogue, counting how many games hold each sticker. Every
   * game can win one of each, so a sticker can be owned many times.
   * Stickers not won anywhere yet are shown as silhouettes with their star
   * cost rather than hidden — seeing what is coming is most of the motivation.
   */
  readonly collections = computed(() => {
    const counts = this.progress.prizeCounts();
    const bookKeys = Object.keys(this.progress.books());
    return PRIZE_SETS.map((set) => {
      const prizes = prizesInSet(set.id).map((prize) => {
        const count = counts.get(prize.id) ?? 0;
        return { ...prize, count, unlocked: count > 0 };
      });
      const owned = prizes.filter((p) => p.unlocked).length;
      // A trophy for every game that has finished this set.
      const trophies = bookKeys.filter((book) =>
        this.progress.completedSetsIn(book).some((done) => done.id === set.id),
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
