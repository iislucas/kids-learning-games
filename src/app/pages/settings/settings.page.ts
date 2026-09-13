import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AppPathPatterns, Views } from '../../app.config';
import { RoutingService } from '../../routing/routing.service';
import { AudioService } from '../../core/audio.service';
import { eraseForFreshStart } from '../../core/fresh-start';
import { ProgressService } from '../../core/progress.service';
import { MediaService } from '../../media/media.service';
import { SpriteCharacter } from '../../components/sprite-character/sprite-character';
import { QUESTION_PACKS } from '../../quiz/pack-registry';

@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpriteCharacter],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
})
export class SettingsPage {
  private readonly router: RoutingService<AppPathPatterns> =
    inject(RoutingService<AppPathPatterns>);
  private readonly audio = inject(AudioService);
  private readonly progress = inject(ProgressService);
  private readonly media = inject(MediaService);

  readonly soundsEnabled = this.audio.soundsEnabled;
  readonly musicEnabled = this.audio.musicEnabled;
  readonly isCustomised = this.media.isCustomised;
  readonly stars = this.progress.stars;
  readonly answered = this.progress.answered;

  readonly confirmingReset = signal(false);

  readonly characters = this.media.characters;
  readonly hasSeveralCharacters = this.media.hasSeveralCharacters;
  readonly chosenCharacter = this.media.character;

  readonly mediaHref = computed(() => this.router.hrefForView(Views.MediaStudio));
  readonly homeHref = computed(() => this.router.hrefForView(Views.Home));

  readonly packStats = computed(() =>
    QUESTION_PACKS.map((pack) => ({
      pack,
      stats: this.progress.statsFor(pack.id),
    })),
  );

  chooseCharacter(id: string): void {
    this.media.chooseCharacter(id);
    this.audio.play('tap');
  }

  isChosen(id: string): boolean {
    return this.chosenCharacter().id === id;
  }

  toggleSounds(): void {
    this.audio.toggleSounds();
    this.audio.play('tap');
  }

  toggleMusic(): void {
    this.audio.toggleMusic();
  }

  resetMedia(): void {
    this.media.resetToDefaults();
  }

  /**
   * Erases everything and reloads. Every service holds its saved state in a
   * signal read once at startup, so reloading is what guarantees nothing in
   * memory quietly writes an old value straight back.
   */
  startFresh(): void {
    eraseForFreshStart(localStorage);
    location.reload();
  }

  go(event: Event, href: string): void {
    const mouse = event as MouseEvent;
    if (mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.button > 0) return;
    event.preventDefault();
    this.router.navigateTo(href, { clearUrlParams: true });
  }
}
