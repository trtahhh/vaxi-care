const { AppDataSource } = require("../data-source");

const appointmentRepo = () => AppDataSource.getRepository("Appointment");
const slotConfigRepo = () => AppDataSource.getRepository("DailySlotConfig");
const childRepo = () => AppDataSource.getRepository("Child");

// Lấy số slot tối đa và số đã đặt trong ngày
const getSlotInfo = async (date) => {
    const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD

    // Lấy cấu hình slot cho ngày đó (nếu không có thì dùng 50 mặc định)
    const config = await slotConfigRepo().findOne({ where: { date: dateStr } });
    const maxSlots = config ? config.maxSlots : 50;

    // Đếm số lịch hẹn đã confirmed trong ngày (không tính cancelled)
    const bookedCount = await appointmentRepo()
        .createQueryBuilder("appointment")
        .where("DATE(appointment.date) = :date", { date: dateStr })
        .andWhere("appointment.status != :status", { status: "cancelled" })
        .getCount();

    return { maxSlots, bookedCount, availableSlots: maxSlots - bookedCount };
};

// POST /api/appointments - Đặt lịch hẹn
exports.bookAppointment = async (req, res) => {
    try {
        const { childId, vaccineId, date, notes } = req.body;
        if (!childId || !vaccineId || !date) {
            return res.status(400).json({ message: "Vui lòng cung cấp đầy đủ thông tin." });
        }

        // Kiểm tra trẻ có thuộc về parent này không
        const child = await childRepo().findOne({
            where: { id: parseInt(childId), parent: { id: req.user.id } },
        });
        if (!child) {
            return res.status(404).json({ message: "Không tìm thấy hồ sơ trẻ." });
        }

        const appointmentDate = new Date(date);
        if (appointmentDate <= new Date()) {
            return res.status(400).json({ message: "Ngày hẹn phải là ngày trong tương lai." });
        }

        // Kiểm tra slot
        const slotInfo = await getSlotInfo(appointmentDate);
        if (slotInfo.availableSlots <= 0) {
            return res.status(400).json({
                message: "Ngày này đã đầy lịch hẹn. Vui lòng chọn ngày khác.",
                maxSlots: slotInfo.maxSlots,
                bookedCount: slotInfo.bookedCount,
            });
        }

        const repo = appointmentRepo();
        const appointment = repo.create({
            date: appointmentDate,
            notes: notes || null,
            status: "confirmed",
            child: { id: parseInt(childId) },
            vaccine: { id: parseInt(vaccineId) },
        });
        await repo.save(appointment);

        res.status(201).json({
            message: "Đặt lịch hẹn thành công.",
            appointment,
            slotInfo,
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi server.", error: error.message });
    }
};

// PATCH /api/appointments/:id/cancel - Hủy lịch hẹn
exports.cancelAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        const repo = appointmentRepo();

        const appointment = await repo.findOne({
            where: { id: parseInt(id) },
            relations: ["child", "child.parent"],
        });

        if (!appointment) {
            return res.status(404).json({ message: "Không tìm thấy lịch hẹn." });
        }

        // Kiểm tra lịch hẹn có thuộc về parent này không
        if (appointment.child.parent.id !== req.user.id) {
            return res.status(403).json({ message: "Bạn không có quyền hủy lịch hẹn này." });
        }

        if (appointment.status === "cancelled") {
            return res.status(400).json({ message: "Lịch hẹn này đã bị hủy trước đó." });
        }

        if (appointment.status === "completed") {
            return res.status(400).json({ message: "Không thể hủy lịch hẹn đã hoàn thành." });
        }

        appointment.status = "cancelled";
        await repo.save(appointment);
        res.json({ message: "Hủy lịch hẹn thành công." });
    } catch (error) {
        res.status(500).json({ message: "Lỗi server.", error: error.message });
    }
};

// GET /api/appointments - Lấy tất cả lịch hẹn (lịch sử + sắp tới) của parent
exports.getMyAppointments = async (req, res) => {
    try {
        // Lấy tất cả trẻ của parent này
        const children = await childRepo().find({
            where: { parent: { id: req.user.id } },
        });
        const childIds = children.map((c) => c.id);

        if (childIds.length === 0) {
            return res.json({ upcoming: [], history: [] });
        }

        const repo = appointmentRepo();
        const appointments = await repo
            .createQueryBuilder("appointment")
            .leftJoinAndSelect("appointment.child", "child")
            .leftJoinAndSelect("appointment.vaccine", "vaccine")
            .where("child.id IN (:...childIds)", { childIds })
            .orderBy("appointment.date", "ASC")
            .getMany();

        const now = new Date();
        const upcoming = appointments.filter(
            (a) => a.date >= now && a.status !== "cancelled" && a.status !== "completed"
        );
        const history = appointments.filter(
            (a) => a.date < now || a.status === "completed" || a.status === "cancelled"
        );

        res.json({ upcoming, history });
    } catch (error) {
        res.status(500).json({ message: "Lỗi server.", error: error.message });
    }
};

// GET /api/appointments/slots?date=YYYY-MM-DD - Xem số slot còn trống trong ngày
exports.getSlotAvailability = async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ message: "Vui lòng cung cấp ngày." });
        }
        const slotInfo = await getSlotInfo(new Date(date));
        res.json(slotInfo);
    } catch (error) {
        res.status(500).json({ message: "Lỗi server.", error: error.message });
    }
};
