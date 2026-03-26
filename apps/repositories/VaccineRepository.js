const { AppDataSource } = require("../models/data-source");
const { Like, MoreThanOrEqual } = require("typeorm");

class VaccineRepository {
  constructor(context, session = null) {
    this.context = context || AppDataSource;
    this.session = session;
  }

  create(data) {
    return this.context.getRepository("Vaccine").create(data);
  }

  async findById(id) {
    return await this.context.getRepository("Vaccine").findOne({ where: { id } });
  }

  async findAll(skip = 0, take = 100) {
    return await this.context.getRepository("Vaccine").find({
      skip,
      take,
      order: { id: "DESC" }
    });
  }

  async searchByName(name, skip = 0, take = 100) {
    return await this.context.getRepository("Vaccine").find({
      where: { name: Like(`%${name}%`) },
      skip,
      take,
      order: { id: "DESC" }
    });
  }

  async count(searchName = null) {
    const repo = this.context.getRepository("Vaccine");
    if (searchName) {
      return await repo.count({ where: { name: Like(`%${searchName}%`) } });
    }
    return await repo.count();
  }

  async insert(vaccine) {
    const repo = this.context.getRepository("Vaccine");
    const entity = repo.create(vaccine);
    return await repo.save(entity);
  }

  async update(vaccine) {
    const repo = this.context.getRepository("Vaccine");
    return await repo.save(vaccine);
  }

  async delete(id) {
    const repo = this.context.getRepository("Vaccine");
    const entity = await repo.findOne({ where: { id } });
    if (entity) {
      return await repo.remove(entity);
    }
    return null;
  }

  async findLowStock(threshold = 10) {
    return await this.context.getRepository("Vaccine")
      .createQueryBuilder("vaccine")
      .where("vaccine.stock < :threshold", { threshold })
      .orderBy("vaccine.stock", "ASC")
      .getMany();
  }
}

module.exports = VaccineRepository;
