const { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } = require("typeorm");

@Entity("appointments")
class Appointment {
  @PrimaryGeneratedColumn()
  id;

  @Column({ type: "datetime" })
  date;

  @Column({
    type: "enum",
    enum: ["pending", "confirmed", "completed", "cancelled"],
    default: "pending"
  })
  status;

  @Column({ type: "text", nullable: true })
  notes;

  @CreateDateColumn()
  createdAt;

  @Column({ type: "enum", enum: ["morning", "afternoon"], nullable: true, comment: "Buoi dat lich" })
  session;

  // Relations (string-based to avoid circular deps)
  @ManyToOne("Child", "appointments")
  @JoinColumn({ name: "childId" })
  child;

  @ManyToOne("Vaccine", "appointments")
  @JoinColumn({ name: "vaccineId" })
  vaccine;
}

module.exports = Appointment;
