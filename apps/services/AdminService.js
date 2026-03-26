const { AppDataSource } = require("../models/data-source");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const UserRepository = require("../repositories/UserRepository");
const ChildRepository = require("../repositories/ChildRepository");
const VaccineRepository = require("../repositories/VaccineRepository");
const AppointmentRepository = require("../repositories/AppointmentRepository");
const DailySlotConfigRepository = require("../repositories/DailySlotConfigRepository");

const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );
};

class AdminService {
  // Dashboard
  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const appointmentRepo = new AppointmentRepository();
    const vaccineRepo = new VaccineRepository();

    const [userCount, childCount, vaccineCount, todayAppointments, weeklyAppointments, stockAlerts] = await Promise.all([
      AppDataSource.getRepository("User").count(),
      AppDataSource.getRepository("Child").count(),
      AppDataSource.getRepository("Vaccine").count(),
      appointmentRepo.countUpcomingFromDate(today),
      appointmentRepo.countByDateRange(sevenDaysAgo, today),
      vaccineRepo.findLowStock(10) // Custom method to find stock < 10
    ]);

    return { 
      userCount, 
      childCount, 
      vaccineCount, 
      todayAppointments, 
      weeklyTrend: weeklyAppointments,
      stockAlerts 
    };
  }

  // Appointment Approvals
  async getPendingAppointments(page, limit = 10) {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const skip = (pageNum - 1) * limit;
    const appointmentRepo = new AppointmentRepository();

    const [appointments, total] = await appointmentRepo.findPending(skip, limit);
    const totalPages = Math.ceil(total / limit);

    return { appointments, total, pageNum, totalPages };
  }

  async updateAppointmentStatus(id, status) {
    const appointmentRepo = new AppointmentRepository();
    const appointment = await appointmentRepo.findById(parseInt(id));
    if (!appointment) throw new Error("Lịch hẹn không tồn tại");

    const validStatuses = ["pending", "confirmed", "completed", "cancelled"];
    if (!validStatuses.includes(status)) throw new Error("Trạng thái không hợp lệ");

    appointment.status = status;
    return await appointmentRepo.update(appointment);
  }

  // Vaccines
  async getVaccineList(search, page, limit = 10) {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const skip = (pageNum - 1) * limit;
    const vaccineRepo = new VaccineRepository();

    let vaccines, total;
    if (search) {
      vaccines = await vaccineRepo.searchByName(search, skip, limit);
      total = await vaccineRepo.count(search);
    } else {
      vaccines = await vaccineRepo.findAll(skip, limit);
      total = await vaccineRepo.count();
    }

    const totalPages = Math.max(1, Math.ceil(total / limit));
    return { vaccines, total, pageNum, totalPages };
  }

  async getVaccineById(id) {
    return await new VaccineRepository().findById(parseInt(id));
  }

  async createVaccine(data) {
    const vaccineRepo = new VaccineRepository();
    const vaccine = vaccineRepo.create({
      name: data.name,
      description: data.description,
      price: parseFloat(data.price),
      stock: parseInt(data.stock) || 0,
      recommendedAgeMonths: data.recommendedAgeMonths ? parseInt(data.recommendedAgeMonths) : null,
      ageLabel: data.ageLabel
    });
    return await vaccineRepo.insert(vaccine);
  }

  async updateVaccine(id, data) {
    const vaccineRepo = new VaccineRepository();
    const vaccine = await vaccineRepo.findById(parseInt(id));
    if (!vaccine) return null;

    vaccine.name = data.name;
    vaccine.description = data.description;
    vaccine.price = parseFloat(data.price);
    vaccine.stock = parseInt(data.stock) || 0;
    vaccine.recommendedAgeMonths = data.recommendedAgeMonths ? parseInt(data.recommendedAgeMonths) : null;
    vaccine.ageLabel = data.ageLabel;
    return await vaccineRepo.update(vaccine);
  }

  async deleteVaccine(id) {
    return await new VaccineRepository().delete(parseInt(id));
  }

  // Schedule
  async getScheduleMonth(month, year) {
    const now = new Date();
    let currentMonth = parseInt(month);
    let currentYear = parseInt(year);

    if (!currentMonth || currentMonth < 1 || currentMonth > 12) {
      currentMonth = now.getMonth() + 1;
    }
    if (!currentYear || currentYear < 2020 || currentYear > 2100) {
      currentYear = now.getFullYear();
    }

    const startDate = new Date(currentYear, currentMonth - 1, 1);
    const endDate = new Date(currentYear, currentMonth, 0);

    const slotConfigRepo = new DailySlotConfigRepository();
    const configs = await slotConfigRepo.findByDateRange(startDate, endDate);

    const dayNames = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysInMonth = [];

    for (let d = 1; d <= endDate.getDate(); d++) {
      const date = new Date(currentYear, currentMonth - 1, d);
      const config = configs.find(c => {
        const cDate = new Date(c.date);
        return cDate.getDate() === d;
      });
      daysInMonth.push({
        day: d,
        dayName: dayNames[date.getDay()],
        date: date.toISOString().split('T')[0],
        maxSlots: config ? config.maxSlots : 50,
        hasConfig: !!config,
        isPast: date < todayStart
      });
    }

    return { daysInMonth, currentMonth, currentYear };
  }

  async updateScheduleConfig(date, maxSlots) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new Error("Ngày không hợp lệ");
    }
    const slotsNum = parseInt(maxSlots);
    if (isNaN(slotsNum) || slotsNum < 0 || slotsNum > 1000) {
      throw new Error("Số lượng slot phải từ 0-1000");
    }
    const slotConfigRepo = new DailySlotConfigRepository();
    return await slotConfigRepo.upsert(date, slotsNum);
  }

  // Users
  async getUserList(role, search, page, limit = 10) {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const skip = (pageNum - 1) * limit;
    const userRepo = new UserRepository();

    let users, total;
    if (role || search) {
      users = await userRepo.findAll(skip, limit, role || null, search || null);
      total = await userRepo.count(role || null, search || null);
    } else {
      users = await userRepo.findAll(skip, limit);
      total = await userRepo.count();
    }

    const totalPages = Math.max(1, Math.ceil(total / limit));
    return { users, total, pageNum, totalPages, search: search || "", filterRole: role || "" };
  }

  async createUser(data) {
    const userRepo = new UserRepository();

    // Check existing
    const existing = await userRepo.findByEmailOrUsername(data.email, data.username);
    if (existing) {
      throw new Error("Email hoặc tên đăng nhập đã tồn tại");
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);
    const user = userRepo.create({
      username: data.username,
      email: data.email.toLowerCase().trim(),
      password: hashedPassword,
      fullName: data.fullName,
      phone: data.phone,
      role: data.role || "parent"
    });
    return await userRepo.insert(user);
  }

  // Children
  async getChildList(search, page, limit = 10) {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const skip = (pageNum - 1) * limit;
    const childRepo = new ChildRepository();

    let children, total;
    if (search) {
      children = await childRepo.searchByName(search, skip, limit);
      total = await childRepo.count(search);
    } else {
      children = await childRepo.findAll(skip, limit);
      total = await childRepo.count();
    }

    const totalPages = Math.max(1, Math.ceil(total / limit));
    return { children, total, pageNum, totalPages, search: search || "" };
  }

  async getChildDetail(id) {
    const childRepo = new ChildRepository();
    const child = await childRepo.findById(parseInt(id));
    if (!child) return null;

    const appointmentRepo = new AppointmentRepository();
    const appointments = await appointmentRepo.findByChildId(child.id);
    return { child, appointments };
  }
}

module.exports = AdminService;
