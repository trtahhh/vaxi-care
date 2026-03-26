const { AppDataSource } = require("../models/data-source");
const { Like } = require("typeorm");

class ChildRepository {
  constructor(context, session = null) {
    this.context = context || AppDataSource;
    this.session = session;
  }

  create(data) {
    return this.context.getRepository("Child").create(data);
  }

  async findById(id) {
    return await this.context.getRepository("Child").findOne({
      where: { id },
      relations: ["parent"]
    });
  }

  async findByParentId(parentId) {
    return await this.context.getRepository("Child").find({
      where: { parent: { id: parentId } },
      order: { name: "ASC" }
    });
  }

  async findByParentIdList(childIds) {
    if (!childIds || childIds.length === 0) return [];
    return await this.context.getRepository("Child")
      .createQueryBuilder("child")
      .leftJoinAndSelect("child.parent", "parent")
      .where("child.id IN (:...childIds)", { childIds })
      .getMany();
  }

  async searchByName(name, skip = 0, take = 100) {
    return await this.context.getRepository("Child").find({
      where: { name: Like(`%${name}%`) },
      skip,
      take,
      order: { id: "DESC" },
      relations: ["parent"]
    });
  }

  async findAll(skip = 0, take = 100) {
    return await this.context.getRepository("Child").find({
      skip,
      take,
      order: { id: "DESC" },
      relations: ["parent"]
    });
  }

  async count(searchName = null) {
    const repo = this.context.getRepository("Child");
    if (searchName) {
      return await repo.count({ where: { name: Like(`%${searchName}%`) } });
    }
    return await repo.count();
  }

  async insert(child) {
    const repo = this.context.getRepository("Child");
    const entity = repo.create(child);
    return await repo.save(entity);
  }

  async update(child) {
    const repo = this.context.getRepository("Child");
    return await repo.save(child);
  }

  async delete(id) {
    const repo = this.context.getRepository("Child");
    const entity = await repo.findOne({ where: { id } });
    if (entity) {
      return await repo.remove(entity);
    }
    return null;
  }
}

module.exports = ChildRepository;
