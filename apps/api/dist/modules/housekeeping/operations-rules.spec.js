"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const types_1 = require("@pms/types");
const utils_1 = require("@pms/utils");
const vitest_1 = require("vitest");
(0, vitest_1.describe)('operations constants match the database', () => {
    (0, vitest_1.it)('enums are identical to the Prisma enums', () => {
        (0, vitest_1.expect)([...types_1.HOUSEKEEPING_TASK_TYPES].sort()).toEqual(Object.values(client_1.HousekeepingTaskType).sort());
        (0, vitest_1.expect)([...types_1.HOUSEKEEPING_STATUSES].sort()).toEqual(Object.values(client_1.HousekeepingStatus).sort());
        (0, vitest_1.expect)([...types_1.TASK_PRIORITIES].sort()).toEqual(Object.values(client_1.TaskPriority).sort());
        (0, vitest_1.expect)([...types_1.MAINTENANCE_CATEGORIES].sort()).toEqual(Object.values(client_1.MaintenanceCategory).sort());
        (0, vitest_1.expect)([...types_1.MAINTENANCE_STATUSES].sort()).toEqual(Object.values(client_1.MaintenanceStatus).sort());
    });
});
(0, vitest_1.describe)('housekeeping workflow', () => {
    const walk = (type, actions) => {
        let status = 'OPEN';
        for (const a of actions) {
            (0, vitest_1.expect)(types_1.HK_ACTION_FROM[a], `${a} from ${status}`).toContain(status);
            status = (0, types_1.housekeepingResult)(type, a);
        }
        return status;
    };
    (0, vitest_1.it)('a turnover clean goes assigned -> cleaning -> clean -> inspected -> done', () => {
        (0, vitest_1.expect)(walk('CHECKOUT_CLEAN', ['assign', 'start', 'finish', 'inspect_pass'])).toBe('DONE');
    });
    (0, vitest_1.it)('a stayover is finished by the housekeeper, with no inspection step', () => {
        (0, vitest_1.expect)(walk('STAYOVER', ['assign', 'start', 'finish'])).toBe('DONE');
    });
    (0, vitest_1.it)('a failed inspection sends the task back and makes the room dirty again', () => {
        (0, vitest_1.expect)((0, types_1.housekeepingResult)('CHECKOUT_CLEAN', 'inspect_fail')).toBe('ASSIGNED');
        (0, vitest_1.expect)((0, types_1.housekeepingRoomEffect)('CHECKOUT_CLEAN', 'inspect_fail')?.to).toBe('DIRTY');
    });
    (0, vitest_1.it)('a stayover never changes the room (the guest is still in it)', () => {
        for (const a of types_1.HOUSEKEEPING_ACTIONS)
            (0, vitest_1.expect)((0, types_1.housekeepingRoomEffect)('STAYOVER', a)).toBeNull();
    });
    (0, vitest_1.it)('every room effect is a legal room transition', () => {
        for (const type of ['CHECKOUT_CLEAN', 'DEEP_CLEAN']) {
            for (const a of types_1.HOUSEKEEPING_ACTIONS) {
                const effect = (0, types_1.housekeepingRoomEffect)(type, a);
                if (!effect)
                    continue;
                for (const from of effect.from)
                    if (from !== effect.to)
                        (0, vitest_1.expect)((0, types_1.canTransition)(from, effect.to) || (from === 'DIRTY' && effect.to === 'CLEAN'), `${type} ${a}`).toBe(true);
            }
        }
    });
    (0, vitest_1.it)('finished and cancelled tasks accept no further action', () => {
        for (const a of types_1.HOUSEKEEPING_ACTIONS)
            for (const done of ['DONE', 'CANCELLED'])
                (0, vitest_1.expect)(types_1.HK_ACTION_FROM[a]).not.toContain(done);
    });
    (0, vitest_1.it)('every room status can eventually return to available', () => {
        for (const start of types_1.ROOM_STATUSES) {
            const seen = new Set([start]);
            const queue = [start];
            while (queue.length > 0) {
                const current = queue.shift();
                for (const next of types_1.ROOM_STATUSES) {
                    if ((0, types_1.canTransition)(current, next) && !seen.has(next)) {
                        seen.add(next);
                        queue.push(next);
                    }
                }
            }
            (0, vitest_1.expect)(seen.has('AVAILABLE'), start).toBe(true);
        }
    });
});
(0, vitest_1.describe)('maintenance workflow', () => {
    (0, vitest_1.it)('a ticket runs reported -> assigned -> in progress -> waiting parts -> in progress -> resolved -> closed', () => {
        let status = 'REPORTED';
        for (const a of ['assign', 'start', 'wait_parts', 'resume', 'resolve', 'close']) {
            (0, vitest_1.expect)(types_1.MT_ACTION_FROM[a], `${a} from ${status}`).toContain(status);
            status = types_1.MT_ACTION_RESULT[a];
        }
        (0, vitest_1.expect)(status).toBe('CLOSED');
    });
    (0, vitest_1.it)('cannot close what is unresolved, resolve what was never started, or reopen what is still open', () => {
        (0, vitest_1.expect)(types_1.MT_ACTION_FROM.close).not.toContain('IN_PROGRESS');
        (0, vitest_1.expect)(types_1.MT_ACTION_FROM.resolve).not.toContain('REPORTED');
        (0, vitest_1.expect)(types_1.MT_ACTION_FROM.reopen).not.toContain('IN_PROGRESS');
    });
});
(0, vitest_1.describe)('server-sent events parser', () => {
    (0, vitest_1.it)('reads whole frames, CRLF, comments, multi-line data and frames split across chunks', () => {
        const p = new utils_1.SseParser();
        (0, vitest_1.expect)(p.push('event: room.changed\ndata: {"a":1}\n\n')).toEqual([{ event: 'room.changed', data: '{"a":1}' }]);
        (0, vitest_1.expect)(p.push(': keep-alive\n\n')).toEqual([]);
        (0, vitest_1.expect)(p.push('data: first\r\ndata: second\r\n\r\n')).toEqual([{ event: 'message', data: 'first\nsecond' }]);
        (0, vitest_1.expect)(p.push('event: reserv')).toEqual([]);
        (0, vitest_1.expect)(p.push('ation.changed\nda')).toEqual([]);
        (0, vitest_1.expect)(p.push('ta: {"x":2}\n\nevent: ping\ndata: 1\n\n')).toEqual([
            { event: 'reservation.changed', data: '{"x":2}' },
            { event: 'ping', data: '1' },
        ]);
    });
});
//# sourceMappingURL=operations-rules.spec.js.map