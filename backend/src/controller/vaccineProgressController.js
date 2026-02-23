const { AppDataSource } = require("../data-source");

const vaccineRepo = () => AppDataSource.getRepository("Vaccine");
const appointmentRepo = () => AppDataSource.getRepository("Appointment");
const childRepo = () => AppDataSource.getRepository("Child");

// Tính tuổi của trẻ tính bằng tháng
const getAgeInMonths = (dob) => {
    const birthDate = new Date(dob);
    const now = new Date();
    return (
        (now.getFullYear() - birthDate.getFullYear()) * 12 +
        (now.getMonth() - birthDate.getMonth())
    );
};

// GET /api/vaccine-progress/:childId - Tiến độ tiêm chủng của một đứa trẻ
exports.getProgressByChild = async (req, res) => {
    try {
        const { childId } = req.params;

        // Kiểm tra trẻ có thuộc về parent này không
        const child = await childRepo().findOne({
            where: { id: parseInt(childId), parent: { id: req.user.id } },
        });
        if (!child) {
            return res.status(404).json({ message: "Không tìm thấy hồ sơ trẻ." });
        }

        // Lấy tất cả vaccine, sắp xếp theo độ tuổi khuyến nghị
        const vaccines = await vaccineRepo().find({ order: { recommendedAgeMonths: "ASC" } });

        // Lấy các lịch hẹn đã hoàn thành của trẻ
        const completedAppointments = await appointmentRepo()
            .createQueryBuilder("appointment")
            .leftJoinAndSelect("appointment.vaccine", "vaccine")
            .where("appointment.child_id = :childId", { childId })
            .andWhere("appointment.status = :status", { status: "completed" })
            .getMany();

        const completedVaccineIds = new Set(completedAppointments.map((a) => a.vaccine.id));

        const childAgeMonths = getAgeInMonths(child.dob);

        const progress = vaccines.map((vaccine) => ({
            ...vaccine,
            vaccinated: completedVaccineIds.has(vaccine.id),
            recommended: vaccine.recommendedAgeMonths !== null && childAgeMonths >= vaccine.recommendedAgeMonths,
        }));

        const totalVaccines = vaccines.length;
        const vaccinatedCount = progress.filter((v) => v.vaccinated).length;
        const recommendedCount = progress.filter((v) => v.recommended).length;
        const vaccinatedFromRecommended = progress.filter((v) => v.vaccinated && v.recommended).length;

        res.json({
            child: {
                id: child.id,
                name: child.name,
                dob: child.dob,
                ageInMonths: childAgeMonths,
            },
            summary: {
                totalVaccines,
                vaccinatedCount,
                recommendedCount,
                vaccinatedFromRecommended,
                completionRate: recommendedCount > 0
                    ? Math.round((vaccinatedFromRecommended / recommendedCount) * 100)
                    : 0,
            },
            vaccines: progress,
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi server.", error: error.message });
    }
};
