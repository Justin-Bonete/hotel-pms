import { occupancyPct } from '@pms/types';
import { describe, expect, it } from 'vitest';

describe('occupancy', () => {
  it('is guests in house divided by rooms that can be sold, as a whole percent', () => {
    expect(occupancyPct(5, 10)).toBe(50);
    expect(occupancyPct(1, 3)).toBe(33);
    expect(occupancyPct(2, 3)).toBe(67);
    expect(occupancyPct(0, 10)).toBe(0);
  });

  it('is not a number (not zero) when no room can be sold, so it never shows a false 0%', () => {
    expect(occupancyPct(0, 0)).toBeNull();
    expect(occupancyPct(3, 0)).toBeNull();
  });
});
