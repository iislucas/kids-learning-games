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
    return this.packOptions.selectionFor(this.pack())[option.id]?.length ?? 0;
  }

  /** True when removing this value would drop below the option's minimum. */
  isLocked(option: PackOption, value: string): boolean {
    return (
      this.isSelected(option, value) &&
      this.countSelected(option) <= option.minSelected
    );
  }

  toggle(option: PackOption, value: string): void {
    this.packOptions.toggle(this.pack(), option, value);
    this.audio.play('tap');
  }

  selectAll(option: PackOption): void {
    this.packOptions.selectAll(this.pack(), option);
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
