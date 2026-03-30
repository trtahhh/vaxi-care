const { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } = require("typeorm");

@Entity("users")
class User {
  @PrimaryGeneratedColumn()
  id;

  @Column({ type: "varchar", length: 255, unique: true })
  username;

  @Column({ type: "varchar", length: 255 })
  password;

  @Column({ type: "varchar", length: 20, nullable: true })
  phone;

  @Column({ type: "varchar", length: 500, nullable: true })
  refreshToken;

  @Column({ type: "varchar", length: 255, nullable: true })
  resetPasswordToken;

  @Column({ type: "datetime", nullable: true })
  resetPasswordExpires;

  @Column({ type: "varchar", length: 255 })
  fullName;

  @Column({ type: "varchar", length: 255, unique: true })
  email;

  @Column({
    type: "enum",
    enum: ["admin", "staff", "parent"],
    default: "parent"
  })
  role;

  @CreateDateColumn()
  createdAt;
}

module.exports = User;
