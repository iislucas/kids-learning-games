import { Injectable, computed } from '@angular/core';
import { storedSignal } from '../core/stored-signal';
import {
  Level,
  PackOption,
  PackSelection,
  QuestionPack,
  availableLevels,
  defaultSelection,
  isLevelAvailable,
  resolveSelection,
} from './question.types';

type AllSelections = Record<string, PackSelection>;

/**
 * Remembers which content each pack is set to practise.
 *
 * Stored per pack and per option id rather than as one blob, so adding an
 * option to a pack later does not invalidate what is already saved — see
 * `resolveSelection`, which reconciles anything stale on read.
 *
 * Any option may be emptied. Emptying one takes the levels that depend on it
 * out of play rather than being ignored, so "no adding" actually means none.
 */
@Injectable({ providedIn: 'root' })
export class PackOptionsService {
  private readonly stored = storedSignal<AllSelections>('klg.packOptions', {});

  /** The cleaned, ready-to-use selection for a pack. */
  selectionFor(pack: QuestionPack): PackSelection {
    return resolveSelection(pack, this.stored()[pack.id]);
  }

  /**
   * A stable string for a pack's selection, for use as an effect dependency —
   * comparing the object itself would re-fire on every unrelated storage write.
   */
  selectionKeyFor(pack: QuestionPack | undefined): string {
    if (!pack) return '';
    return JSON.stringify(this.selectionFor(pack));
  }

  isSelected(pack: QuestionPack, option: PackOption, value: string): boolean {
    return this.selectionFor(pack)[option.id]?.includes(value) ?? false;
  }

  countSelected(pack: QuestionPack, option: PackOption): number {
    return this.selectionFor(pack)[option.id]?.length ?? 0;
  }

  toggle(pack: QuestionPack, option: PackOption, value: string): void {
    const current = this.selectionFor(pack);
    const values = current[option.id] ?? [];
    const next = values.includes(value)
      ? values.filter((v) => v !== value)
      : [...values, value];

    // Keep the pack's own choice order, so chips do not reorder as they are
    // tapped and the stored value is comparable between sessions.
    const ordered = option.choices
      .map((choice) => choice.value)
      .filter((v) => next.includes(v));

    this.setSelection(pack, { ...current, [option.id]: ordered });
  }

  selectAll(pack: QuestionPack, option: PackOption): void {
    this.setSelection(pack, {
      ...this.selectionFor(pack),
      [option.id]: option.choices.map((choice) => choice.value),
    });
  }

  /** Switches a whole category off. */
  clear(pack: QuestionPack, option: PackOption): void {
    this.setSelection(pack, { ...this.selectionFor(pack), [option.id]: [] });
  }

  resetPack(pack: QuestionPack): void {
    this.setSelection(pack, defaultSelection(pack));
  }

  /** True when the pack is not on its default selection. */
  isCustomised(pack: QuestionPack): boolean {
    return (
      JSON.stringify(this.selectionFor(pack)) !==
      JSON.stringify(defaultSelection(pack))
    );
  }

  availableLevelsFor(pack: QuestionPack): Level[] {
    return availableLevels(pack, this.selectionFor(pack));
  }

  isLevelPlayable(pack: QuestionPack, level: number): boolean {
    return isLevelAvailable(pack, level, this.selectionFor(pack));
  }

  /**
   * The level to actually play: the requested one when it is available, else
   * the nearest available one, else null when everything has been switched off.
   */
  resolveLevel(pack: QuestionPack, requested: number): number | null {
    const levels = this.availableLevelsFor(pack);
    if (levels.length === 0) return null;
    if (levels.some((level) => level.number === requested)) return requested;
    // Nearest by distance, preferring the easier one on a tie.
    return levels.reduce((best, level) =>
      Math.abs(level.number - requested) < Math.abs(best.number - requested)
        ? level
        : best,
    ).number;
  }

  private setSelection(pack: QuestionPack, selection: PackSelection): void {
    this.stored.update((all) => ({ ...all, [pack.id]: selection }));
  }

  readonly all = computed(() => this.stored());
}
