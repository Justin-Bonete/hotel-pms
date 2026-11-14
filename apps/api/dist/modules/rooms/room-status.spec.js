"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const types_1 = require("@pms/types");
const vitest_1 = require("vitest");
(0, vitest_1.describe)('room status rules', () => {
    (0, vitest_1.it)('shared statuses match the database enum exactly', () => {
        (0, vitest_1.expect)([...types_1.ROOM_STATUSES].sort()).toEqual(Object.values(client_1.RoomStatus).sort());
    });
    (0, vitest_1.it)('every status has transitions, and none transitions to itself', () => {
        for (const s of types_1.ROOM_STATUSES) {
            (0, vitest_1.expect)(types_1.ROOM_STATUS_TRANSITIONS[s].length).toBeGreaterThan(0);
            (0, vitest_1.expect)(types_1.ROOM_STATUS_TRANSITIONS[s]).not.toContain(s);
        }
    });
    (0, vitest_1.it)('follows the housekeeping flow: dirty -> cleaning -> clean -> available', () => {
        (0, vitest_1.expect)((0, types_1.canTransition)('DIRTY', 'CLEANING')).toBe(true);
        (0, vitest_1.expect)((0, types_1.canTransition)('CLEANING', 'CLEAN')).toBe(true);
        (0, vitest_1.expect)((0, types_1.canTransition)('CLEAN', 'AVAILABLE')).toBe(true);
    });
    (0, vitest_1.it)('has no shortcuts around cleaning and inspection', () => {
        (0, vitest_1.expect)((0, types_1.canTransition)('DIRTY', 'CLEAN')).toBe(false);
        (0, vitest_1.expect)((0, types_1.canTransition)('CLEANING', 'AVAILABLE')).toBe(false);
    });
    (0, vitest_1.it)('does not let a dirty room become available without being cleaned', () => {
        (0, vitest_1.expect)((0, types_1.canTransition)('DIRTY', 'AVAILABLE')).toBe(false);
        (0, vitest_1.expect)((0, types_1.canTransition)('DIRTY', 'INSPECTED')).toBe(false);
    });
    (0, vitest_1.it)('every status can eventually return to AVAILABLE (no dead ends)', () => {
        for (const start of types_1.ROOM_STATUSES) {
            const seen = new Set([start]);
            const queue = [start];
            while (queue.length) {
                for (const next of types_1.ROOM_STATUS_TRANSITIONS[queue.shift()])
                    if (!seen.has(next)) {
                        seen.add(next);
                        queue.push(next);
                    }
            }
            (0, vitest_1.expect)(seen.has('AVAILABLE'), `${start} can reach AVAILABLE`).toBe(true);
        }
    });
});
//# sourceMappingURL=room-status.spec.js.map