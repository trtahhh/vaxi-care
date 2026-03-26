const { AppDataSource } = require("../models/data-source");
const { MoreThanOrEqual, Between } = require("typeorm");

class AppointmentRepository {
  constructor(context, session = null) {
    this.context = context || AppDataSource;
    this.session = session;
  }

  create(data) {
    return this.context.getRepository("Appointment").create(data);
  }

  async findById(id) {
    return await this.context.getRepository("Appointment").findOne({
      where: { id },
      relations: ["child", "vaccine"]
    });
  }

  async findByChildId(childId) {
    return await this.context.getRepository("Appointment").find({
      where: { child: { id: childId } },
      relations: ["vaccine"],
      order: { date: "DESC" }
    });
  }

  async findByChildIds(childIds) {
    if (!childIds || childIds.length === 0) return [];
    return await this.context
      .getRepository("Appointment")
      .createQueryBuilder("appointment")
      .leftJoinAndSelect("appointment.child", "child")
      .leftJoinAndSelect("appointment.vaccine", "vaccine")
      .where("child.id IN (:...childIds)", { childIds })
      .orderBy("appointment.date", "ASC")
      .getMany();
  }

  async findByDateRange(startDate, endDate) {
    return await this.context.getRepository("Appointment").find({
      where: {
        date: Between(startDate, endDate)
      },
      relations: ["child", "vaccine"]
    });
  }

  async findByDate(date) {
    const dateStr = date.toISOString().split("T")[0];
    return await this.context.getRepository("Appointment")
      .createQueryBuilder("appointment")
      .leftJoinAndSelect("appointment.child", "child")
      .leftJoinAndSelect("child.parent", "parent")
      .leftJoinAndSelect("appointment.vaccine", "vaccine")
      .where("DATE(appointment.date) = :date", { date: dateStr })
      .getMany();
  }

  async countUpcomingFromDate(date) {
    return await this.context.getRepository("Appointment").count({
      where: { date: MoreThanOrEqual(date) }
    });
  }

  async countByDate(date) {
    const dateStr = date.toISOString().split("T")[0];
    return await this.context.getRepository("Appointment")
      .createQueryBuilder("appointment")
      .where("DATE(appointment.date) = :date", { date: dateStr })
      .andWhere("appointment.status != :status", { status: "cancelled" })
      .getCount();
  }

  async countByDateAndStatus(date, status) {
    const dateStr = date.toISOString().split("T")[0];
    return await this.context.getRepository("Appointment")
      .createQueryBuilder("appointment")
      .where("DATE(appointment.date) = :date", { date: dateStr })
      .andWhere("appointment.status = :status", { status })
      .getCount();
  }

  async insert(appointment) {
    const repo = this.context.getRepository("Appointment");
    const entity = repo.create(appointment);
    return await repo.save(entity);
  }

  async update(appointment) {
    const repo = this.context.getRepository("Appointment");
    return await repo.save(appointment);
  }

  async delete(id) {
    const repo = this.context.getRepository("Appointment");
    const entity = await repo.findOne({ where: { id } });
    if (entity) {
      return await repo.remove(entity);
    }
    return null;
  }

  async countByDateRange(startDate, endDate) {
    return await this.context.getRepository("Appointment").count({
      where: {
        date: Between(startDate, endDate)
      }
    });
  }

  async findPending(skip, limit) {
    return await this.context.getRepository("Appointment").findAndCount({
      where: { status: "pending" },
      relations: ["child", "vaccine", "child.parent"],
      order: { date: "ASC" },
      skip,
      take: limit
    });
  }
}

module.exports = AppointmentRepository;
