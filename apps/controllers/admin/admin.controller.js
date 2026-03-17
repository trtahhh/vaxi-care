const express = require('express');
const router = express.Router();
const bcrypt = require("bcryptjs");
const { AppDataSource } = require("../../models/data-source");
const { authenticate } = require("../auth/auth.middleware");
const { MoreThanOrEqual, Like, Between } = require("typeorm");

// Repositories (cached)
let _userRepo, _vaccineRepo, _childRepo, _appointmentRepo, _dailySlotConfigRepo;
const userRepo = () => _userRepo || (_userRepo = AppDataSource.getRepository("User"));
const vaccineRepo = () => _vaccineRepo || (_vaccineRepo = AppDataSource.getRepository("Vaccine"));
const childRepo = () => _childRepo || (_childRepo = AppDataSource.getRepository("Child"));
const appointmentRepo = () => _appointmentRepo || (_appointmentRepo = AppDataSource.getRepository("Appointment"));
const dailySlotConfigRepo = () => _dailySlotConfigRepo || (_dailySlotConfigRepo = AppDataSource.getRepository("DailySlotConfig"));

// Validation helpers
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePhone = (phone) => !phone || /^0\d{9}$/.test(phone);
const validatePassword = (password) => password && password.length >= 6;
const sanitizeInput = (str) => str ? String(str).trim().slice(0, 255) : '';

// Apply auth middleware to all admin routes
router.use(authenticate);
router.use((req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).send("Bạn không có quyền truy cập trang quản trị.");
    }
    next();
});

// ==================== DASHBOARD ====================

router.get("/dashboard", async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Run all queries in parallel for better performance
        const [userCount, childCount, vaccineCount, todayAppointments] = await Promise.all([
            userRepo().count(),
            childRepo().count(),
            vaccineRepo().count(),
            appointmentRepo().count({
                where: { date: MoreThanOrEqual(today) }
            })
        ]);

        res.render("admin/dashboard", {
            userCount,
            childCount,
            vaccineCount,
            todayAppointments,
            error: null,
            success: null
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.render("admin/dashboard", {
            userCount: 0,
            childCount: 0,
            vaccineCount: 0,
            todayAppointments: 0,
            error: "Lỗi tải dữ liệu",
            success: null
        });
    }
});

// ==================== VACCINES ====================

// List vaccines
router.get("/vaccines", async (req, res) => {
    try {
        const { search, page = 1 } = req.query;
        const limit = 10;
        const pageNum = Math.max(1, parseInt(page) || 1);
        const searchSanitized = sanitizeInput(search);
        const repo = vaccineRepo();

        const query = searchSanitized
            ? { where: { name: Like(`%${searchSanitized}%`) } }
            : {};

        const [vaccines, total] = await repo.findAndCount({
            ...query,
            skip: (pageNum - 1) * limit,
            take: limit,
            order: { id: "DESC" }
        });

        const totalPages = Math.max(1, Math.ceil(total / limit));

        res.render("admin/vaccines/index", {
            vaccines,
            search: searchSanitized,
            currentPage: pageNum,
            totalPages,
            error: null,
            success: req.query.success || null
        });
    } catch (error) {
        console.error('Vaccines list error:', error);
        res.render("admin/vaccines/index", {
            vaccines: [],
            search: "",
            currentPage: 1,
            totalPages: 1,
            error: "Lỗi tải dữ liệu",
            success: null
        });
    }
});

// Add vaccine form
router.get("/vaccines/add", (req, res) => {
    res.render("admin/vaccines/form", {
        vaccine: null,
        error: null,
        success: null
    });
});

// Add vaccine POST
router.post("/vaccines/add", async (req, res) => {
    try {
        const { name, description, price, stock, recommendedAgeMonths, ageLabel } = req.body;

        // Validate required fields
        if (!name || !price) {
            return res.render("admin/vaccines/form", {
                vaccine: req.body,
                error: "Tên và giá vaccine là bắt buộc",
                success: null
            });
        }

        // Validate price is a positive number
        const priceNum = parseFloat(price);
        if (isNaN(priceNum) || priceNum < 0) {
            return res.render("admin/vaccines/form", {
                vaccine: req.body,
                error: "Giá vaccine phải là số dương",
                success: null
            });
        }

        // Validate stock is non-negative
        const stockNum = parseInt(stock) || 0;
        if (stockNum < 0) {
            return res.render("admin/vaccines/form", {
                vaccine: req.body,
                error: "Số lượng tồn kho không được âm",
                success: null
            });
        }

        const repo = vaccineRepo();
        const newVaccine = repo.create({
            name: sanitizeInput(name),
            description: sanitizeInput(description),
            price: priceNum,
            stock: stockNum,
            recommendedAgeMonths: recommendedAgeMonths ? parseInt(recommendedAgeMonths) : null,
            ageLabel: sanitizeInput(ageLabel)
        });
        await repo.save(newVaccine);

        res.redirect("/admin/vaccines?success=Thêm%20vaccine%20thành%20công");
    } catch (error) {
        console.error('Add vaccine error:', error);
        res.render("admin/vaccines/form", {
            vaccine: req.body,
            error: "Lỗi lưu dữ liệu",
            success: null
        });
    }
});

// Edit vaccine form
router.get("/vaccines/edit/:id", async (req, res) => {
    try {
        const repo = vaccineRepo();
        const vaccine = await repo.findOne({ where: { id: parseInt(req.params.id) } });
        if (!vaccine) {
            return res.redirect("/admin/vaccines?error=Không%20tìm%20thấy%20vaccine");
        }
        res.render("admin/vaccines/form", {
            vaccine,
            error: null,
            success: null
        });
    } catch (error) {
        res.redirect("/admin/vaccines?error=Lỗi%20tải%20dữ%20liệu");
    }
});

// Edit vaccine POST
router.post("/vaccines/edit/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.redirect("/admin/vaccines?error=ID%20không%20hợp%20lệ");
        }

        const repo = vaccineRepo();
        const vaccine = await repo.findOne({ where: { id } });
        if (!vaccine) {
            return res.redirect("/admin/vaccines?error=Không%20tìm%20thấy%20vaccine");
        }

        const { name, description, price, stock, recommendedAgeMonths, ageLabel } = req.body;
        if (!name || !price) {
            return res.render("admin/vaccines/form", {
                vaccine: { ...vaccine, ...req.body },
                error: "Tên và giá vaccine là bắt buộc",
                success: null
            });
        }

        // Validate price
        const priceNum = parseFloat(price);
        if (isNaN(priceNum) || priceNum < 0) {
            return res.render("admin/vaccines/form", {
                vaccine: { ...vaccine, ...req.body },
                error: "Giá vaccine phải là số dương",
                success: null
            });
        }

        // Validate stock
        const stockNum = parseInt(stock) || 0;
        if (stockNum < 0) {
            return res.render("admin/vaccines/form", {
                vaccine: { ...vaccine, ...req.body },
                error: "Số lượng tồn kho không được âm",
                success: null
            });
        }

        vaccine.name = sanitizeInput(name);
        vaccine.description = sanitizeInput(description);
        vaccine.price = priceNum;
        vaccine.stock = stockNum;
        vaccine.recommendedAgeMonths = recommendedAgeMonths ? parseInt(recommendedAgeMonths) : null;
        vaccine.ageLabel = sanitizeInput(ageLabel);
        await repo.save(vaccine);

        res.redirect("/admin/vaccines?success=Cập%20nhật%20vaccine%20thành%20công");
    } catch (error) {
        console.error('Edit vaccine error:', error);
        res.render("admin/vaccines/form", {
            vaccine: { ...req.body, id: req.params.id },
            error: "Lỗi lưu dữ liệu",
            success: null
        });
    }
});

// Delete vaccine
router.post("/vaccines/delete/:id", async (req, res) => {
    try {
        const repo = vaccineRepo();
        const vaccine = await repo.findOne({ where: { id: parseInt(req.params.id) } });
        if (vaccine) {
            await repo.remove(vaccine);
        }
        res.redirect("/admin/vaccines?success=Xóa%20vaccine%20thành%20công");
    } catch (error) {
        res.redirect("/admin/vaccines?error=Không%20thể%20xóa%20vaccine%20này");
    }
});

// ==================== SCHEDULE ====================

// List schedules
router.get("/schedule", async (req, res) => {
    try {
        const { month, year } = req.query;
        const now = new Date();

        // Validate and sanitize month/year
        let currentMonth = parseInt(month);
        let currentYear = parseInt(year);

        if (!currentMonth || currentMonth < 1 || currentMonth > 12) {
            currentMonth = now.getMonth() + 1;
        }
        if (!currentYear || currentYear < 2020 || currentYear > 2100) {
            currentYear = now.getFullYear();
        }

        const startDate = new Date(currentYear, currentMonth - 1, 1);
        const endDate = new Date(currentYear, currentMonth, 0);

        const configs = await dailySlotConfigRepo().find({
            where: {
                date: Between(startDate, endDate)
            },
            order: { date: "ASC" }
        });

        // Generate all days in month
        const daysInMonth = [];
        const dayNames = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        for (let d = 1; d <= endDate.getDate(); d++) {
            const date = new Date(currentYear, currentMonth - 1, d);
            const config = configs.find(c => {
                const cDate = new Date(c.date);
                return cDate.getDate() === d;
            });
            daysInMonth.push({
                day: d,
                dayName: dayNames[date.getDay()],
                date: date.toISOString().split('T')[0],
                maxSlots: config ? config.maxSlots : 50,
                hasConfig: !!config,
                isPast: date < todayStart
            });
        }

        res.render("admin/schedule/index", {
            daysInMonth,
            currentMonth,
            currentYear,
            error: null,
            success: req.query.success || null
        });
    } catch (error) {
        console.error('Schedule error:', error);
        res.render("admin/schedule/index", {
            daysInMonth: [],
            currentMonth: new Date().getMonth() + 1,
            currentYear: new Date().getFullYear(),
            error: "Lỗi tải dữ liệu",
            success: null
        });
    }
});

// Update schedule config
router.post("/schedule/update", async (req, res) => {
    try {
        const { date, maxSlots } = req.body;

        // Validate required fields
        if (!date || maxSlots === undefined) {
            return res.redirect("/admin/schedule?error=Vui%20lòng%20nhập%20đầy%20đủ%20thông%20tin");
        }

        // Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
            return res.redirect("/admin/schedule?error=Ngày%20không%20hợp%20lệ");
        }

        // Validate and sanitize maxSlots
        const slotsNum = parseInt(maxSlots);
        if (isNaN(slotsNum) || slotsNum < 0 || slotsNum > 1000) {
            return res.redirect("/admin/schedule?error=Số%20lượng%20slot%20phải%20từ%200-1000");
        }

        const repo = dailySlotConfigRepo();
        let config = await repo.findOne({ where: { date } });

        if (config) {
            config.maxSlots = slotsNum;
        } else {
            config = repo.create({ date, maxSlots: slotsNum });
        }
        await repo.save(config);

        res.redirect("/admin/schedule?success=Cập%20nhật%20lịch%20thành%20công");
    } catch (error) {
        console.error('Schedule update error:', error);
        res.redirect("/admin/schedule?error=Lỗi%20cập%20nhật%20lịch");
    }
});

// ==================== USERS ====================

// List users
router.get("/users", async (req, res) => {
    try {
        const { role, search, page = 1, action, userId } = req.query;
        const limit = 10;
        const pageNum = Math.max(1, parseInt(page) || 1);
        const repo = userRepo();

        // Validate and sanitize role filter
        const validRoles = ['admin', 'parent', 'staff'];
        const filterRole = validRoles.includes(role) ? role : '';

        // Sanitize search
        const searchSanitized = sanitizeInput(search);

        // Build query
        let query = {};
        if (filterRole) {
            query.where = { role: filterRole };
        }
        if (searchSanitized) {
            query.where = { ...query.where, username: Like(`%${searchSanitized}%`) };
        }

        const [users, total] = await repo.findAndCount({
            ...query,
            skip: (pageNum - 1) * limit,
            take: limit,
            order: { id: "DESC" },
            relations: ["children"]
        });

        const totalPages = Math.max(1, Math.ceil(total / limit));

        res.render("admin/users/index", {
            users,
            search: searchSanitized,
            filterRole,
            currentPage: pageNum,
            totalPages,
            error: null,
            success: req.query.success || null
        });
    } catch (error) {
        console.error('Users list error:', error);
        res.render("admin/users/index", {
            users: [],
            search: "",
            filterRole: "",
            currentPage: 1,
            totalPages: 1,
            error: "Lỗi tải dữ liệu",
            success: null
        });
    }
});

// Add user form
router.get("/users/add", (req, res) => {
    res.render("admin/users/form", {
        user: null,
        error: null,
        success: null
    });
});

// Add user POST
router.post("/users/add", async (req, res) => {
    try {
        const { username, email, password, fullName, phone, role } = req.body;

        // Validate required fields
        if (!username || !email || !password) {
            return res.render("admin/users/form", {
                user: req.body,
                error: "Tên đăng nhập, email và mật khẩu là bắt buộc",
                success: null
            });
        }

        // Validate email format
        if (!validateEmail(email)) {
            return res.render("admin/users/form", {
                user: req.body,
                error: "Email không hợp lệ",
                success: null
            });
        }

        // Validate password strength
        if (!validatePassword(password)) {
            return res.render("admin/users/form", {
                user: req.body,
                error: "Mật khẩu phải có ít nhất 6 ký tự",
                success: null
            });
        }

        // Validate phone format if provided
        if (phone && !validatePhone(phone)) {
            return res.render("admin/users/form", {
                user: req.body,
                error: "Số điện thoại phải bắt đầu bằng 0 và có 10 chữ số",
                success: null
            });
        }

        // Validate role
        const validRoles = ['admin', 'parent', 'staff'];
        const userRole = validRoles.includes(role) ? role : 'parent';

        const repo = userRepo();
        const existingUser = await repo.findOne({ where: [{ email }, { username }] });
        if (existingUser) {
            return res.render("admin/users/form", {
                user: req.body,
                error: "Email hoặc tên đăng nhập đã tồn tại",
                success: null
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const newUser = repo.create({
            username: sanitizeInput(username),
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            fullName: sanitizeInput(fullName),
            phone: sanitizeInput(phone),
            role: userRole
        });
        await repo.save(newUser);

        res.redirect("/admin/users?success=Thêm%20người%20dùng%20thành%20công");
    } catch (error) {
        console.error('Add user error:', error);
        res.render("admin/users/form", {
            user: req.body,
            error: "Lỗi lưu dữ liệu",
            success: null
        });
    }
});

// ==================== CHILDREN ====================

// List children
router.get("/children", async (req, res) => {
    try {
        const { search, page = 1 } = req.query;
        const limit = 10;
        const pageNum = Math.max(1, parseInt(page) || 1);
        const searchSanitized = sanitizeInput(search);
        const repo = childRepo();

        const query = searchSanitized
            ? { where: { name: Like(`%${searchSanitized}%`) } }
            : {};

        const [children, total] = await repo.findAndCount({
            ...query,
            skip: (pageNum - 1) * limit,
            take: limit,
            order: { id: "DESC" },
            relations: ["parent"]
        });

        const totalPages = Math.max(1, Math.ceil(total / limit));

        res.render("admin/children/index", {
            children,
            search: searchSanitized,
            currentPage: pageNum,
            totalPages,
            error: null,
            success: null
        });
    } catch (error) {
        console.error('Children list error:', error);
        res.render("admin/children/index", {
            children: [],
            search: "",
            currentPage: 1,
            totalPages: 1,
            error: "Lỗi tải dữ liệu",
            success: null
        });
    }
});

// View child details with appointment history
router.get("/children/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.redirect("/admin/children?error=ID%20không%20hợp%20lệ");
        }

        const repo = childRepo();
        const child = await repo.findOne({
            where: { id },
            relations: ["parent"]
        });

        if (!child) {
            return res.redirect("/admin/children?error=Không%20tìm%20thấy%20hồ%20sơ%20trẻ");
        }

        const appointments = await appointmentRepo().find({
            where: { child: { id: child.id } },
            relations: ["vaccine"],
            order: { date: "DESC" },
            take: 20
        });

        res.render("admin/children/detail", {
            child,
            appointments,
            error: null,
            success: null
        });
    } catch (error) {
        console.error('Child detail error:', error);
        res.redirect("/admin/children?error=Lỗi%20tải%20dữ%20liệu");
    }
});

module.exports = router;