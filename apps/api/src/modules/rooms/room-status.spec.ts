import { RoomStatus as PrismaRoomStatus } from '@prisma/client';
import { ROOM_STATUSES, ROOM_STATUS_TRANSITIONS, canTransition, type RoomStatus } from '@pms/types';
import { describe, expect, it } from 'vitest';

describe('room status rules', () => {
  it('shared statuses match the database enum exactly', () => {
    expect([...ROOM_STATUSES].sort()).toEqual(Object.values(PrismaRoomStatus).sort());
  });

  it('every status has transitions, and none transitions to itself', () => {
    for (const s of ROOM_STATUSES) {
      expect(ROOM_STATUS_TRANSITIONS[s].length).toBeGreaterThan(0);
      expect(ROOM_STATUS_TRANSITIONS[s]).not.toContain(s);
    }
  });

  it('follows the housekeeping flow: dirty -> cleaning -> inspected -> available', () => {
    expect(canTransition('DIRTY', 'CLEANING')).toBe(true);
    expect(canTransition('CLEANING', 'INSPECTED')).toBe(true);
    expect(canTransition('INSPECTED', 'AVAILABLE')).toBe(true);
  });

  it('does not let a dirty room become available without being cleaned', () => {
    expect(canTransition('DIRTY', 'AVAILABLE')).toBe(false);
    expect(canTransition('DIRTY', 'INSPECTED')).toBe(false);
  });

  it('every status can eventually return to AVAILABLE (no dead ends)', () => {
    for (const start of ROOM_STATUSES) {
      const seen = new Set<RoomStatus>([start]);
      const queue: RoomStatus[] = [start];
      while (queue.length) {
        for (const next of ROOM_STATUS_TRANSITIONS[queue.shift()!]) if (!seen.has(next)) { seen.add(next); queue.push(next); }
      }
      expect(seen.has('AVAILABLE'), `${start} can reach AVAILABLE`).toBe(true);
    }
  });
});
