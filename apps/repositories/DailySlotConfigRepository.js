const { AppDataSource } = require("../models/data-source");
const { Between } = require("typeorm");

class DailySlotConfigRepository {
  constructor(context, session = null) {
    this.context = context || AppDataSource;
    this.session = session;
  }

  create(data) {
    return this.context.getRepository("DailySlotConfig").create(data);
  }

  async findByDate(dateStr) {
    return await this.context.getRepository("DailySlotConfig").findOne({
      where: { date: dateStr }
    });
  }

  async findByDateRange(startDate, endDate) {
    return await this.context.getRepository("DailySlotConfig").find({
      where: { date: Between(startDate, endDate) },
      order: { date: "ASC" }
    });
  }

  async upsert(dateStr, maxSlots) {
    const repo = this.context.getRepository("DailySlotConfig");
    let config = await repo.findOne({ where: { date: dateStr } });
    if (config) {
      config.maxSlots = maxSlots;
    } else {
      config = repo.create({ date: dateStr, maxSlots });
    }
    return await repo.save(config);
  }

  async upsertFull(dateStr, data) {
    const repo = this.context.getRepository("DailySlotConfig");
    let config = await repo.findOne({ where: { date: dateStr } });
    if (config) {
      Object.assign(config, data);
    } else {
      config = repo.create({ date: dateStr, ...data });
    }
    return await repo.save(config);
  }

  async delete(id) {
    const repo = this.context.getRepository("DailySlotConfig");
    const entity = await repo.findOne({ where: { id } });
    if (entity) {
      return await repo.remove(entity);
    }
    return null;
  }
}

module.exports = DailySlotConfigRepository;
