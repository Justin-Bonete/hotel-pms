"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PropertiesRepository = exports.propertyInclude = void 0;
const common_1 = require("@nestjs/common");
exports.propertyInclude = {
    group: { select: { name: true } },
    _count: { select: { rooms: { where: { deletedAt: null } } } },
};
let PropertiesRepository = class PropertiesRepository {
    async list(tx, args) {
        const where = {
            deletedAt: null,
            ...(args.scope.all ? {} : { id: { in: [...args.scope.ids] } }),
        };
        const [rows, total] = await Promise.all([
            tx.property.findMany({ where, orderBy: { name: 'asc' }, skip: args.skip, take: args.take, include: exports.propertyInclude }),
            tx.property.count({ where }),
        ]);
        return { rows, total };
    }
    findById(tx, id) {
        return tx.property.findFirst({ where: { id, deletedAt: null }, include: exports.propertyInclude });
    }
    /** Includes archived rows: the unique constraint on (organization, slug) covers them too. */
    slugExists(tx, slug) {
        return tx.property.count({ where: { slug } }).then((n) => n > 0);
    }
    groupExists(tx, id) {
        return tx.propertyGroup.count({ where: { id, deletedAt: null } }).then((n) => n > 0);
    }
    create(tx, data) {
        return tx.property.create({ data, include: exports.propertyInclude });
    }
    update(tx, id, data) {
        return tx.property.update({ where: { id }, data, include: exports.propertyInclude });
    }
    countActiveRooms(tx, propertyId) {
        return tx.room.count({ where: { propertyId, deletedAt: null } });
    }
};
exports.PropertiesRepository = PropertiesRepository;
exports.PropertiesRepository = PropertiesRepository = __decorate([
    (0, common_1.Injectable)()
], PropertiesRepository);
//# sourceMappingURL=properties.repository.js.map