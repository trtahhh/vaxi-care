const express = require("express");
const router = express.Router();
const HomeService = require('../../services/HomeService');
const RoadmapService = require('../../services/RoadmapService');
const { authenticate, authorizeRoles, loadNotificationCount } = require("../auth/auth.middleware");

const homeService = new HomeService();
const roadmapService = new RoadmapService();

// CSRF guard for state-changing requests
const csrfGuard = (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const cookieToken = req.cookies['csrf-token'];
    const sentToken = req.body._csrf || req.headers['x-csrf-token'] || req.query._csrf;
    if (!cookieToken || !sentToken || cookieToken !== sentToken) {
        return res.status(403).send("Yêu cầu không hợp lệ. Vui lòng tải lại trang.");
    }
    next();
};

// Public Landing Page
router.get("/", (req, res) => {
    res.render("client/index");
});

const isAdminOrStaff = [authenticate, loadNotificationCount, authorizeRoles("admin", "staff")];
const isParent = [authenticate, loadNotificationCount, authorizeRoles("parent", "admin", "staff")];

router.get("/client/dashboard", isParent, async (req, res) => {
    try {
        const userId = req.user.role === 'admin' || req.user.role === 'staff' ? (req.query.parentId || req.user.id) : req.user.id;
        const { children, upcomingAppointments } = await homeService.getDashboardData(userId);
        res.render("client/dashboard", {
            currentPath: '/client/dashboard',
            children,
            upcomingAppointments,
            error: null
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.render("client/dashboard", {
            currentPath: '/client/dashboard',
            children: [],
            upcomingAppointments: [],
            error: "Không thể tải bảng điều khiển."
        });
    }
});

router.get("/children/add", isAdminOrStaff, async (req, res) => {
    try {
        const parents = await homeService.getParents();
        res.render("client/add-child", {
            currentPath: '/children/add',
            parents,
            selectedParentId: req.query.parentId
        });
    } catch (error) {
        res.redirect("/client/dashboard");
    }
});

router.post("/children/add", isAdminOrStaff, csrfGuard, async (req, res) => {
    try {
        // Validate DOB is not in the future
        const dob = new Date(req.body.dob);
        const now = new Date();
        now.setHours(23, 59, 59, 999); // allow full day today
        if (isNaN(dob.getTime())) {
            throw new Error("Ngày sinh không hợp lệ.");
        }
        if (dob > now) {
            throw new Error("Ngày sinh không thể là ngày trong tương lai.");
        }
        await homeService.addChild(req.body);
        res.redirect("/client/dashboard");
    } catch (error) {
        const parents = await homeService.getParents();
        res.render("client/add-child", {
            currentPath: '/children/add',
            error: error.message,
            parents
        });
    }
});

router.get("/appointments/book", isParent, async (req, res) => {
    try {
        const { childId, vaccineId } = req.query;
        const children = await homeService.getChildrenForBooking(req.user.id, req.user.role);
        const vaccines = await homeService.getVaccinesForBooking();

        let recommendations = [];
        if (childId) {
            recommendations = await homeService.getRecommendedVaccines(parseInt(childId));
        }

        res.render("client/book-appointment", {
            currentPath: '/appointments/book',
            children,
            vaccines,
            recommendations,
            selectedChildId: childId || null,
            selectedVaccineId: vaccineId || null
        });
    } catch (error) {
        res.redirect("/client/dashboard");
    }
});

router.post("/appointments/book", isParent, csrfGuard, async (req, res) => {
    try {
        await homeService.bookAppointment(req.user.id, req.body, req.user.role);
        res.redirect("/client/dashboard");
    } catch (error) {
        const children = await homeService.getChildrenForBooking(req.user.id, req.user.role);
        const vaccines = await homeService.getVaccinesForBooking();
        res.render("client/book-appointment", {
            currentPath: '/appointments/book',
            children,
            vaccines,
            recommendations: [],
            selectedChildId: req.body.childId,
            selectedVaccineId: req.body.vaccineId,
            error: error.message
        });
    }
});

router.get("/client/schedule", isParent, async (req, res) => {
    try {
        const userId = req.user.role === 'admin' || req.user.role === 'staff'
            ? (req.query.parentId || req.user.id)
            : req.user.id;
        const { children } = await homeService.getDashboardData(userId);
        const childIds = children.map(c => c.id);
        let allAppointments = [];
        if (childIds.length > 0) {
            const appointmentRepo = new (require('../../repositories/AppointmentRepository'))();
            allAppointments = await appointmentRepo.findByChildIds(childIds);
        }
        res.render("client/schedule", { currentPath: '/client/schedule', children, appointments: allAppointments, error: null });
    } catch (error) {
        res.render("client/schedule", { currentPath: '/client/schedule', children: [], appointments: [], error: error.message });
    }
});

router.get("/client/growth", isParent, async (req, res) => {
    try {
        res.render("client/growth", { currentPath: '/client/growth' });
    } catch (error) {
        res.render("client/growth", { currentPath: '/client/growth' });
    }
});

router.get("/client/vaccines/:id", isParent, async (req, res) => {
    try {
        const vaccine = await homeService.getVaccineDetail(parseInt(req.params.id));
        res.render("client/vaccine_detail", { currentPath: '/client/vaccines', vaccine, error: null });
    } catch (error) {
        res.render("client/vaccine_detail", { currentPath: '/client/vaccines', vaccine: null, error: error.message });
    }
});

router.get("/client/children/:id", isParent, async (req, res) => {
    try {
        const childId = parseInt(req.params.id);
        if (isNaN(childId)) {
            return res.redirect("/client/dashboard");
        }
        const childRepo = new (require('../../repositories/ChildRepository'))();
        const child = await childRepo.findById(childId);
        if (!child) return res.redirect("/client/dashboard");

        // Check ownership
        if (req.user.role === 'parent' && child.parent.id !== req.user.id) {
            return res.status(403).send("Bạn không có quyền xem thông tin này.");
        }

        const appointmentRepo = new (require('../../repositories/AppointmentRepository'))();
        const appointments = await appointmentRepo.findByChildId(child.id);
        res.render("client/child-detail", { currentPath: '/client/dashboard', child, appointments, error: null });
    } catch (error) {
        res.redirect("/client/dashboard");
    }
});

// Notifications
router.get("/client/notifications", isParent, async (req, res) => {
    try {
        const NotificationRepository = require('../../repositories/NotificationRepository');
        const notifRepo = new NotificationRepository();
        const notifications = await notifRepo.findByUserId(req.user.id);
        res.render("client/notifications", { currentPath: '/client/notifications', notifications, error: null });
    } catch (error) {
        res.render("client/notifications", { currentPath: '/client/notifications', notifications: [], error: error.message });
    }
});

router.post("/notifications/:id/read", isParent, csrfGuard, async (req, res) => {
    try {
        const NotificationRepository = require('../../repositories/NotificationRepository');
        const notifRepo = new NotificationRepository();
        await notifRepo.markAsRead(parseInt(req.params.id), req.user.id);
    } catch (error) {
        console.error('Mark read error:', error.message);
    }
    res.redirect("/client/notifications");
});

// Appointment cancellation
router.post("/appointments/:id/cancel", isParent, csrfGuard, async (req, res) => {
    try {
        await homeService.cancelAppointment(parseInt(req.params.id), req.user.id, req.user.role);
        res.redirect("/client/dashboard?success=Hủy%20lịch%20hẹn%20thành%20công");
    } catch (error) {
        res.redirect("/client/dashboard?error=" + encodeURIComponent(error.message));
    }
});

// Slot availability check (used by booking form)
router.get("/appointments/slots", isParent, async (req, res) => {
    try {
        // Parse datetime-local input as local time (avoids UTC conversion issues)
        const raw = req.query.date;
        if (!raw) return res.status(400).json({ error: "Ngày không hợp lệ" });

        const [datePart, timePart] = raw.split('T');
        if (!datePart || !timePart) return res.status(400).json({ error: "Ngày không hợp lệ" });

        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);

        if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) {
            return res.status(400).json({ error: "Ngày không hợp lệ" });
        }

        const date = new Date(year, month - 1, day, hour, minute);

        if (isNaN(date.getTime())) {
            return res.status(400).json({ error: "Ngày không hợp lệ" });
        }

        const slotInfo = await homeService.getSlotInfo(date);
        res.json(slotInfo);
    } catch (error) {
        console.error('[Slots] Error:', error);
        res.status(500).json({ error: "Lỗi server" });
    }
});

// Client settings
router.get("/client/settings", isParent, async (req, res) => {
    try {
        const UserRepository = require('../../repositories/UserRepository');
        const userRepo = new UserRepository();
        const fullUser = await userRepo.findById(req.user.id);
        res.render("client/settings", { currentPath: '/client/settings', user: fullUser });
    } catch (error) {
        res.render("client/settings", { currentPath: '/client/settings', user: res.locals.user });
    }
});

// Client vaccine listing
router.get("/client/vaccines", isParent, async (req, res) => {
    try {
        const VaccineRepository = require('../../repositories/VaccineRepository');
        const vaccineRepo = new VaccineRepository();
        const vaccines = await vaccineRepo.findAll(0, 1000);
        res.render("client/vaccines/index", {
            currentPath: '/client/vaccines',
            vaccines,
            search: '',
            error: null
        });
    } catch (error) {
        res.render("client/vaccines/index", {
            currentPath: '/client/vaccines',
            vaccines: [],
            search: '',
            error: error.message
        });
    }
});

// === Vaccination Roadmap ===
router.get("/client/roadmap/:childId", isParent, async (req, res) => {
    try {
        const childId = parseInt(req.params.childId);
        if (isNaN(childId)) return res.redirect("/client/dashboard");

        const roadmap = await roadmapService.getRoadmapForChild(childId);
        if (!roadmap) return res.redirect("/client/dashboard?error=Không%20tìm%20thấy%20hồ%20sơ%20bé");

        const ChildRepository = require('../../repositories/ChildRepository');
        const childRepo = new ChildRepository();
        const child = await childRepo.findById(childId);

        res.render("client/roadmap", {
            currentPath: '/client/roadmap',
            roadmap,
            child,
            error: null
        });
    } catch (err) {
        console.error('[Roadmap] Error:', err);
        res.redirect("/client/dashboard?error=Lỗi%20tải%20lộ%20trình");
    }
});

module.exports = router;
