/**
 * RoadmapService
 * Xay dung lo trinh tiem chung theo phac do WHO cho tung be
 * Dua tren recommendedAgeMonths cua vaccine va lich su tiem cua be.
 */

const VaccineRepository = require("../repositories/VaccineRepository");
const AppointmentRepository = require("../repositories/AppointmentRepository");
const ChildRepository = require("../repositories/ChildRepository");

class RoadmapService {
  constructor() {
    this.vaccineRepo = new VaccineRepository();
    this.appointmentRepo = new AppointmentRepository();
    this.childRepo = new ChildRepository();
  }

  /** Tinh so thang giua hai ngay */
  _monthsBetween(start, end) {
    return (end.getFullYear() - start.getFullYear()) * 12
      + (end.getMonth() - start.getMonth());
  }

  /** Format nhan thang tuoi tu so thang */
  _formatAgeLabel(months) {
    if (months <= 0) return "Sơ sinh";
    if (months === 1) return "1 tháng";
    if (months < 12) return `${months} tháng`;
    const y = Math.floor(months / 12);
    const m = months % 12;
    if (m === 0) return `${y} tuổi`;
    return `${y} tuổi ${m} tháng`;
  }

  /** Tra ve nhan milestone tu so thang */
  _getMilestoneLabel(months) {
    if (months === 0) return "Sơ sinh (ngay khi sinh)";
    if (months === 2) return "2 tháng tuổi";
    if (months === 4) return "4 tháng tuổi";
    if (months === 6) return "6 tháng tuổi";
    if (months === 9) return "9 tháng tuổi";
    if (months === 12) return "1 tuổi";
    if (months === 15) return "15 tháng tuổi";
    if (months === 18) return "18 tháng tuổi";
    if (months === 24) return "2 tuổi";
    if (months === 36) return "3 tuổi";
    if (months === 48) return "4 tuổi";
    if (months === 60) return "5 tuổi";
    if (months === 72) return "6 tuổi";
    if (months === 84) return "7 tuổi";
    if (months === 96) return "8 tuổi";
    if (months === 108) return "9 tuổi";
    if (months === 144) return "12 tuổi";
    return this._formatAgeLabel(months);
  }

  /** Tinh ngay milestone */
  _milestoneDate(dob, ageMonths) {
    const d = new Date(dob);
    d.setMonth(d.getMonth() + ageMonths);
    return d;
  }

  /** Lay danh sach cac thang co milestone theo phac do WHO */
  _getMilestoneMonths() {
    return [0, 2, 4, 6, 9, 12, 15, 18, 24, 36, 48, 60, 72, 84, 96, 108, 144];
  }

  /** Lay milestone chinh xac nhat cho mot vaccine (khong trung lap) */
  _getVaccineMilestone(recommendedAgeMonths) {
    if (recommendedAgeMonths === null || recommendedAgeMonths === undefined) return null;
    const ms = this._getMilestoneMonths();
    // Tim milestone nho nhat ma >= recommendedAgeMonths
    const found = ms.find(m => m >= recommendedAgeMonths);
    return found !== undefined ? found : ms[ms.length - 1];
  }

  /** Kiem tra milestone co trong thang nay khong */
  _isDueThisMonth(milestoneDate, now) {
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return milestoneDate >= thisMonth && milestoneDate <= nextMonth;
  }

  /** Kiem tra milestone trong 3 thang toi */
  _isUpcomingSoon(milestoneDate, now) {
    const threeMonthsLater = new Date(now.getFullYear(), now.getMonth() + 3, 1);
    return milestoneDate > now && milestoneDate <= threeMonthsLater;
  }

  /** Build roadmap day du cho mot be */
  buildRoadmap(child, allAppointments, allVaccines) {
    const now = new Date();
    const dob = new Date(child.dob);
    const childAgeMonths = this._monthsBetween(dob, now);

    // ---- Completed vaccine IDs (unique) ----
    const completed = allAppointments.filter(a => a.status === "completed");
    const completedVaccineIds = new Set(
      completed
        .filter(a => a.vaccine && a.vaccine.id)
        .map(a => a.vaccine.id)
    );

    // ---- Tao ban do vaccineId -> milestone chinh xac ----
    const vaccineToMilestone = {};
    allVaccines.forEach(v => {
      if (v.recommendedAgeMonths !== null && v.recommendedAgeMonths !== undefined) {
        vaccineToMilestone[v.id] = this._getVaccineMilestone(v.recommendedAgeMonths);
      }
    });

    // ---- Tinh stats ----
    const overdueCount = 0;
    const dueNowCount = 0;
    const upcomingSoonCount = 0;

    // ---- Build milestones ----
    const milestoneMonths = this._getMilestoneMonths();
    const milestones = [];

    for (const msMonths of milestoneMonths) {
      // Chi hien thi milestone trong pham vi childAge + 18 thang
      if (msMonths > childAgeMonths + 18) break;

      const msDate = this._milestoneDate(dob, msMonths);
      const msLabel = this._getMilestoneLabel(msMonths);

      // Vaccine gan nhat voi milestone nay (theo recommendedAgeMonths)
      const vaccinesAtMs = allVaccines
        .filter(v => vaccineToMilestone[v.id] === msMonths)
        .map(v => ({
          ...v,
          done: completedVaccineIds.has(v.id)
        }));

      const doneCount = vaccinesAtMs.filter(v => v.done).length;
      const totalCount = vaccinesAtMs.length;

      // Xac dinh trang thai milestone
      let status = "future";
      const overdue = msDate < now && msMonths <= childAgeMonths;

      if (overdue && doneCount < totalCount) {
        status = "overdue";
      } else if (this._isDueThisMonth(msDate, now)) {
        status = "due_now";
      } else if (this._isUpcomingSoon(msDate, now)) {
        status = "upcoming_soon";
      } else if (msMonths <= childAgeMonths) {
        status = "completed";
      }

      milestones.push({
        months: msMonths,
        date: msDate.toISOString().split("T")[0],
        label: msLabel,
        status,
        vaccines: vaccinesAtMs,
        doneCount,
        totalCount,
        overdue: overdue && doneCount < totalCount
      });
    }

    // ---- Stats tong quan ----
    const overdueMilestones = milestones.filter(m => m.status === "overdue");
    const dueNowMilestones = milestones.filter(m => m.status === "due_now");
    const upcomingSoonMilestones = milestones.filter(m => m.status === "upcoming_soon");

    const totalVaccineTypes = new Set(
      allVaccines
        .filter(v => v.recommendedAgeMonths !== null && v.recommendedAgeMonths !== undefined)
        .map(v => v.id)
    ).size;

    const completedCount = completedVaccineIds.size;
    const progressPercent = totalVaccineTypes > 0
      ? Math.min(Math.round((completedCount / totalVaccineTypes) * 100), 100)
      : 0;

    // ---- Next actions ----
    const nextActions = [];

    if (overdueMilestones.length > 0) {
      overdueMilestones.forEach(m => {
        m.vaccines.filter(v => !v.done).slice(0, 5).forEach(v => {
          nextActions.push({
            type: "overdue",
            priority: 0,
            vaccine: v,
            milestoneLabel: m.label,
            milestoneDate: m.date,
            childId: child.id
          });
        });
      });
    } else if (dueNowMilestones.length > 0) {
      dueNowMilestones.forEach(m => {
        m.vaccines.filter(v => !v.done).slice(0, 5).forEach(v => {
          nextActions.push({
            type: "due_now",
            priority: 1,
            vaccine: v,
            milestoneLabel: m.label,
            milestoneDate: m.date,
            childId: child.id
          });
        });
      });
    } else {
      // Tim milestone tiep theo co vaccine chua xong
      const nextMs = milestones
        .filter(m => m.status === "upcoming_soon" || m.status === "future")
        .find(m => m.vaccines.some(v => !v.done));

      if (nextMs) {
        nextMs.vaccines.filter(v => !v.done).slice(0, 3).forEach(v => {
          nextActions.push({
            type: "upcoming",
            priority: 2,
            vaccine: v,
            milestoneLabel: nextMs.label,
            milestoneDate: nextMs.date,
            childId: child.id
          });
        });
      }
    }

    return {
      child: {
        id: child.id,
        name: child.name,
        dob: child.dob,
        ageMonths: childAgeMonths,
        ageLabel: this._formatAgeLabel(childAgeMonths)
      },
      milestones,
      nextActions,
      stats: {
        completedCount,
        totalVaccineTypes,
        progressPercent,
        overdueCount: overdueMilestones.length,
        dueNowCount: dueNowMilestones.length,
        upcomingSoonCount: upcomingSoonMilestones.length
      },
      generatedAt: now.toISOString()
    };
  }

  /** Lay roadmap cho mot be (goi tu controller) */
  async getRoadmapForChild(childId) {
    const child = await this.childRepo.findById(childId);
    if (!child) return null;

    const [allVaccines, allAppointments] = await Promise.all([
      this.vaccineRepo.findAll(0, 500),
      this.appointmentRepo.findByChildId(childId)
    ]);

    return this.buildRoadmap(child, allAppointments, allVaccines);
  }

  /** Lay roadmaps cho nhieu be (cho dashboard) */
  async getRoadmapsForChildren(children, allAppointmentsByChildId) {
    const allVaccines = await this.vaccineRepo.findAll(0, 500);
    return children.map(child => {
      const appts = allAppointmentsByChildId[child.id] || [];
      return this.buildRoadmap(child, appts, allVaccines);
    });
  }
}

module.exports = RoadmapService;
