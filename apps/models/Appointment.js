const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "Appointment",
    tableName: "appointments",
    columns: {
        id: {
            primary: true,
            type: "int",
            generated: true,
        },
        date: {
            type: "datetime",
        },
        status: {
            type: "enum",
            enum: ["pending", "confirmed", "completed", "cancelled"],
            default: "confirmed",
        },
        notes: {
            type: "text",
            nullable: true,
        },
        session: {
            type: "enum",
            enum: ["morning", "afternoon"],
            nullable: true,
        },
        createdAt: {
            createDate: true,
        },
    },
    relations: {
        child: {
            type: "many-to-one",
            target: "Child",
            joinColumn: { name: "childId" },
        },
        vaccine: {
            type: "many-to-one",
            target: "Vaccine",
            joinColumn: { name: "vaccineId" },
        },
    },
});
