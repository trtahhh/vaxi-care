const { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } = require("typeorm");

@Entity("notifications")
class Notification {
  @PrimaryGeneratedColumn()
  id;

  @Column({ type: "varchar", length: 255 })
  title;

  @Column({ type: "text" })
  message;

  @Column({ type: "boolean", default: false })
  isRead;

  @CreateDateColumn()
  createdAt;

  @ManyToOne("User", "notifications")
  @JoinColumn({ name: "userId" })
  user;
}

module.exports = Notification;
