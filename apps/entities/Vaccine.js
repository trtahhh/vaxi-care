const { Entity, Column, PrimaryGeneratedColumn } = require("typeorm");

@Entity("vaccines")
class Vaccine {
  @PrimaryGeneratedColumn()
  id;

  @Column({ type: "varchar", length: 255 })
  name;

  @Column({ type: "text", nullable: true })
  description;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  price;

  @Column({ type: "int", default: 0 })
  stock;

  @Column({ type: "int", nullable: true, comment: "So thang tuoi duoc khang cao" })
  recommendedAgeMonths;

  @Column({ type: "varchar", length: 100, nullable: true, comment: "Nhan hien thi tuoi" })
  ageLabel;
}

module.exports = Vaccine;
