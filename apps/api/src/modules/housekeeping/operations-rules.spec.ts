import {
  HousekeepingStatus as PrismaHkStatus, HousekeepingTaskType as PrismaHkType, MaintenanceCategory as PrismaCategory,
  MaintenanceStatus as PrismaMtStatus, TaskPriority as PrismaPriority,
} from '@prisma/client';
import {
  HK_ACTION_FROM, HOUSEKEEPING_ACTIONS, HOUSEKEEPING_STATUSES, HOUSEKEEPING_TASK_TYPES, MAINTENANCE_CATEGORIES, MAINTENANCE_STATUSES,
  MT_ACTION_FROM, MT_ACTION_RESULT, ROOM_STATUSES, TASK_PRIORITIES, type RoomStatus, canTransition, housekeepingResult, housekeepingRoomEffect, type HousekeepingStatus, type MaintenanceStatus,
} from '@pms/types';
import { SseParser } from '@pms/utils';
import { describe, expect, it } from 'vitest';

describe('operations constants match the database', () => {
  it('enums are identical to the Prisma enums', () => {
    expect([...HOUSEKEEPING_TASK_TYPES].sort()).toEqual(Object.values(PrismaHkType).sort());
    expect([...HOUSEKEEPING_STATUSES].sort()).toEqual(Object.values(PrismaHkStatus).sort());
    expect([...TASK_PRIORITIES].sort()).toEqual(Object.values(PrismaPriority).sort());
    expect([...MAINTENANCE_CATEGORIES].sort()).toEqual(Object.values(PrismaCategory).sort());
    expect([...MAINTENANCE_STATUSES].sort()).toEqual(Object.values(PrismaMtStatus).sort());
  });
});

describe('housekeeping workflow', () => {
  const walk = (type: 'CHECKOUT_CLEAN' | 'STAYOVER', actions: Array<(typeof HOUSEKEEPING_ACTIONS)[number]>): HousekeepingStatus => {
    let status: HousekeepingStatus = 'OPEN';
    for (const a of actions) {
      expect(HK_ACTION_FROM[a], `${a} from ${status}`).toContain(status);
      status = housekeepingResult(type, a);
    }
    return status;
  };

  it('a turnover clean goes assigned -> cleaning -> clean -> inspected -> done', () => {
    expect(walk('CHECKOUT_CLEAN', ['assign', 'start', 'finish', 'inspect_pass'])).toBe('DONE');
  });

  it('a stayover is finished by the housekeeper, with no inspection step', () => {
    expect(walk('STAYOVER', ['assign', 'start', 'finish'])).toBe('DONE');
  });

  it('a failed inspection sends the task back and makes the room dirty again', () => {
    expect(housekeepingResult('CHECKOUT_CLEAN', 'inspect_fail')).toBe('ASSIGNED');
    expect(housekeepingRoomEffect('CHECKOUT_CLEAN', 'inspect_fail')?.to).toBe('DIRTY');
  });

  it('a stayover never changes the room (the guest is still in it)', () => {
    for (const a of HOUSEKEEPING_ACTIONS) expect(housekeepingRoomEffect('STAYOVER', a)).toBeNull();
  });

  it('every room effect is a legal room transition', () => {
    for (const type of ['CHECKOUT_CLEAN', 'DEEP_CLEAN'] as const) {
      for (const a of HOUSEKEEPING_ACTIONS) {
        const effect = housekeepingRoomEffect(type, a);
        if (!effect) continue;
        for (const from of effect.from) if (from !== effect.to) expect(canTransition(from, effect.to) || (from === 'DIRTY' && effect.to === 'CLEAN'), `${type} ${a}`).toBe(true);
      }
    }
  });

  it('finished and cancelled tasks accept no further action', () => {
    for (const a of HOUSEKEEPING_ACTIONS) for (const done of ['DONE', 'CANCELLED'] as const) expect(HK_ACTION_FROM[a]).not.toContain(done);
  });

  it('every room status can eventually return to available', () => {
    for (const start of ROOM_STATUSES) {
      const seen = new Set<RoomStatus>([start]);
      const queue: RoomStatus[] = [start];
      while (queue.length > 0) {
        const current = queue.shift() as RoomStatus;
        for (const next of ROOM_STATUSES) {
          if (canTransition(current, next) && !seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
      expect(seen.has('AVAILABLE'), start).toBe(true);
    }
  });
});

describe('maintenance workflow', () => {
  it('a ticket runs reported -> assigned -> in progress -> waiting parts -> in progress -> resolved -> closed', () => {
    let status: MaintenanceStatus = 'REPORTED';
    for (const a of ['assign', 'start', 'wait_parts', 'resume', 'resolve', 'close'] as const) {
      expect(MT_ACTION_FROM[a], `${a} from ${status}`).toContain(status);
      status = MT_ACTION_RESULT[a];
    }
    expect(status).toBe('CLOSED');
  });

  it('cannot close what is unresolved, resolve what was never started, or reopen what is still open', () => {
    expect(MT_ACTION_FROM.close).not.toContain('IN_PROGRESS');
    expect(MT_ACTION_FROM.resolve).not.toContain('REPORTED');
    expect(MT_ACTION_FROM.reopen).not.toContain('IN_PROGRESS');
  });
});

describe('server-sent events parser', () => {
  it('reads whole frames, CRLF, comments, multi-line data and frames split across chunks', () => {
    const p = new SseParser();
    expect(p.push('event: room.changed\ndata: {"a":1}\n\n')).toEqual([{ event: 'room.changed', data: '{"a":1}' }]);
    expect(p.push(': keep-alive\n\n')).toEqual([]);
    expect(p.push('data: first\r\ndata: second\r\n\r\n')).toEqual([{ event: 'message', data: 'first\nsecond' }]);
    expect(p.push('event: reserv')).toEqual([]);
    expect(p.push('ation.changed\nda')).toEqual([]);
    expect(p.push('ta: {"x":2}\n\nevent: ping\ndata: 1\n\n')).toEqual([
      { event: 'reservation.changed', data: '{"x":2}' },
      { event: 'ping', data: '1' },
    ]);
  });
});
