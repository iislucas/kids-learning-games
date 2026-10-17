import { buildMapLayout } from './map-layout';
import { CROSSROADS, bookForRound, describeBook, levelBookKey } from './sticker-books';

describe('sticker books', () => {
  const layout = buildMapLayout();

  it('gives every challenge on the map its own book, in its area', () => {
    for (const spot of layout.spots) {
      const packId = spot.challengeId.split('.')[0];
      expect(
        bookForRound(layout, { packId, level: 1, challengeId: spot.challengeId }),
      ).toEqual({ book: spot.challengeId, area: spot.regionId });
    }
  });

  it('gives each level of an ordinary round its own book', () => {
    const one = bookForRound(layout, { packId: 'maths', level: 1 });
    const five = bookForRound(layout, { packId: 'maths', level: 5 });
    expect(one.book).toBe(levelBookKey('maths', 1));
    expect(five.book).toBe(levelBookKey('maths', 5));
    expect(one.book).not.toBe(five.book);
  });

  it('names every kind of book', () => {
    const spot = layout.spots[0];
    expect(describeBook(layout, spot.challengeId).spot).toBe(spot);
    expect(describeBook(layout, levelBookKey('maths', 2)).short).toBe('Lv 2');
    expect(describeBook(layout, `region:${layout.regions[0].id}`).name).toContain(
      layout.regions[0].name,
    );
    expect(describeBook(layout, CROSSROADS).name).toBe('The crossroads');
  });
});
