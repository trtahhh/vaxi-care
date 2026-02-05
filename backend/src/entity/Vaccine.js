const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "Vaccine",
    tableName: "vaccines",
    columns: {
        id: {
            primary: true,
            type: "int",
            generated: true,
        },
        name: {
            type: "varchar",
        },
        description: {
            type: "text",
            nullable: true,
        },
        price: {
            type: "decimal",
            precision: 10,
            scale: 2,
        },
        stock: {
            type: "int",
            default: 0,
        },
    },
});
