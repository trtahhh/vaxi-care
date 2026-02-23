const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "User",
    tableName: "users",
    columns: {
        id: {
            primary: true,
            type: "int",
            generated: true,
        },
        username: {
            type: "varchar",
            unique: true,
        },
        password: {
            type: "varchar",
        },
        phone: {
            type: "varchar",
            nullable: true,
        },
        refreshToken: {
            type: "text",
            nullable: true,
        },
        resetPasswordToken: {
            type: "varchar",
            nullable: true,
        },
        resetPasswordExpires: {
            type: "datetime",
            nullable: true,
        },
        fullName: {
            type: "varchar",
            nullable: true,
        },
        email: {
            type: "varchar",
            unique: true,
        },
        role: {
            type: "enum",
            enum: ["admin", "parent", "staff"],
            default: "parent",
        },
        createdAt: {
            createDate: true,
        },
    },
    relations: {
        children: {
            type: "one-to-many",
            target: "Child",
            inverseSide: "parent",
        },
    },
});
