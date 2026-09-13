import { describe, expect, it } from 'vitest';
import { freeCells, stackSlots } from './prize-stack';

const phone = { width: 375, height: 812 };

describe('stacking prizes behind a game', () => {
  it('starts at the bottom of the screen and works upwards', () => {
    const slots = stackSlots(20, phone, []);
    expect(slots[0].y).toBe(phone.height - 24);
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].y).toBeLessThanOrEqual(slots[i - 1].y);
    }
  });

  it('never puts a prize under a card', () => {
    const cards = [
      { left: 14, top: 600, width: 347, height: 180 },
      { left: 150, top: 380, width: 210, height: 90 },
      { left: 0, top: 0, width: 375, height: 60 },
    ];
    const half = 48 / 2;
    for (const slot of freeCells(phone, cards)) {
      for (const card of cards) {
        const clear =
          slot.x + half <= card.left ||
          slot.x - half >= card.left + card.width ||
          slot.y + half <= card.top ||
          slot.y - half >= card.top + card.height;
        expect(clear, `slot at ${slot.x},${slot.y} is under a card`).toBe(true);
      }
    }
  });

  it('goes above cards that fill the bottom', () => {
    const answers = { left: 0, top: 620, width: 375, height: 192 };
    const [first] = stackSlots(1, phone, [answers]);
    expect(first.y).toBeLessThan(answers.top);
  });

  it('keeps every slot inside the area', () => {
    for (const slot of stackSlots(60, phone, [])) {
      expect(slot.x).toBeGreaterThan(0);
      expect(slot.x).toBeLessThan(phone.width);
      expect(slot.y).toBeGreaterThan(0);
      expect(slot.y).toBeLessThan(phone.height);
    }
  });

  it('gives every prize a slot even when they outnumber the gaps', () => {
    const small = { width: 96, height: 48 };
    const slots = stackSlots(5, small, []);
    expect(slots).toHaveLength(5);
    expect(slots[2]).not.toEqual(slots[0]);
  });

  it('has nowhere to put anything when the screen is full', () => {
    expect(stackSlots(3, phone, [{ left: 0, top: 0, ...phone }])).toEqual([]);
  });
});
