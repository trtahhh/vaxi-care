const { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } = require("typeorm");

@Entity("children")
class Child {
  @PrimaryGeneratedColumn()
  id;

  @Column({ type: "varchar", length: 255 })
  name;

  @Column({ type: "date" })
  dob;

  @Column({ type: "enum", enum: ["male", "female", "other"] })
  gender;

  @Column({ name: "parentId", nullable: true })
  parentId;

  @ManyToOne("User", "children")
  @JoinColumn({ name: "parentId" })
  parent;
}

module.exports = Child;
