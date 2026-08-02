import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AppPathPatterns, Views } from './app.config';
import { RoutingService } from './routing/routing.service';
import { AudioService } from './core/audio.service';
import { ProgressService } from './core/progress.service';
import { HomePage } from './pages/home/home.page';
import { PlayPage } from './pages/play/play.page';
import { PrizesPage } from './pages/prizes/prizes.page';
import { MediaStudioPage } from './pages/media-studio/media-studio.page';
import { SettingsPage } from './pages/settings/settings.page';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HomePage, PlayPage, PrizesPage, MediaStudioPage, SettingsPage],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  // The explicit type annotation is required for dot-notation access to the
  // router's mapped signal types — see the note at the top of routing.service.ts.
  readonly router: RoutingService<AppPathPatterns> =
    inject(RoutingService<AppPathPatterns>);
  private readonly audio = inject(AudioService);
  private readonly progress = inject(ProgressService);

  readonly Views = Views;
  readonly view = computed(() => this.router.matchedPatternId());
  readonly stars = this.progress.stars;
  readonly soundsOn = this.audio.soundsEnabled;

  /** The play screen owns the whole viewport, so the chrome steps aside. */
  readonly showChrome = computed(() => this.view() !== Views.Play);

  readonly homeHref = computed(() => this.router.hrefForView(Views.Home));
  readonly prizesHref = computed(() => this.router.hrefForView(Views.Prizes));
  readonly settingsHref = computed(() => this.router.hrefForView(Views.Settings));

  navigate(event: Event, href: string): void {
    // Let modified clicks (open in new tab, etc.) behave normally.
    const mouse = event as MouseEvent;
    if (mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.button > 0) {
      return;
    }
    event.preventDefault();
    this.audio.play('tap');
    this.router.navigateTo(href, { clearUrlParams: true });
  }

  toggleSounds(): void {
    this.audio.toggleSounds();
  }
}
