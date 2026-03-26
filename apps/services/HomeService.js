const ChildRepository = require("../repositories/ChildRepository");
const VaccineRepository = require("../repositories/VaccineRepository");
const AppointmentRepository = require("../repositories/AppointmentRepository");
const DailySlotConfigRepository = require("../repositories/DailySlotConfigRepository");
const UserRepository = require("../repositories/UserRepository");
const { AppDataSource } = require("../models/data-source");

class HomeService {
  async getDashboardData(userId) {
    const childRepo = new ChildRepository();
    const children = await childRepo.findByParentId(userId);

    const childIds = children.map(c => c.id);
    let upcomingAppointments = [];
    
    // Enrich children with progress info
    const enrichedChildren = await Promise.all(children.map(async (child) => {
      try {
        const progress = await this.getChildVaccinationProgress(child.id);
        return { ...child, progress };
      } catch (err) {
        console.error(`Error calculating progress for child ${child.id}:`, err);
        return { ...child, progress: null };
      }
    }));

    if (childIds.length > 0) {
      const appointmentRepo = new AppointmentRepository();
      const allAppointments = await appointmentRepo.findByChildIds(childIds);

      const now = new Date();
      upcomingAppointments = allAppointments.filter(
        a => new Date(a.date) >= now && a.status !== "cancelled" && a.status !== "completed"
      );
    }

    return { children: enrichedChildren, upcomingAppointments };
  }

  async getParents() {
    const userRepo = new UserRepository();
    return await userRepo.findAll(0, 1000, 'parent');
  }

  async addChild(data) {
    const { name, dob, gender, parentId } = data;
    if (!name || !dob || !gender || !parentId) {
      throw new Error("Vui lòng nhập đủ thông tin (bao gồm ID phụ huynh).");
    }

    const childRepo = new ChildRepository();
    const child = childRepo.create({
      name,
      dob,
      gender,
      parent: { id: parseInt(parentId) }
    });
    return await childRepo.insert(child);
  }

  async getChildrenForBooking(userId, userRole) {
    const childRepo = new ChildRepository();
    if (userRole === 'admin' || userRole === 'staff') {
      return await childRepo.findAll(0, 1000); // Admin/Staff can book for any child
    }
    return await childRepo.findByParentId(userId);
  }

  async getVaccinesForBooking() {
    const vaccineRepo = new VaccineRepository();
    return await vaccineRepo.findAll(0, 100);
  }

  async getRecommendedVaccines(childId) {
    const childRepo = new ChildRepository();
    const child = await childRepo.findById(childId);
    if (!child) return [];

    // Calculate age in months
    const dob = new Date(child.dob);
    const now = new Date();
    const ageMonths = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());

    // Get all vaccines
    const vaccineRepo = new VaccineRepository();
    const allVaccines = await vaccineRepo.findAll(0, 100);

    // Get child's vaccine history
    const appointmentRepo = new AppointmentRepository();
    const history = await appointmentRepo.findByChildIds([childId]);
    const completedVaccineIds = history
      .filter(a => a.status === 'completed')
      .map(a => a.vaccine.id);

    // Filter: Recommended age fits AND not already completed
    return allVaccines.filter(v => {
      const isRecommended = v.recommendedAgeMonths !== null && ageMonths >= v.recommendedAgeMonths;
      const isNotDone = !completedVaccineIds.includes(v.id);
      return isRecommended && isNotDone;
    });
  }

  async getSlotInfo(date) {
    const appointmentRepo = new AppointmentRepository();
    const slotConfigRepo = new DailySlotConfigRepository();

    const dateStr = date.toISOString().split("T")[0];
    const config = await slotConfigRepo.findByDate(dateStr);
    const maxSlots = config ? config.maxSlots : 50;
    const bookedCount = await appointmentRepo.countByDate(date);

    return { maxSlots, bookedCount, availableSlots: maxSlots - bookedCount };
  }

  async bookAppointment(userId, data, userRole) {
    const { childId, vaccineId, date, notes } = data;

    // Validate child
    const childRepo = new ChildRepository();
    const child = await childRepo.findById(parseInt(childId));
    if (!child) {
      throw new Error("Trẻ không tồn tại");
    }

    // Role check: Only owners can book, unless caller is Admin/Staff
    if (userRole !== 'admin' && userRole !== 'staff' && child.parent.id !== userId) {
      throw new Error("Bạn không có quyền đặt lịch cho trẻ này.");
    }

    // Validate date
    const appointmentDate = new Date(date);
    if (appointmentDate <= new Date()) {
      throw new Error("Ngày hẹn phải là ngày trong tương lai.");
    }

    // Check slot availability
    const slotInfo = await this.getSlotInfo(appointmentDate);
    if (slotInfo.availableSlots <= 0) {
      throw new Error("Ngày này đã đầy lịch hẹn.");
    }

    const appointmentRepo = new AppointmentRepository();
    const appointment = appointmentRepo.create({
      date: appointmentDate,
      notes: notes || null,
      status: (userRole === 'admin' || userRole === 'staff') ? "confirmed" : "pending",
      child: { id: parseInt(childId) },
      vaccine: { id: parseInt(vaccineId) }
    });
    return await appointmentRepo.insert(appointment);
  }

  async getUpcomingAppointments(userId) {
    const childRepo = new ChildRepository();
    const children = await childRepo.findByParentId(userId);
    const childIds = children.map(c => c.id);

    if (childIds.length === 0) return [];

    const appointmentRepo = new AppointmentRepository();
    const allAppointments = await appointmentRepo.findByChildIds(childIds);

    const now = new Date();
    return allAppointments.filter(
      a => new Date(a.date) >= now && a.status !== "cancelled" && a.status !== "completed"
    );
  }
}

module.exports = HomeService;
