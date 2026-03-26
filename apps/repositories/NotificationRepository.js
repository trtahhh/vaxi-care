const { AppDataSource } = require("../models/data-source");

class NotificationRepository {
  constructor(context, session = null) {
    this.context = context || AppDataSource;
    this.session = session;
  }

  create(data) {
    return this.context.getRepository("Notification").create(data);
  }

  async findById(id) {
    return await this.context.getRepository("Notification").findOne({
      where: { id },
      relations: ["user"]
    });
  }

  async findByUserId(userId, take = 50) {
    return await this.context.getRepository("Notification").find({
      where: { user: { id: userId } },
      order: { createdAt: "DESC" },
      take
    });
  }

  async countUnreadByUserId(userId) {
    return await this.context.getRepository("Notification").count({
      where: { user: { id: userId }, isRead: false }
    });
  }

  async insert(notification) {
    const repo = this.context.getRepository("Notification");
    const entity = repo.create(notification);
    return await repo.save(entity);
  }

  async markAsRead(id) {
    const repo = this.context.getRepository("Notification");
    const entity = await repo.findOne({ where: { id } });
    if (entity) {
      entity.isRead = true;
      return await repo.save(entity);
    }
    return null;
  }

  async delete(id) {
    const repo = this.context.getRepository("Notification");
    const entity = await repo.findOne({ where: { id } });
    if (entity) {
      return await repo.remove(entity);
    }
    return null;
  }
}

module.exports = NotificationRepository;
