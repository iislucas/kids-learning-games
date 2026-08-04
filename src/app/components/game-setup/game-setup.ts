import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { AudioService } from '../../core/audio.service';
import { PackOptionsService } from '../../quiz/pack-options.service';
import { PackOption, QuestionPack } from '../../quiz/question.types';

/**
 * Picks the level and the content for a pack — which times tables, which
 * French topics, and so on.
 *
 * Options are chips rather than checkboxes so they are big enough to tap
 * accurately, and readable by a child who wants to choose for herself rather
 * than only by an adult setting it up for her.
 */
@Component({
  selector: 'app-game-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-setup.html',
  styleUrl: './game-setup.scss',
})
export class GameSetup {
  private readonly packOptions = inject(PackOptionsService);
  private readonly audio = inject(AudioService);

  readonly pack = input.required<QuestionPack>();
  readonly level = input.required<number>();

  readonly levelChange = output<number>();
  readonly closed = output<void>();

  readonly options = computed(() => this.pack().options ?? []);
  readonly hasLevels = computed(() => this.pack().levels.length > 1);
  readonly isCustomised = computed(() => this.packOptions.isCustomised(this.pack()));

  /** Levels annotated with whether they can currently be played. */
  readonly levelRows = computed(() =>
    this.pack().levels.map((level) => ({
      ...level,
      playable: this.packOptions.isLevelPlayable(this.pack(), level.number),
    })),
  );

  readonly nothingPlayable = computed(
    () => this.packOptions.availableLevelsFor(this.pack()).length === 0,
  );

  /** Which levels an option applies to, phrased for the panel. */
  levelNote(option: PackOption): string {
    if (!option.levels || !this.hasLevels()) return '';
    const names = option.levels
      .map((n) => this.pack().levels.find((l) => l.number === n)?.name)
      .filter((name): name is string => !!name);
    if (names.length === 0) return '';
    return `Used in: ${names.join(', ')}`;
  }

  isSelected(option: PackOption, value: string): boolean {
    return this.packOptions.isSelected(this.pack(), option, value);
  }

  countSelected(option: PackOption): number {
    return this.packOptions.countSelected(this.pack(), option);
  }

  /**
   * Which levels an emptied option takes out of play, so switching a whole
   * category off explains itself rather than just greying levels out.
   */
  disabledLevelNames(option: PackOption): string[] {
    if (this.countSelected(option) > 0) return [];
    return this.pack()
      .levels.filter(
        (level) =>
          (!option.levels || option.levels.includes(level.number)) &&
          !this.packOptions.isLevelPlayable(this.pack(), level.number),
      )
      .map((level) => level.name);
  }

  toggle(option: PackOption, value: string): void {
    this.packOptions.toggle(this.pack(), option, value);
    this.audio.play('tap');
  }

  selectAll(option: PackOption): void {
    this.packOptions.selectAll(this.pack(), option);
    this.audio.play('tap');
  }

  clear(option: PackOption): void {
    this.packOptions.clear(this.pack(), option);
    this.audio.play('tap');
  }

  chooseLevel(level: number): void {
    this.levelChange.emit(level);
    this.audio.play('tap');
  }

  reset(): void {
    this.packOptions.resetPack(this.pack());
    this.audio.play('tap');
  }

  close(): void {
    this.closed.emit();
  }
}
