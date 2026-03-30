const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "DailySlotConfig",
    tableName: "daily_slot_configs",
    columns: {
        id: {
            primary: true,
            type: "int",
            generated: true,
        },
        date: {
            type: "date",
            unique: true,
        },
        maxSlots: {
            type: "int",
            default: 50,
        },
        morningSlots: {
            type: "int",
            default: 25,
        },
        afternoonSlots: {
            type: "int",
            default: 25,
        },
        isDayOff: {
            type: "boolean",
            default: false,
        },
        note: {
            type: "varchar",
            nullable: true,
        },
    },
});
