const cron = require("node-cron");
const NotificationService = require("../services/NotificationService");
const { AppDataSource } = require("../models/data-source");

const startNotificationScheduler = () => {
    cron.schedule("0 9 * * *", async () => {
        console.log("[Scheduler] Đang kiểm tra lịch hẹn ngày mai để gửi nhắc nhở...");

        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split("T")[0];

            const appointments = await AppDataSource.getRepository("Appointment")
                .createQueryBuilder("appointment")
                .leftJoinAndSelect("appointment.child", "child")
                .leftJoinAndSelect("child.parent", "parent")
                .leftJoinAndSelect("appointment.vaccine", "vaccine")
                .where("DATE(appointment.date) = :date", { date: tomorrowStr })
                .andWhere("appointment.status = :status", { status: "confirmed" })
                .getMany();

            console.log(`[Scheduler] Tìm thấy ${appointments.length} lịch hẹn cho ngày ${tomorrowStr}`);

            const notificationService = new NotificationService();

            for (const appointment of appointments) {
                // Guard: skip if child or parent is missing
                if (!appointment.child || !appointment.child.parent) {
                    console.warn(`[Scheduler] Bỏ qua appointment ${appointment.id}: thiếu thông tin trẻ hoặc phụ huynh.`);
                    continue;
                }
                const parent = appointment.child.parent;
                const childName = appointment.child.name;
                const vaccineName = appointment.vaccine ? appointment.vaccine.name : 'vắc xin';

                // Guard: skip if parent email is missing
                if (!parent.email) {
                    console.warn(`[Scheduler] Bỏ qua appointment ${appointment.id}: phụ huynh không có email.`);
                    continue;
                }

                // Send email reminder
                try {
                    await notificationService.sendAppointmentReminder(
                        parent,
                        childName,
                        vaccineName,
                        appointment.date
                    );
                    console.log(`[Scheduler] Đã gửi email nhắc nhở cho ${parent.email}`);
                } catch (emailError) {
                    console.error(`[Scheduler] Lỗi gửi email cho ${parent.email}:`, emailError.message);
                }

                // Create in-app notification
                try {
                    await notificationService.createInAppNotification(
                        parent.id,
                        "Nhắc nhở lịch tiêm chủng",
                        `Bé ${childName} có lịch tiêm vaccine ${vaccineName} vào ${new Date(appointment.date).toLocaleString("vi-VN")}. Vui lòng đưa bé đến đúng giờ.`
                    );
                } catch (notifError) {
                    console.error(`[Scheduler] Lỗi tạo thông báo cho ${parent.email}:`, notifError.message);
                }
            }

            console.log("[Scheduler] Hoàn thành gửi nhắc nhở.");
        } catch (error) {
            console.error("[Scheduler] Lỗi khi chạy scheduler:", error.message);
        }
    });

    console.log("[Scheduler] Notification scheduler đã được khởi động (chạy lúc 9:00 sáng hàng ngày).");
};

module.exports = { startNotificationScheduler };
