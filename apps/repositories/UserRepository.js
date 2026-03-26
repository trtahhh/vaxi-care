const { AppDataSource } = require("../models/data-source");
const { Like } = require("typeorm");

class UserRepository {
  constructor(context, session = null) {
    this.context = context || AppDataSource;
    this.session = session;
  }

  create(data) {
    return this.context.getRepository("User").create(data);
  }

  async findById(id) {
    return await this.context.getRepository("User").findOne({
      where: { id },
      relations: ["children"]
    });
  }

  async findByUsername(username) {
    return await this.context.getRepository("User").findOne({ where: { username } });
  }

  async findByEmail(email) {
    return await this.context.getRepository("User").findOne({ where: { email } });
  }

  async findByEmailOrUsername(email, username) {
    return await this.context.getRepository("User").findOne({
      where: [{ email }, { username }]
    });
  }

  async findByRefreshToken(token) {
    return await this.context.getRepository("User").findOne({ where: { refreshToken: token } });
  }

  async findAll(skip = 0, take = 100, role = null, searchName = null) {
    const repo = this.context.getRepository("User");
    let where = {};
    if (role) where.role = role;
    if (searchName) where.username = Like(`%${searchName}%`);

    return await repo.find({
      where,
      skip,
      take,
      order: { id: "DESC" },
      relations: ["children"]
    });
  }

  async count(role = null, searchName = null) {
    const repo = this.context.getRepository("User");
    let where = {};
    if (role) where.role = role;
    if (searchName) where.username = Like(`%${searchName}%`);
    return await repo.count({ where });
  }

  async insert(user) {
    const repo = this.context.getRepository("User");
    const entity = repo.create(user);
    return await repo.save(entity);
  }

  async update(user) {
    const repo = this.context.getRepository("User");
    return await repo.save(user);
  }

  async delete(id) {
    const repo = this.context.getRepository("User");
    const entity = await repo.findOne({ where: { id } });
    if (entity) {
      return await repo.remove(entity);
    }
    return null;
  }
}

module.exports = UserRepository;
