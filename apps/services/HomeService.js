const ChildRepository = require("../repositories/ChildRepository");
const VaccineRepository = require("../repositories/VaccineRepository");
const AppointmentRepository = require("../repositories/AppointmentRepository");
const DailySlotConfigRepository = require("../repositories/DailySlotConfigRepository");
const UserRepository = require("../repositories/UserRepository");
const { AppDataSource } = require("../models/data-source");

class HomeService {
  constructor() {
    this.childRepo = new ChildRepository();
    this.vaccineRepo = new VaccineRepository();
    this.appointmentRepo = new AppointmentRepository();
    this.slotConfigRepo = new DailySlotConfigRepository();
    this.userRepo = new UserRepository();
  }

  // Pre-fetching injected to avoid N+1
  _calculateProgress(childId, allVaccines, childAppointments) {
    if (allVaccines.length === 0) return 0;
    const completedCount = new Set(
      childAppointments.filter(a => a.status === 'completed' && a.vaccine && a.vaccine.id).map(a => a.vaccine.id)
    ).size;
    return Math.min(Math.round((completedCount / allVaccines.length) * 100), 100);
  }

  _getRecommendations(childId, childDob, allVaccines, childAppointments) {
    const dob = new Date(childDob);
    const now = new Date();
    const ageMonths = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());

    const completedVaccineIds = childAppointments
      .filter(a => a.status === 'completed' && a.vaccine)
      .map(a => a.vaccine.id);

    return allVaccines.filter(v => {
      const isRecommended = v.recommendedAgeMonths !== null && ageMonths >= v.recommendedAgeMonths;
      const isNotDone = !completedVaccineIds.includes(v.id);
      return isRecommended && isNotDone;
    });
  }

  _getDetailedStats(allVaccines, childAppointments) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const completed = childAppointments.filter(a => a.status === 'completed');
    const confirmed = childAppointments.filter(a => a.status === 'confirmed');
    const pending = childAppointments.filter(a => a.status === 'pending');
    const missed = childAppointments.filter(a =>
      a.status !== 'cancelled' && a.status !== 'completed' && new Date(a.date) < todayStart
    );
    const upcoming = [...confirmed, ...pending].filter(a => new Date(a.date) >= todayStart);

    // Count unique vaccines completed
    const completedVaccineIds = new Set(
      completed.filter(a => a.vaccine && a.vaccine.id).map(a => a.vaccine.id)
    );
    const totalVaccines = allVaccines.length;

    return {
      completedCount: completedVaccineIds.size,
      totalVaccines,
      progressPercent: totalVaccines > 0
        ? Math.min(Math.round((completedVaccineIds.size / totalVaccines) * 100), 100)
        : 0,
      upcomingCount: upcoming.length,
      missedCount: missed.length,
      pendingCount: pending.length,
      confirmedCount: confirmed.length,
      completedNames: completed
        .filter(a => a.vaccine && a.vaccine.name)
        .map(a => a.vaccine.name)
    };
  }

  async getChildVaccinationProgress(childId) {
     const allVaccines = await this.vaccineRepo.findAll(0, 500);
     const appointments = await this.appointmentRepo.findByChildId(childId);
     return this._calculateProgress(childId, allVaccines, appointments);
  }

  async getDashboardData(userId) {
    const children = await this.childRepo.findByParentId(userId);
    const childIds = children.map(c => c.id);
    let upcomingAppointments = [];
    
    // Fetch all required data once to prevent N+1 queries
    const allVaccines = await this.vaccineRepo.findAll(0, 500);
    const allAppointments = childIds.length > 0 ? await this.appointmentRepo.findByChildIds(childIds) : [];

    // Enrich children with progress info and next milestone using in-memory data
    const enrichedChildren = children.map((child) => {
      try {
        const childAppointments = allAppointments.filter(a => a.child && a.child.id === child.id);
        const stats = this._getDetailedStats(allVaccines, childAppointments);
        const recommendations = this._getRecommendations(child.id, child.dob, allVaccines, childAppointments);
        const nextMilestone = recommendations.length > 0
          ? recommendations[0].name
          : "Tất cả các mũi tiêm đã hoàn thành!";
        return { ...child, ...stats, nextMilestone };
      } catch (err) {
        console.error(`Error calculating progress for child ${child.id}:`, err);
        return { ...child, progressPercent: 0, completedCount: 0, totalVaccines: 0,
          upcomingCount: 0, missedCount: 0, nextMilestone: "Đang cập nhật..." };
      }
    });

    if (childIds.length > 0) {
      const now = new Date();
      upcomingAppointments = allAppointments.filter(
        a => new Date(a.date) >= now && a.status !== "cancelled" && a.status !== "completed"
      );
    }

    return { children: enrichedChildren, upcomingAppointments };
  }

  async getParents() {
    return await this.userRepo.findAll(0, 1000, 'parent');
  }

  async addChild(data) {
    const { name, dob, gender, parentId } = data;
    if (!name || !dob || !gender || !parentId) {
      throw new Error("Vui lòng nhập đủ thông tin (bao gồm ID phụ huynh).");
    }

    const child = this.childRepo.create({
      name,
      dob,
      gender,
      parent: { id: parseInt(parentId) }
    });
    return await this.childRepo.insert(child);
  }

  async getChildrenForBooking(userId, userRole) {
    if (userRole === 'admin' || userRole === 'staff') {
      return await this.childRepo.findAll(0, 1000); // Admin/Staff can book for any child
    }
    return await this.childRepo.findByParentId(userId);
  }

  async getVaccinesForBooking() {
    return await this.vaccineRepo.findAll(0, 500);
  }

  async getRecommendedVaccines(childId) {
    const child = await this.childRepo.findById(childId);
    if (!child) return [];
    const allVaccines = await this.vaccineRepo.findAll(0, 500);
    const history = await this.appointmentRepo.findByChildIds([childId]);
    return this._getRecommendations(childId, child.dob, allVaccines, history);
  }

  async getSlotInfo(date) {
    const dateStr = date.toISOString().split("T")[0];
    const config = await this.slotConfigRepo.findByDate(dateStr);

    // --- Block past dates ---
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (date < todayStart) {
      return { maxSlots: 0, bookedCount: 0, availableSlots: 0, dayOff: true, message: "Ngày đã qua." };
    }

    // --- Block weekends ---
    const dayOfWeek = date.getDay(); // 0 = CN, 6 = T7
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return { maxSlots: 0, bookedCount: 0, availableSlots: 0, dayOff: true, message: "Không nhận đặt lịch vào cuối tuần." };
    }

    // --- Check if admin marked as day off ---
    if (config && config.isDayOff) {
      return { maxSlots: 0, bookedCount: 0, availableSlots: 0, dayOff: true, message: config.note || "Ngày nghỉ, không nhận đặt lịch." };
    }

    const maxSlots = config ? config.maxSlots : 50;
    const morningSlots = config ? (config.morningSlots || 25) : 25;
    const afternoonSlots = config ? (config.afternoonSlots || 25) : 25;

    const bookedCount = await this.appointmentRepo.countByDate(date);
    const morningBooked = await this.appointmentRepo.countByDateAndSession(date, "morning");
    const afternoonBooked = await this.appointmentRepo.countByDateAndSession(date, "afternoon");

    return {
      maxSlots,
      bookedCount,
      availableSlots: maxSlots - bookedCount,
      morningSlots,
      afternoonSlots,
      morningBooked,
      afternoonBooked,
      morningAvailable: morningSlots - morningBooked,
      afternoonAvailable: afternoonSlots - afternoonBooked
    };
  }

  // Determines if a time falls within working hours (default 07:30 - 17:00)
  _isWithinWorkingHours(hour) {
    const start = 7;  // 7:00 AM
    const end = 17;   // 5:00 PM (exclusive — last slot starts at 16:30)
    return hour >= start && hour < end;
  }

  // Extract session (morning/afternoon) from appointment time
  _getSessionFromTime(date) {
    const hours = date.getHours();
    if (hours < 12) return "morning";
    return "afternoon";
  }

  async bookAppointment(userId, data, userRole) {
    const { childId, vaccineId, date, notes } = data;

    if (!childId || isNaN(parseInt(childId))) throw new Error("ID trẻ em không hợp lệ");
    if (!vaccineId || isNaN(parseInt(vaccineId))) throw new Error("ID vắc xin không hợp lệ");

    const child = await this.childRepo.findById(parseInt(childId));
    if (!child) throw new Error("Trẻ không tồn tại");

    if (userRole !== 'admin' && userRole !== 'staff' && child.parent.id !== userId) {
      throw new Error("Bạn không có quyền đặt lịch cho trẻ này.");
    }

    const appointmentDate = new Date(date);

    // --- Block past dates ---
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (appointmentDate < todayStart) {
      throw new Error("Ngày hẹn không hợp lệ (đã qua).");
    }

    // --- Block weekends ---
    const dayOfWeek = appointmentDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      throw new Error("Không nhận đặt lịch vào cuối tuần. Vui lòng chọn ngày trong tuần.");
    }

    // --- Working hours validation ---
    const hour = appointmentDate.getHours();
    if (!this._isWithinWorkingHours(hour)) {
      throw new Error("Giờ hẹn phải trong khoảng 07:30 - 17:00.");
    }

    const slotInfo = await this.getSlotInfo(appointmentDate);

    // --- Check day-off flag ---
    if (slotInfo.dayOff) {
      throw new Error(slotInfo.message || "Ngày này không nhận đặt lịch.");
    }

    if (slotInfo.availableSlots <= 0) {
      throw new Error("Ngày này đã đầy lịch hẹn. Vui lòng chọn ngày khác.");
    }

    // --- Session-based slot check ---
    const session = this._getSessionFromTime(appointmentDate);
    if (session === "morning" && slotInfo.morningAvailable <= 0) {
      throw new Error("Buổi sáng ngày này đã đầy. Vui lòng chọn buổi chiều hoặc ngày khác.");
    }
    if (session === "afternoon" && slotInfo.afternoonAvailable <= 0) {
      throw new Error("Buổi chiều ngày này đã đầy. Vui lòng chọn buổi sáng hoặc ngày khác.");
    }

    const existingAppointments = await this.appointmentRepo.findByChildIds([parseInt(childId)]);
    const duplicate = existingAppointments.find(a =>
      a.vaccine && a.vaccine.id === parseInt(vaccineId) &&
      new Date(a.date).toDateString() === appointmentDate.toDateString() &&
      a.status !== 'cancelled'
    );
    if (duplicate) {
      throw new Error("Trẻ đã có lịch tiêm vắc xin này vào ngày đã chọn.");
    }

    // --- Validate vaccine exists (stock check is done atomically in transaction) ---
    if (vaccineId) {
      const vaccine = await this.vaccineRepo.findById(parseInt(vaccineId));
      if (!vaccine) throw new Error("Vắc xin không tồn tại.");
    }

    // --- Execute booking + stock decrement in a single transaction ---
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Insert appointment
      const appointment = {
        date: appointmentDate,
        notes: notes || null,
        session,
        status: (userRole === 'admin' || userRole === 'staff') ? "confirmed" : "pending",
        child: { id: parseInt(childId) },
        vaccine: { id: parseInt(vaccineId) }
      };
      const result = await queryRunner.manager.save("Appointment", appointment);

      // 2. Atomic stock decrement — returns 0 if out of stock (race-safe)
      if (vaccineId) {
        const affected = await queryRunner.manager
          .createQueryBuilder()
          .update("vaccines")
          .set({ stock: () => "stock - 1" })
          .where("id = :id AND stock > 0", { id: parseInt(vaccineId) })
          .execute();

        if (!affected.affected || affected.affected === 0) {
          throw new Error("Vắc xin này hiện đã hết hàng. Vui lòng chọn vắc xin khác.");
        }
      }

      await queryRunner.commitTransaction();
      return result;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getUpcomingAppointments(userId) {
    const children = await this.childRepo.findByParentId(userId);
    const childIds = children.map(c => c.id);

    if (childIds.length === 0) return [];

    const allAppointments = await this.appointmentRepo.findByChildIds(childIds);
    const now = new Date();
    return allAppointments.filter(
      a => new Date(a.date) >= now && a.status !== "cancelled" && a.status !== "completed"
    );
  }

  async getVaccineDetail(vaccineId) {
    if (!vaccineId || isNaN(parseInt(vaccineId))) throw new Error("ID không hợp lệ");
    const vaccine = await this.vaccineRepo.findById(parseInt(vaccineId));
    if (!vaccine) throw new Error("Vắc xin không tồn tại");
    return vaccine;
  }

  async cancelAppointment(appointmentId, userId, userRole) {
    if (!appointmentId || isNaN(parseInt(appointmentId))) throw new Error("ID lịch hẹn không hợp lệ");

    const appointment = await this.appointmentRepo.findById(parseInt(appointmentId));
    if (!appointment) throw new Error("Lịch hẹn không tồn tại");

    if (userRole === 'parent') {
      const child = await this.childRepo.findById(appointment.child.id);
      if (!child || child.parent.id !== userId) {
        throw new Error("Bạn không có quyền hủy lịch hẹn này.");
      }
    }

    if (['cancelled', 'completed'].includes(appointment.status)) {
      throw new Error("Không thể hủy lịch hẹn ở trạng thái này.");
    }

    appointment.status = "cancelled";
    const result = await this.appointmentRepo.update(appointment);

    // Atomic stock refund — safe even if vaccine was already deleted
    if (appointment.vaccine && appointment.vaccine.id) {
      await this.vaccineRepo.incrementStock(appointment.vaccine.id);
    }

    return result;
  }
}

module.exports = HomeService;
