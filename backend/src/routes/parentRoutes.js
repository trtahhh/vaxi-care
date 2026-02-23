const express = require("express");
const router = express.Router();
const childController = require("../controller/childController");
const appointmentController = require("../controller/appointmentController");
const vaccineProgressController = require("../controller/vaccineProgressController");
const notificationController = require("../controller/notificationController");
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");

// Tất cả routes bên dưới đều yêu cầu đăng nhập với role parent
router.use(authenticate, authorizeRoles("parent"));

// Hồ sơ trẻ - Parent chỉ được xem, Staff/Admin mới có quyền thêm/sửa/xóa
router.get("/children", childController.getMyChildren);

// Lịch hẹn
router.get("/appointments", appointmentController.getMyAppointments);
router.get("/appointments/slots", appointmentController.getSlotAvailability);
router.post("/appointments", appointmentController.bookAppointment);
router.patch("/appointments/:id/cancel", appointmentController.cancelAppointment);

// Tiến độ tiêm chủng
router.get("/vaccine-progress/:childId", vaccineProgressController.getProgressByChild);

// Thông báo in-app
router.get("/notifications", notificationController.getMyNotifications);
router.patch("/notifications/:id/read", notificationController.markAsRead);
router.patch("/notifications/read-all", notificationController.markAllAsRead);

module.exports = router;
