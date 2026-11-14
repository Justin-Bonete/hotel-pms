"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("@pms/types");
const vitest_1 = require("vitest");
(0, vitest_1.describe)('occupancy', () => {
    (0, vitest_1.it)('is guests in house divided by rooms that can be sold, as a whole percent', () => {
        (0, vitest_1.expect)((0, types_1.occupancyPct)(5, 10)).toBe(50);
        (0, vitest_1.expect)((0, types_1.occupancyPct)(1, 3)).toBe(33);
        (0, vitest_1.expect)((0, types_1.occupancyPct)(2, 3)).toBe(67);
        (0, vitest_1.expect)((0, types_1.occupancyPct)(0, 10)).toBe(0);
    });
    (0, vitest_1.it)('is not a number (not zero) when no room can be sold, so it never shows a false 0%', () => {
        (0, vitest_1.expect)((0, types_1.occupancyPct)(0, 0)).toBeNull();
        (0, vitest_1.expect)((0, types_1.occupancyPct)(3, 0)).toBeNull();
    });
});
//# sourceMappingURL=dashboard.spec.js.map