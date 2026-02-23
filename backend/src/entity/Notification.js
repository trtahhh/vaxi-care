const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "Notification",
    tableName: "notifications",
    columns: {
        id: {
            primary: true,
            type: "int",
            generated: true,
        },
        title: {
            type: "varchar",
        },
        message: {
            type: "text",
        },
        isRead: {
            type: "boolean",
            default: false,
        },
        createdAt: {
            createDate: true,
        },
    },
    relations: {
        user: {
            type: "many-to-one",
            target: "User",
            joinColumn: { name: "user_id" },
            onDelete: "CASCADE",
        },
    },
});
