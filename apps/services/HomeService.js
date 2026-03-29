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
        const progress = this._calculateProgress(child.id, allVaccines, childAppointments);
        const recommendations = this._getRecommendations(child.id, child.dob, allVaccines, childAppointments);
        const nextMilestone = recommendations.length > 0
          ? recommendations[0].name
          : "Tất cả các mũi tiêm đã hoàn thành!";
        return { ...child, progress, nextMilestone };
      } catch (err) {
        console.error(`Error calculating progress for child ${child.id}:`, err);
        return { ...child, progress: null, nextMilestone: "Đang cập nhật..." };
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
    const maxSlots = config ? config.maxSlots : 50;
    const bookedCount = await this.appointmentRepo.countByDate(date);

    return { maxSlots, bookedCount, availableSlots: maxSlots - bookedCount };
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
    if (appointmentDate <= new Date()) {
      throw new Error("Ngày hẹn phải là ngày trong tương lai.");
    }

    const slotInfo = await this.getSlotInfo(appointmentDate);
    if (slotInfo.availableSlots <= 0) {
      throw new Error("Ngày này đã đầy lịch hẹn.");
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

    let vaccine = null;
    if (vaccineId) {
      vaccine = await this.vaccineRepo.findById(parseInt(vaccineId));
      if (!vaccine) {
        throw new Error("Vắc xin không tồn tại.");
      }
      if (vaccine.stock <= 0) {
        throw new Error("Vắc xin này hiện đã hết hàng. Vui lòng chọn vắc xin khác.");
      }
    }

    const appointment = this.appointmentRepo.create({
      date: appointmentDate,
      notes: notes || null,
      status: (userRole === 'admin' || userRole === 'staff') ? "confirmed" : "pending",
      child: { id: parseInt(childId) },
      vaccine: { id: parseInt(vaccineId) }
    });

    const result = await this.appointmentRepo.insert(appointment);

    // Deduct stock after successful appointment creation
    if (vaccine) {
      vaccine.stock -= 1;
      await this.vaccineRepo.update(vaccine);
    }

    return result;
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

    // Refund stock upon cancellation
    if (appointment.vaccine && appointment.vaccine.id) {
        const vaccine = await this.vaccineRepo.findById(appointment.vaccine.id);
        if (vaccine) {
            vaccine.stock += 1;
            await this.vaccineRepo.update(vaccine);
        }
    }

    return result;
  }
}

module.exports = HomeService;
