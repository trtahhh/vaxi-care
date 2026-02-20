const cron = require("node-cron");
const nodemailer = require("nodemailer");
const { AppDataSource } = require("../data-source");

const sendEmail = async (to, subject, html) => {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
    await transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, html });
};

// Chạy mỗi ngày lúc 9:00 sáng
const startNotificationScheduler = () => {
    cron.schedule("0 9 * * *", async () => {
        console.log("[Scheduler] Đang kiểm tra lịch hẹn ngày mai để gửi nhắc nhở...");

        try {
            const appointmentRepo = AppDataSource.getRepository("Appointment");
            const notificationRepo = AppDataSource.getRepository("Notification");

            // Lấy ngày mai
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split("T")[0];

            // Tìm tất cả lịch hẹn confirmed có ngày là ngày mai
            const appointments = await appointmentRepo
                .createQueryBuilder("appointment")
                .leftJoinAndSelect("appointment.child", "child")
                .leftJoinAndSelect("child.parent", "parent")
                .leftJoinAndSelect("appointment.vaccine", "vaccine")
                .where("DATE(appointment.date) = :date", { date: tomorrowStr })
                .andWhere("appointment.status = :status", { status: "confirmed" })
                .getMany();

            console.log(`[Scheduler] Tìm thấy ${appointments.length} lịch hẹn cho ngày ${tomorrowStr}`);

            for (const appointment of appointments) {
                const parent = appointment.child.parent;
                const childName = appointment.child.name;
                const vaccineName = appointment.vaccine.name;
                const appointmentDate = new Date(appointment.date).toLocaleString("vi-VN");

                // Gửi email
                try {
                    await sendEmail(
                        parent.email,
                        `VaxiCare - Nhắc nhở lịch tiêm chủng cho ${childName}`,
                        `<div style="font-family: Arial, sans-serif; padding: 20px;">
                            <h2>Nhắc nhở lịch tiêm chủng</h2>
                            <p>Xin chào <strong>${parent.fullName || parent.username}</strong>,</p>
                            <p>Đây là nhắc nhở về lịch tiêm chủng sắp tới:</p>
                            <ul>
                                <li><strong>Bé:</strong> ${childName}</li>
                                <li><strong>Vaccine:</strong> ${vaccineName}</li>
                                <li><strong>Thời gian:</strong> ${appointmentDate}</li>
                            </ul>
                            <p>Vui lòng đưa bé đến đúng giờ. Nếu có thay đổi, hãy đăng nhập vào VaxiCare để hủy lịch kịp thời.</p>
                            <p>Trân trọng,<br>Đội ngũ VaxiCare</p>
                        </div>`
                    );
                    console.log(`[Scheduler] Đã gửi email nhắc nhở cho ${parent.email}`);
                } catch (emailError) {
                    console.error(`[Scheduler] Lỗi gửi email cho ${parent.email}:`, emailError.message);
                }

                // Tạo thông báo in-app
                const notification = notificationRepo.create({
                    title: "Nhắc nhở lịch tiêm chủng",
                    message: `Bé ${childName} có lịch tiêm vaccine ${vaccineName} vào ${appointmentDate}. Vui lòng đưa bé đến đúng giờ.`,
                    user: { id: parent.id },
                });
                await notificationRepo.save(notification);
            }

            console.log("[Scheduler] Hoàn thành gửi nhắc nhở.");
        } catch (error) {
            console.error("[Scheduler] Lỗi khi chạy scheduler:", error.message);
        }
    });

    console.log("[Scheduler] Notification scheduler đã được khởi động (chạy lúc 9:00 sáng hàng ngày).");
};

module.exports = { startNotificationScheduler };
