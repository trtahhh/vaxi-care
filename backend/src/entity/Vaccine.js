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
        recommendedAgeMonths: {
            type: "int",
            nullable: true,
            comment: "Do tuoi khuyen nghi tiem tinh bang thang",
        },
        ageLabel: {
            type: "varchar",
            nullable: true,
            comment: "Nhan hien thi, vi du: So sinh, 2 thang, 9 thang",
        },
    },
});
