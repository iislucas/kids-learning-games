import { Injectable, computed } from '@angular/core';
import { storedSignal } from '../core/stored-signal';
import {
  PackOption,
  PackSelection,
  QuestionPack,
  defaultSelection,
  resolveSelection,
} from './question.types';

type AllSelections = Record<string, PackSelection>;

/**
 * Remembers which content each pack is set to practise.
 *
 * Stored per pack and per option id rather than as one blob, so adding an
 * option to a pack later does not invalidate what is already saved — see
 * `resolveSelection`, which reconciles anything stale on read.
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

  /**
   * Toggles a value. Refuses to drop below the option's minimum — the last
   * selected chip stays on rather than leaving a round with nothing to ask.
   */
  toggle(pack: QuestionPack, option: PackOption, value: string): void {
    const current = this.selectionFor(pack);
    const values = current[option.id] ?? [];
    const next = values.includes(value)
      ? values.filter((v) => v !== value)
      : [...values, value];

    if (next.length < option.minSelected) return;

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

  private setSelection(pack: QuestionPack, selection: PackSelection): void {
    this.stored.update((all) => ({ ...all, [pack.id]: selection }));
  }

  readonly all = computed(() => this.stored());
}
