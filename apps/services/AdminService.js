const { AppDataSource } = require("../models/data-source");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const UserRepository = require("../repositories/UserRepository");
const ChildRepository = require("../repositories/ChildRepository");
const VaccineRepository = require("../repositories/VaccineRepository");
const AppointmentRepository = require("../repositories/AppointmentRepository");
const DailySlotConfigRepository = require("../repositories/DailySlotConfigRepository");
const NotificationService = require("./NotificationService");

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
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const appointmentRepo = new AppointmentRepository();
    const vaccineRepo = new VaccineRepository();

    // Fetch all data in parallel
    const [
      userCount,
      childCount,
      vaccineCount,
      allVaccines,
      stockAlerts,
      pendingCount,
      confirmedCount,
      completedCount,
      cancelledCount,
      allAppointments
    ] = await Promise.all([
      AppDataSource.getRepository("User").count(),
      AppDataSource.getRepository("Child").count(),
      AppDataSource.getRepository("Vaccine").count(),
      vaccineRepo.findAll(0, 500),
      vaccineRepo.findLowStock(10),
      AppDataSource.getRepository("Appointment").count({ where: { status: "pending" } }),
      AppDataSource.getRepository("Appointment").count({ where: { status: "confirmed" } }),
      AppDataSource.getRepository("Appointment").count({ where: { status: "completed" } }),
      AppDataSource.getRepository("Appointment").count({ where: { status: "cancelled" } }),
      appointmentRepo.findByDateRange(sevenDaysAgo, tomorrow)
    ]);

    // --- 7-day trend (group appointments by date) ---
    const trendMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      trendMap[key] = { date: d.toLocaleDateString("vi-VN", { day: "numeric", month: "short" }), count: 0 };
    }
    allAppointments.forEach(a => {
      if (a.status !== "cancelled") {
        const key = new Date(a.date).toISOString().split("T")[0];
        if (trendMap[key]) trendMap[key].count++;
      }
    });
    const weeklyTrend = Object.values(trendMap);

    // --- Monthly trend (last 6 months) ---
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthAppts = allAppointments.filter(a => {
        const ad = new Date(a.date);
        return ad >= d && ad <= nextMonth && a.status !== "cancelled";
      });
      monthlyTrend.push({
        month: d.toLocaleDateString("vi-VN", { month: "short", year: "2-digit" }),
        count: monthAppts.length
      });
    }

    // --- Today's appointments count ---
    const todayAppts = allAppointments.filter(a => {
      const ad = new Date(a.date);
      return ad >= today && ad < tomorrow && a.status !== "cancelled";
    });

    // --- Vaccine stock data for bar chart (all vaccines, sorted by stock) ---
    const vaccineStockData = allVaccines
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 8)  // top 8 lowest stock
      .map(v => ({
        name: v.name.length > 20 ? v.name.substring(0, 18) + "…" : v.name,
        stock: v.stock,
        low: v.stock < 10
      }));

    return {
      userCount,
      childCount,
      vaccineCount,
      todayAppointments: todayAppts.length,
      weeklyTrend,
      monthlyTrend,
      appointmentStatusDistribution: {
        pending: pendingCount,
        confirmed: confirmedCount,
        completed: completedCount,
        cancelled: cancelledCount
      },
      stockAlerts,
      vaccineStockData
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

    const oldStatus = appointment.status;
    appointment.status = status;
    const updated = await appointmentRepo.update(appointment);

    // Send notification to parent on status change
    try {
      const notificationService = new NotificationService();
      // Load parent relation if not loaded
      if (!appointment.child || !appointment.child.parent) {
        const childRepo = new ChildRepository();
        const child = await childRepo.findById(appointment.child.id);
        appointment.child = child;
      }
      const parent = appointment.child.parent;
      if (parent) {
        const vaccineRepo = new VaccineRepository();
        const vaccine = appointment.vaccine && appointment.vaccine.id
          ? await vaccineRepo.findById(appointment.vaccine.id)
          : null;
        const vaccineName = vaccine ? vaccine.name : 'vắc xin';
        const childName = appointment.child.name;
        const dateStr = new Date(appointment.date).toLocaleString('vi-VN');

        if (status === 'confirmed') {
          await notificationService.sendAppointmentReminder(
            parent, childName, vaccineName, appointment.date
          );
          await notificationService.createInAppNotification(
            parent.id,
            "Lịch tiêm chủng đã được xác nhận!",
            `Lịch tiêm ${vaccineName} cho bé ${childName} ngày ${dateStr} đã được xác nhận. Vui lòng đưa bé đến đúng giờ.`
          );
        } else if (status === 'cancelled') {
          await notificationService.createInAppNotification(
            parent.id,
            "Lịch tiêm chủng đã bị hủy",
            `Lịch tiêm ${vaccineName} cho bé ${childName} ngày ${dateStr} đã bị hủy. Vui lòng đặt lịch lại nếu cần.`
          );
        } else if (status === 'completed') {
          await notificationService.createInAppNotification(
            parent.id,
            "Mũi tiêm đã hoàn thành!",
            `Bé ${childName} đã hoàn thành mũi tiêm ${vaccineName} ngày ${dateStr}. Cảm ơn bạn đã tin tưởng VaxiCare!`
          );
        }
      }
    } catch (notifError) {
      console.error('[AdminService] Lỗi gửi thông báo khi cập nhật trạng thái:', notifError.message);
      // Don't throw - notification failure shouldn't block the status update
    }

    return updated;
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
    const appointmentRepo = new AppointmentRepository();
    const configs = await slotConfigRepo.findByDateRange(startDate, endDate);

    const dayNames = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysInMonth = [];

    for (let d = 1; d <= endDate.getDate(); d++) {
      const date = new Date(currentYear, currentMonth - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      const config = configs.find(c => c.date === dateStr);

      // Fetch booked counts for this date
      const bookedCount = await appointmentRepo.countByDate(date);
      const morningBooked = await appointmentRepo.countByDateAndSession(date, "morning");
      const afternoonBooked = await appointmentRepo.countByDateAndSession(date, "afternoon");

      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      daysInMonth.push({
        day: d,
        dayName: dayNames[date.getDay()],
        date: dateStr,
        maxSlots: config ? config.maxSlots : 50,
        morningSlots: config ? (config.morningSlots || 25) : 25,
        afternoonSlots: config ? (config.afternoonSlots || 25) : 25,
        morningBooked,
        afternoonBooked,
        morningAvailable: (config ? (config.morningSlots || 25) : 25) - morningBooked,
        afternoonAvailable: (config ? (config.afternoonSlots || 25) : 25) - afternoonBooked,
        bookedCount,
        availableSlots: (config ? config.maxSlots : 50) - bookedCount,
        isDayOff: config ? config.isDayOff : isWeekend,
        note: config ? config.note : null,
        hasConfig: !!config,
        isPast: date < todayStart,
        isWeekend
      });
    }

    return { daysInMonth, currentMonth, currentYear };
  }

  async updateScheduleConfig(date, data) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new Error("Ngày không hợp lệ");
    }

    const maxSlots = parseInt(data.maxSlots);
    const morningSlots = parseInt(data.morningSlots);
    const afternoonSlots = parseInt(data.afternoonSlots);

    if (isNaN(maxSlots) || maxSlots < 0 || maxSlots > 1000) {
      throw new Error("Tổng slot phải từ 0-1000");
    }
    if (isNaN(morningSlots) || morningSlots < 0 || morningSlots > maxSlots) {
      throw new Error("Slot buổi sáng phải từ 0 và không vượt quá tổng slot");
    }
    if (isNaN(afternoonSlots) || afternoonSlots < 0 || afternoonSlots > maxSlots) {
      throw new Error("Slot buổi chiều phải từ 0 và không vượt quá tổng slot");
    }

    const slotConfigRepo = new DailySlotConfigRepository();
    return await slotConfigRepo.upsertFull(date, {
      maxSlots,
      morningSlots,
      afternoonSlots,
      isDayOff: !!data.isDayOff,
      note: data.note || null
    });
  }

  // Bulk-configure weekdays for a month (sets same values for all weekdays)
  async bulkUpdateSchedule(month, year, data) {
    const m = parseInt(month);
    const y = parseInt(year);
    if (!m || m < 1 || m > 12) throw new Error("Tháng không hợp lệ");

    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0);
    const slotConfigRepo = new DailySlotConfigRepository();

    const maxSlots = parseInt(data.maxSlots);
    const morningSlots = parseInt(data.morningSlots);
    const afternoonSlots = parseInt(data.afternoonSlots);
    const isDayOff = !!data.isDayOff;

    if (isNaN(maxSlots) || maxSlots < 0 || maxSlots > 1000) {
      throw new Error("Slot phải từ 0-1000");
    }

    const results = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      // Skip weekends unless explicitly configured
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      const dateStr = d.toISOString().split('T')[0];
      const result = await slotConfigRepo.upsertFull(dateStr, {
        maxSlots,
        morningSlots,
        afternoonSlots,
        isDayOff,
        note: data.note || null
      });
      results.push(result);
    }
    return results;
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

  async updateChild(id, data) {
    const childRepo = new ChildRepository();
    const child = await childRepo.findById(parseInt(id));
    if (!child) throw new Error("Không tìm thấy hồ sơ trẻ");

    // Validate DOB
    const dob = new Date(data.dob);
    const now = new Date();
    if (isNaN(dob.getTime())) throw new Error("Ngày sinh không hợp lệ");
    if (dob > now) throw new Error("Ngày sinh không thể là ngày trong tương lai");

    child.name = data.name;
    child.dob = data.dob;
    child.gender = data.gender;
    if (data.parentId) {
      child.parent = { id: parseInt(data.parentId) };
    }
    return await childRepo.update(child);
  }

  async deleteChild(id) {
    const childRepo = new ChildRepository();
    return await childRepo.delete(parseInt(id));
  }

  async getParents() {
    const userRepo = new UserRepository();
    return await userRepo.findAll(0, 1000, "parent");
  }
}

module.exports = AdminService;
