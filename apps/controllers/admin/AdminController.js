const express = require('express');
const router = express.Router();
const AdminService = require('../../services/AdminService');
const { authenticate } = require("../auth/auth.middleware");

const adminService = new AdminService();

// Apply auth middleware to all admin routes
router.use(authenticate);
router.use((req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
        return res.status(403).send("Bạn không có quyền truy cập chức năng quản trị.");
    }
    next();
});

// Apply CSRF validation to all state-changing routes
router.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const cookieToken = req.cookies['csrf-token'];
    const sentToken = req.body._csrf || req.headers['x-csrf-token'] || req.query._csrf;
    if (!cookieToken || !sentToken || cookieToken !== sentToken) {
        return res.status(403).send("Yêu cầu không hợp lệ (CSRF token không khớp). Vui lòng tải lại trang.");
    }
    next();
});

router.get("/dashboard", async (req, res) => {
    try {
        const stats = await adminService.getDashboardStats();
        res.render("admin/dashboard", {
            currentPath: '/admin/dashboard',
            userCount: stats.userCount,
            childCount: stats.childCount,
            vaccineCount: stats.vaccineCount,
            todayAppointments: stats.todayAppointments,
            weeklyTrend: stats.weeklyTrend,
            stockAlerts: stats.stockAlerts,
            error: null,
            success: null
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.render("admin/dashboard", {
            currentPath: '/admin/dashboard',
            userCount: 0, childCount: 0, vaccineCount: 0, todayAppointments: 0,
            weeklyTrend: [], stockAlerts: [],
            error: "Lỗi tải dữ liệu", success: null
        });
    }
});

router.get("/appointments/pending", async (req, res) => {
    try {
        const { page = 1 } = req.query;
        const result = await adminService.getPendingAppointments(page);
        res.render("admin/appointments/pending", {
            currentPath: '/admin/appointments/pending',
            appointments: result.appointments,
            currentPage: result.pageNum,
            totalPages: result.totalPages,
            error: null,
            success: req.query.success || null
        });
    } catch (error) {
        console.error('Pending appointments error:', error);
        res.render("admin/appointments/pending", {
            currentPath: '/admin/appointments/pending',
            appointments: [], currentPage: 1, totalPages: 1,
            error: "Lỗi tải dữ liệu", success: null
        });
    }
});

router.post("/appointments/:id/status", async (req, res) => {
    try {
        const { status } = req.body;
        await adminService.updateAppointmentStatus(req.params.id, status);
        res.redirect("/admin/appointments/pending?success=Cập%20nhật%20trạng%20thái%20thành%20công");
    } catch (error) {
        console.error('Update status error:', error);
        res.redirect("/admin/appointments/pending?error=" + encodeURIComponent(error.message));
    }
});

router.get("/vaccines", async (req, res) => {
    try {
        const { search, page = 1 } = req.query;
        const result = await adminService.getVaccineList(search, page);
        res.render("admin/vaccines/index", {
            currentPath: '/admin/vaccines',
            vaccines: result.vaccines,
            search: result.search,
            currentPage: result.pageNum,
            totalPages: result.totalPages,
            error: null,
            success: req.query.success || null
        });
    } catch (error) {
        console.error('Vaccines list error:', error);
        res.render("admin/vaccines/index", {
            currentPath: '/admin/vaccines',
            vaccines: [], search: "", currentPage: 1, totalPages: 1,
            error: "Lỗi tải dữ liệu", success: null
        });
    }
});

router.get("/vaccines/add", (req, res) => {
    res.render("admin/vaccines/form", { currentPath: '/admin/vaccines', vaccine: null, error: null, success: null, csrfToken: res.locals.csrfToken });
});

router.post("/vaccines/add", async (req, res) => {
    try {
        const { name, description, price, stock, recommendedAgeMonths, ageLabel } = req.body;
        if (!name || !price) {
            return res.render("admin/vaccines/form", {
                currentPath: '/admin/vaccines',
                vaccine: req.body,
                error: "Tên và giá vaccine là bắt buộc",
                success: null
            });
        }
        const priceNum = parseFloat(price);
        if (isNaN(priceNum) || priceNum < 0) {
            return res.render("admin/vaccines/form", {
                currentPath: '/admin/vaccines',
                vaccine: req.body,
                error: "Giá vaccine phải là số dương",
                success: null
            });
        }
        const stockNum = parseInt(stock) || 0;
        if (stockNum < 0) {
            return res.render("admin/vaccines/form", {
                currentPath: '/admin/vaccines',
                vaccine: req.body,
                error: "Số lượng tồn kho không được âm",
                success: null
            });
        }
        await adminService.createVaccine({ name, description, price, stock, recommendedAgeMonths, ageLabel });
        res.redirect("/admin/vaccines?success=Thêm%20vaccine%20thành%20công");
    } catch (error) {
        console.error('Add vaccine error:', error);
        res.render("admin/vaccines/form", {
            currentPath: '/admin/vaccines',
            vaccine: req.body, error: "Lỗi lưu dữ liệu", success: null
        });
    }
});

router.get("/vaccines/edit/:id", async (req, res) => {
    try {
        const vaccine = await adminService.getVaccineById(req.params.id);
        if (!vaccine) {
            return res.redirect("/admin/vaccines?error=Không%20tìm%20thấy%20vaccine");
        }
        res.render("admin/vaccines/form", { currentPath: '/admin/vaccines', vaccine, error: null, success: null, csrfToken: res.locals.csrfToken });
    } catch (error) {
        res.redirect("/admin/vaccines?error=Lỗi%20tải%20dữ%ệu");
    }
});

router.post("/vaccines/edit/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.redirect("/admin/vaccines?error=ID%20không%20hợp%20lệ");
        }
        const vaccine = await adminService.getVaccineById(id);
        if (!vaccine) {
            return res.redirect("/admin/vaccines?error=Không%20tìm%20thấy%20vaccine");
        }
        const { name, description, price, stock, recommendedAgeMonths, ageLabel } = req.body;
        if (!name || !price) {
            return res.render("admin/vaccines/form", {
                currentPath: '/admin/vaccines',
                vaccine: { ...vaccine, ...req.body },
                error: "Tên và giá vaccine là bắt buộc",
                success: null
            });
        }
        const priceNum = parseFloat(price);
        if (isNaN(priceNum) || priceNum < 0) {
            return res.render("admin/vaccines/form", {
                currentPath: '/admin/vaccines',
                vaccine: { ...vaccine, ...req.body },
                error: "Giá vaccine phải là số dương",
                success: null
            });
        }
        const stockNum = parseInt(stock) || 0;
        if (stockNum < 0) {
            return res.render("admin/vaccines/form", {
                currentPath: '/admin/vaccines',
                vaccine: { ...vaccine, ...req.body },
                error: "Số lượng tồn kho không được âm",
                success: null
            });
        }
        await adminService.updateVaccine(id, { name, description, price, stock, recommendedAgeMonths, ageLabel });
        res.redirect("/admin/vaccines?success=Cập%20nhật%20vaccine%20thành%20công");
    } catch (error) {
        console.error('Edit vaccine error:', error);
        res.render("admin/vaccines/form", {
            currentPath: '/admin/vaccines',
            vaccine: { ...req.body, id: req.params.id },
            error: "Lỗi lưu dữ liệu",
            success: null
        });
    }
});

router.post("/vaccines/delete/:id", async (req, res) => {
    try {
        await adminService.deleteVaccine(req.params.id);
        res.redirect("/admin/vaccines?success=Xóa%20vaccine%20thành%20công");
    } catch (error) {
        res.redirect("/admin/vaccines?error=Không%20thể%20xóa%20vaccine%20này");
    }
});


router.get("/schedule", async (req, res) => {
    try {
        const { month, year } = req.query;
        const result = await adminService.getScheduleMonth(month, year);
        res.render("admin/schedule/index", {
            currentPath: '/admin/schedule',
            daysInMonth: result.daysInMonth,
            currentMonth: result.currentMonth,
            currentYear: result.currentYear,
            error: null,
            success: req.query.success || null
        });
    } catch (error) {
        console.error('Schedule error:', error);
        res.render("admin/schedule/index", {
            currentPath: '/admin/schedule',
            daysInMonth: [],
            currentMonth: new Date().getMonth() + 1,
            currentYear: new Date().getFullYear(),
            error: "Lỗi tải dữ liệu",
            success: null
        });
    }
});

router.post("/schedule/update", async (req, res) => {
    try {
        const { date, maxSlots } = req.body;
        if (!date || maxSlots === undefined) {
            return res.redirect("/admin/schedule?error=Vui%20lòng%20nhập%20đầy%20đủ%20thông%20tin");
        }
        await adminService.updateScheduleConfig(date, maxSlots);
        res.redirect("/admin/schedule?success=Cập%20nhật%20lịch%20thành%20công");
    } catch (error) {
        console.error('Schedule update error:', error);
        res.redirect("/admin/schedule?error=" + encodeURIComponent(error.message));
    }
});

router.get("/users", async (req, res) => {
    try {
        const { role, search, page = 1 } = req.query;
        const result = await adminService.getUserList(role, search, page);
        res.render("admin/users/index", {
            currentPath: '/admin/users',
            users: result.users,
            search: result.search,
            filterRole: result.filterRole,
            currentPage: result.pageNum,
            totalPages: result.totalPages,
            error: null,
            success: req.query.success || null
        });
    } catch (error) {
        console.error('Users list error:', error);
        res.render("admin/users/index", {
            currentPath: '/admin/users',
            users: [], search: "", filterRole: "", currentPage: 1, totalPages: 1,
            error: "Lỗi tải dữ liệu", success: null
        });
    }
});

router.get("/users/add", (req, res) => {
    res.render("admin/users/form", { currentPath: '/admin/users', user: null, error: null, success: null });
});

router.post("/users/add", async (req, res) => {
    try {
        const { username, email, password, fullName, phone, role } = req.body;
        if (!username || !email || !password) {
            return res.render("admin/users/form", {
                currentPath: '/admin/users',
                user: req.body,
                error: "Tên đăng nhập, email và mật khẩu là bắt buộc",
                success: null
            });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.render("admin/users/form", {
                currentPath: '/admin/users',
                user: req.body,
                error: "Email không hợp lệ",
                success: null
            });
        }
        if (password.length < 6) {
            return res.render("admin/users/form", {
                currentPath: '/admin/users',
                user: req.body,
                error: "Mật khẩu phải có ít nhất 6 ký tự",
                success: null
            });
        }
        if (phone && !/^0\d{9}$/.test(phone)) {
            return res.render("admin/users/form", {
                currentPath: '/admin/users',
                user: req.body,
                error: "Số điện thoại phải bắt đầu bằng 0 và có 10 chữ số",
                success: null
            });
        }
        await adminService.createUser({ username, email, password, fullName, phone, role });
        res.redirect("/admin/users?success=Thêm%20người%20dùng%20thành%20công");
    } catch (error) {
        console.error('Add user error:', error);
        res.render("admin/users/form", {
            currentPath: '/admin/users',
            user: req.body,
            error: error.message || "Lỗi lưu dữ liệu",
            success: null
        });
    }
});

router.get("/children", async (req, res) => {
    try {
        const { search, page = 1 } = req.query;
        const result = await adminService.getChildList(search, page);
        res.render("admin/children/index", {
            currentPath: '/admin/children',
            children: result.children,
            search: result.search,
            currentPage: result.pageNum,
            totalPages: result.totalPages,
            error: null,
            success: null
        });
    } catch (error) {
        console.error('Children list error:', error);
        res.render("admin/children/index", {
            currentPath: '/admin/children',
            children: [], search: "", currentPage: 1, totalPages: 1,
            error: "Lỗi tải dữ liệu", success: null
        });
    }
});

router.get("/children/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.redirect("/admin/children?error=ID%20không%20hợp%20lệ");
        }
        const result = await adminService.getChildDetail(id);
        if (!result) {
            return res.redirect("/admin/children?error=Không%20tìm%20thấy%20hồ%20sơ%20trẻ");
        }
        res.render("admin/children/detail", {
            currentPath: '/admin/children',
            child: result.child,
            appointments: result.appointments,
            error: null,
            success: null
        });
    } catch (error) {
        console.error('Child detail error:', error);
        res.redirect("/admin/children?error=Lỗi%20tải%20dữ%ệu");
    }
});

module.exports = router;
