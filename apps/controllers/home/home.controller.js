const express = require("express");
const router = express.Router();
const { AppDataSource } = require("../../models/data-source");
const { authenticate, authorizeRoles } = require("../auth/auth.middleware");

const childRepo = () => AppDataSource.getRepository("Child");
const appointmentRepo = () => AppDataSource.getRepository("Appointment");
const slotConfigRepo = () => AppDataSource.getRepository("DailySlotConfig");
const vaccineRepo = () => AppDataSource.getRepository("Vaccine");

// Require authentication for all home routes
router.use(authenticate, authorizeRoles("parent"));

// Helper Function
const getSlotInfo = async (date) => {
    const dateStr = date.toISOString().split("T")[0];
    const config = await slotConfigRepo().findOne({ where: { date: dateStr } });
    const maxSlots = config ? config.maxSlots : 50;
    const bookedCount = await appointmentRepo()
        .createQueryBuilder("appointment")
        .where("DATE(appointment.date) = :date", { date: dateStr })
        .andWhere("appointment.status != :status", { status: "cancelled" })
        .getCount();
    return { maxSlots, bookedCount, availableSlots: maxSlots - bookedCount };
};

// GET / - Dashboard
router.get("/", async (req, res) => {
    try {
        const children = await childRepo().find({ where: { parent: { id: req.user.id } }, order: { name: "ASC" } });
        
        const childIds = children.map(c => c.id);
        let upcomingAppointments = [];
        if (childIds.length > 0) {
            const allAppointments = await appointmentRepo()
                .createQueryBuilder("appointment")
                .leftJoinAndSelect("appointment.child", "child")
                .leftJoinAndSelect("appointment.vaccine", "vaccine")
                .where("child.id IN (:...childIds)", { childIds })
                .orderBy("appointment.date", "ASC")
                .getMany();
            
            upcomingAppointments = allAppointments.filter(a => a.date >= new Date() && a.status !== "cancelled" && a.status !== "completed");
        }
        res.render("client/dashboard", { children, upcomingAppointments });
    } catch (error) {
        res.render("client/dashboard", { error: "Không thể tải bảng điều khiển." });
    }
});

// GET /children/add
router.get("/children/add", (req, res) => {
    res.render("client/add-child");
});

// POST /children/add
router.post("/children/add", async (req, res) => {
    try {
        const { name, dob, gender } = req.body;
        if (!name || !dob || !gender) {
            return res.render("client/add-child", { error: "Vui lòng nhập đủ thông tin." });
        }
        const repo = childRepo();
        await repo.save(repo.create({ name, dob, gender, parent: { id: req.user.id } }));
        res.redirect("/");
    } catch (error) {
        res.render("client/add-child", { error: "Lỗi server." });
    }
});

// GET /appointments/book
router.get("/appointments/book", async (req, res) => {
    try {
        const children = await childRepo().find({ where: { parent: { id: req.user.id } } });
        const vaccines = await vaccineRepo().find();
        res.render("client/book-appointment", { children, vaccines });
    } catch (error) {
        res.redirect("/");
    }
});

// POST /appointments/book
router.post("/appointments/book", async (req, res) => {
    try {
        const { childId, vaccineId, date, notes } = req.body;
        const child = await childRepo().findOne({ where: { id: parseInt(childId), parent: { id: req.user.id } } });
        if (!child) return res.render("client/book-appointment", { error: "Trẻ không tồn tại" });

        const appointmentDate = new Date(date);
        if (appointmentDate <= new Date()) return res.render("client/book-appointment", { error: "Ngày hẹn phải là ngày trong tương lai." });

        const slotInfo = await getSlotInfo(appointmentDate);
        if (slotInfo.availableSlots <= 0) return res.render("client/book-appointment", { error: "Ngày này đã đầy lịch hẹn." });

        await appointmentRepo().save(appointmentRepo().create({
            date: appointmentDate,
            notes: notes || null,
            status: "confirmed",
            child: { id: parseInt(childId) },
            vaccine: { id: parseInt(vaccineId) },
        }));

        res.redirect("/");
    } catch (error) {
        res.render("client/book-appointment", { error: "Lỗi server." });
    }
});

module.exports = router;
