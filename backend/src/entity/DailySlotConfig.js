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
            comment: "So luong lich hen toi da trong ngay, do Admin cau hinh",
        },
    },
});
