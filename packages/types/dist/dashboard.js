"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.occupancyPct = void 0;
const occupancyPct = (inHouse, sellableRooms) => sellableRooms > 0 ? Math.round((inHouse / sellableRooms) * 100) : null;
exports.occupancyPct = occupancyPct;
//# sourceMappingURL=dashboard.js.map