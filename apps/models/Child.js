const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "Child",
    tableName: "children",
    columns: {
        id: {
            primary: true,
            type: "int",
            generated: true,
        },
        name: {
            type: "varchar",
        },
        dob: {
            type: "date",
        },
        gender: {
            type: "enum",
            enum: ["male", "female", "other"],
        },
        parentId: {
            type: "int",
            nullable: true,
        },
    },
    relations: {
        parent: {
            type: "many-to-one",
            target: "User",
            joinColumn: { name: "parentId" },
            inverseSide: "children",
        },
    },
});
