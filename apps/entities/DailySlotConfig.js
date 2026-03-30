const { Entity, Column, PrimaryGeneratedColumn } = require("typeorm");

@Entity("daily_slot_configs")
class DailySlotConfig {
  @PrimaryGeneratedColumn()
  id;

  @Column({ type: "date", unique: true })
  date;

  @Column({ type: "int", default: 50, comment: "Tong so slot trong ngay" })
  maxSlots;

  @Column({ type: "int", default: 25, comment: "So slot buoi sang" })
  morningSlots;

  @Column({ type: "int", default: 25, comment: "So slot buoi chieu" })
  afternoonSlots;

  @Column({ type: "boolean", default: false, comment: "Ngay nghi, khong cho dat lich" })
  isDayOff;

  @Column({ type: "varchar", length: 255, nullable: true, comment: "Ghi chu ngay dac biet" })
  note;
}

module.exports = DailySlotConfig;
