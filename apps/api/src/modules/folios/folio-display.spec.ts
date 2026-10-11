import { describe, expect, it } from 'vitest';
import { orderForDisplay } from './folio-display';

const day = (s: string) => new Date(`${s}T00:00:00Z`);
const at = (ms: number) => new Date(1_700_000_000_000 + ms);
const line = (id: string, over: Partial<Parameters<typeof orderForDisplay>[0][number]> = {}) => ({
  id, parentItemId: null as string | null, serviceDate: null as Date | null, createdAt: at(0), reversesItemId: null as string | null, ...over,
});

describe('orderForDisplay', () => {
  it('puts each tax line directly under the charge it belongs to, even if it was saved first', () => {
    const items = [
      line('tax1', { parentItemId: 'room1', serviceDate: day('2026-10-01') }),
      line('room2', { serviceDate: day('2026-10-02') }),
      line('room1', { serviceDate: day('2026-10-01') }),
      line('tax2', { parentItemId: 'room2', serviceDate: day('2026-10-02') }),
    ];
    expect(orderForDisplay(items).map((i) => i.id)).toEqual(['room1', 'tax1', 'room2', 'tax2']);
  });

  it('keeps a void next to the line it cancels and puts extras last', () => {
    const items = [
      line('minibar', { createdAt: at(5) }),
      line('void1', { serviceDate: day('2026-10-01'), createdAt: at(9), reversesItemId: 'room1' }),
      line('voidtax1', { parentItemId: 'void1', serviceDate: day('2026-10-01'), createdAt: at(9), reversesItemId: 'tax1' }),
      line('room1', { serviceDate: day('2026-10-01') }),
      line('tax1', { parentItemId: 'room1', serviceDate: day('2026-10-01') }),
    ];
    expect(orderForDisplay(items).map((i) => i.id)).toEqual(['room1', 'tax1', 'void1', 'voidtax1', 'minibar']);
  });

  it('does not lose or duplicate lines', () => {
    const items = [line('a'), line('b', { parentItemId: 'a' }), line('c', { parentItemId: 'a' })];
    expect(orderForDisplay(items)).toHaveLength(3);
  });
});
