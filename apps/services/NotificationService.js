const nodemailer = require("nodemailer");
const NotificationRepository = require("../repositories/NotificationRepository");

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

class NotificationService {
  async sendAppointmentReminder(parent, childName, vaccineName, appointmentDate) {
    if (!parent || !parent.email) {
      console.warn("[NotificationService] Không thể gửi email: parent hoặc email không tồn tại.");
      return;
    }

    const formattedDate = new Date(appointmentDate).toLocaleString("vi-VN");

    // Send email
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
            <li><strong>Thời gian:</strong> ${formattedDate}</li>
          </ul>
          <p>Vui lòng đưa bé đến đúng giờ. Nếu có thay đổi, hãy đăng nhập vào VaxiCare để hủy lịch kịp thời.</p>
          <p>Trân trọng,<br>Đội ngũ VaxiCare</p>
        </div>`
      );
    } catch (emailError) {
      console.error(`[NotificationService] Lỗi gửi email cho ${parent.email}:`, emailError.message);
    }
  }

  async createInAppNotification(userId, title, message) {
    const notificationRepo = new NotificationRepository();
    const notification = notificationRepo.create({
      title,
      message,
      user: { id: userId },
      isRead: false
    });
    return await notificationRepo.insert(notification);
  }
}

module.exports = NotificationService;
