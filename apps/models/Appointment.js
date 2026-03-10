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
        createdAt: {
            createDate: true,
        },
    },
    relations: {
        child: {
            type: "many-to-one",
            target: "Child",
            joinColumn: { name: "child_id" },
        },
        vaccine: {
            type: "many-to-one",
            target: "Vaccine",
            joinColumn: { name: "vaccine_id" },
        },
    },
});
