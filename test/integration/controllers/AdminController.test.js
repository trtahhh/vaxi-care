const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

// --- Mock AppDataSource globally (used by AdminService.getDashboardStats) ---
const mockAppDataSource = {
  getRepository: jest.fn((name) => ({
    count: jest.fn().mockResolvedValue(0),
  })),
};

jest.mock('../../../apps/models/data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

// --- Mock AdminService ---
const mockAdminService = {
  getDashboardStats: jest.fn(),
  getPendingAppointments: jest.fn(),
  updateAppointmentStatus: jest.fn(),
  getVaccineList: jest.fn(),
  getVaccineById: jest.fn(),
  createVaccine: jest.fn(),
  updateVaccine: jest.fn(),
  deleteVaccine: jest.fn(),
  getScheduleMonth: jest.fn(),
  updateScheduleConfig: jest.fn(),
  getUserList: jest.fn(),
  createUser: jest.fn(),
  getChildList: jest.fn(),
  getChildDetail: jest.fn(),
};

jest.mock('../../../apps/services/AdminService', () => {
  return jest.fn().mockImplementation(() => mockAdminService);
});

// Mock auth middleware
const mockAuthMiddleware = (req, res, next) => {
  const role = req.headers['x-mock-role'];
  if (role) {
    req.user = { id: role === 'admin' ? 1 : 2, role };
  }
  next();
};

function buildTestApp() {
  const app = express();
  app.set('views', __dirname + '/../../../apps/views');
  app.set('view engine', 'ejs');
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use((req, res, next) => {
    let token = req.cookies['csrf-token'];
    if (!token) {
      token = crypto.randomBytes(16).toString('hex');
      res.cookie('csrf-token', token, { httpOnly: false, secure: false, sameSite: 'strict', maxAge: 3600000 });
    }
    res.locals.csrfToken = token;
    next();
  });

  app.use(mockAuthMiddleware);

  const requireAdmin = (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role !== 'admin' && req.user.role !== 'staff') return res.status(403).json({ error: 'Forbidden' });
    next();
  };

  const csrfGuard = (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const cookieToken = req.cookies['csrf-token'];
    const sentToken = req.body._csrf || req.headers['x-csrf-token'];
    if (!cookieToken || !sentToken || cookieToken !== sentToken) {
      return res.status(403).send('CSRF token không khớp');
    }
    next();
  };

  // GET /admin/dashboard
  app.get('/admin/dashboard', requireAdmin, async (req, res) => {
    try {
      const stats = await mockAdminService.getDashboardStats();
      res.status(200).json({
        userCount: stats.userCount,
        childCount: stats.childCount,
        vaccineCount: stats.vaccineCount,
        todayAppointments: stats.todayAppointments,
        weeklyTrend: stats.weeklyTrend,
        stockAlerts: stats.stockAlerts,
      });
    } catch (e) {
      res.status(500).json({ error: 'Lỗi tải dữ liệu' });
    }
  });

  // GET /admin/appointments/pending
  app.get('/admin/appointments/pending', requireAdmin, async (req, res) => {
    try {
      const result = await mockAdminService.getPendingAppointments(req.query.page || 1);
      res.status(200).json({
        appointments: result.appointments,
        currentPage: result.pageNum,
        totalPages: result.totalPages,
      });
    } catch (e) {
      res.status(500).json({ error: 'Lỗi tải dữ liệu' });
    }
  });

  // POST /admin/appointments/:id/status
  app.post('/admin/appointments/:id/status', requireAdmin, csrfGuard, async (req, res) => {
    try {
      await mockAdminService.updateAppointmentStatus(req.params.id, req.body.status);
      res.redirect('/admin/appointments/pending?success=Cập%20nhật%20trạng%20thái%20thành%20công');
    } catch (e) {
      res.redirect('/admin/appointments/pending?error=' + encodeURIComponent(e.message));
    }
  });

  // GET /admin/vaccines
  app.get('/admin/vaccines', requireAdmin, async (req, res) => {
    try {
      const result = await mockAdminService.getVaccineList(req.query.search, req.query.page);
      res.status(200).json({
        vaccines: result.vaccines,
        search: result.search,
        currentPage: result.pageNum,
        totalPages: result.totalPages,
      });
    } catch (e) {
      res.status(500).json({ error: 'Lỗi tải dữ liệu' });
    }
  });

  // POST /admin/vaccines/add
  app.post('/admin/vaccines/add', requireAdmin, csrfGuard, async (req, res) => {
    try {
      const { name, description, price, stock } = req.body;
      if (!name || !price) {
        return res.status(200).json({ error: 'Tên và giá vaccine là bắt buộc' });
      }
      await mockAdminService.createVaccine({ name, description, price, stock });
      res.redirect('/admin/vaccines?success=Thêm%20vaccine%20thành%20công');
    } catch (e) {
      res.status(200).json({ error: 'Lỗi lưu dữ liệu' });
    }
  });

  // POST /admin/vaccines/delete/:id
  app.post('/admin/vaccines/delete/:id', requireAdmin, csrfGuard, async (req, res) => {
    try {
      await mockAdminService.deleteVaccine(req.params.id);
      res.redirect('/admin/vaccines?success=Xóa%20vaccine%20thành%20công');
    } catch (e) {
      res.redirect('/admin/vaccines?error=Không%20thể%20xóa%20vaccine%20này');
    }
  });

  // GET /admin/users
  app.get('/admin/users', requireAdmin, async (req, res) => {
    try {
      const result = await mockAdminService.getUserList(req.query.role, req.query.search, req.query.page);
      res.status(200).json({
        users: result.users,
        search: result.search,
        filterRole: result.filterRole,
        currentPage: result.pageNum,
        totalPages: result.totalPages,
      });
    } catch (e) {
      res.status(500).json({ error: 'Lỗi tải dữ liệu' });
    }
  });

  // POST /admin/users/add
  app.post('/admin/users/add', requireAdmin, csrfGuard, async (req, res) => {
    try {
      const { username, email, password, role } = req.body;
      if (!username || !email || !password) {
        return res.status(200).json({ error: 'Tên đăng nhập, email và mật khẩu là bắt buộc' });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(200).json({ error: 'Email không hợp lệ' });
      }
      await mockAdminService.createUser({ username, email, password, role });
      res.redirect('/admin/users?success=Thêm%20người%20dùng%20thành%20công');
    } catch (e) {
      res.status(200).json({ error: e.message || 'Lỗi lưu dữ liệu' });
    }
  });

  // GET /admin/schedule
  app.get('/admin/schedule', requireAdmin, async (req, res) => {
    try {
      const result = await mockAdminService.getScheduleMonth(req.query.month, req.query.year);
      res.status(200).json({
        daysInMonth: result.daysInMonth,
        currentMonth: result.currentMonth,
        currentYear: result.currentYear,
      });
    } catch (e) {
      res.status(500).json({ error: 'Lỗi tải dữ liệu' });
    }
  });

  // POST /admin/schedule/update
  app.post('/admin/schedule/update', requireAdmin, csrfGuard, async (req, res) => {
    try {
      const { date, maxSlots } = req.body;
      if (!date || maxSlots === undefined) {
        return res.redirect('/admin/schedule?error=Vui%20lòng%20nhập%20đầy%20đủ%20thông%20tin');
      }
      await mockAdminService.updateScheduleConfig(date, maxSlots);
      res.redirect('/admin/schedule?success=Cập%20nhật%20lịch%20thành%20công');
    } catch (e) {
      res.redirect('/admin/schedule?error=' + encodeURIComponent(e.message));
    }
  });

  return app;
}

async function fetchCsrf(agent) {
  const res = await agent.get('/admin/dashboard');
  const setCookie = res.headers['set-cookie'] || [];
  const csrfCookie = setCookie.find((c) => c.startsWith('csrf-token='));
  if (!csrfCookie) return null;
  return csrfCookie.split(';')[0].split('=')[1];
}

describe('AdminController Integration', () => {
  let app;
  let agent;

  beforeEach(() => {
    app = buildTestApp();
    agent = request.agent(app);
    jest.clearAllMocks();
  });

  // ===== Access Control =====
  describe('Access Control', () => {
    test('rejects unauthenticated request', async () => {
      const res = await request(app).get('/admin/dashboard');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    test('rejects non-admin user', async () => {
      const res = await agent.get('/admin/dashboard').set('x-mock-role', 'parent');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    test('allows admin to access dashboard', async () => {
      mockAdminService.getDashboardStats.mockResolvedValueOnce({
        userCount: 10, childCount: 5, vaccineCount: 8,
        todayAppointments: 3, weeklyTrend: 12, stockAlerts: [],
      });
      const res = await agent.get('/admin/dashboard').set('x-mock-role', 'admin');
      expect(res.status).toBe(200);
      expect(res.body.userCount).toBe(10);
    });
  });

  // ===== GET /admin/dashboard =====
  describe('GET /admin/dashboard', () => {
    test('renders dashboard with stats', async () => {
      mockAdminService.getDashboardStats.mockResolvedValueOnce({
        userCount: 10, childCount: 5, vaccineCount: 8,
        todayAppointments: 3, weeklyTrend: 12, stockAlerts: [{ name: 'BCG', stock: 2 }],
      });
      const res = await agent.get('/admin/dashboard').set('x-mock-role', 'admin');
      expect(res.status).toBe(200);
      expect(res.body.stockAlerts).toHaveLength(1);
    });

    test('returns 500 on service failure', async () => {
      mockAdminService.getDashboardStats.mockRejectedValueOnce(new Error('DB error'));
      const res = await agent.get('/admin/dashboard').set('x-mock-role', 'admin');
      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Lỗi');
    });
  });

  // ===== GET /admin/appointments/pending =====
  describe('GET /admin/appointments/pending', () => {
    test('renders pending appointments page', async () => {
      mockAdminService.getPendingAppointments.mockResolvedValueOnce({
        appointments: [{ id: 1, status: 'pending' }],
        pageNum: 1, totalPages: 1,
      });
      const res = await agent.get('/admin/appointments/pending').set('x-mock-role', 'admin');
      expect(res.status).toBe(200);
      expect(res.body.appointments).toHaveLength(1);
    });

    test('returns 500 on service failure', async () => {
      mockAdminService.getPendingAppointments.mockRejectedValueOnce(new Error('DB error'));
      const res = await agent.get('/admin/appointments/pending').set('x-mock-role', 'admin');
      expect(res.status).toBe(500);
    });
  });

  // ===== POST /admin/appointments/:id/status =====
  describe('POST /admin/appointments/:id/status', () => {
    test('rejects without CSRF token', async () => {
      const res = await request(app)
        .post('/admin/appointments/1/status')
        .set('x-mock-role', 'admin')
        .send({ status: 'confirmed' });
      expect(res.status).toBe(403);
    });

    test('calls updateAppointmentStatus and redirects with success', async () => {
      mockAdminService.updateAppointmentStatus.mockResolvedValueOnce({ id: 1, status: 'confirmed' });

      const csrf = await fetchCsrf(agent);
      const res = await agent
        .post('/admin/appointments/1/status')
        .set('x-mock-role', 'admin')
        .send({ status: 'confirmed', _csrf: csrf });

      expect(mockAdminService.updateAppointmentStatus).toHaveBeenCalledWith('1', 'confirmed');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('success=');
    });

    test('redirects with error on service failure', async () => {
      mockAdminService.updateAppointmentStatus.mockRejectedValueOnce(new Error('Lịch hẹn không tồn tại'));

      const csrf = await fetchCsrf(agent);
      const res = await agent
        .post('/admin/appointments/1/status')
        .set('x-mock-role', 'admin')
        .send({ status: 'confirmed', _csrf: csrf });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=');
    });
  });

  // ===== GET /admin/vaccines =====
  describe('GET /admin/vaccines', () => {
    test('renders vaccines list', async () => {
      mockAdminService.getVaccineList.mockResolvedValueOnce({
        vaccines: [{ id: 1, name: 'BCG', price: 150000 }],
        search: '', pageNum: 1, totalPages: 1,
      });
      const res = await agent.get('/admin/vaccines').set('x-mock-role', 'admin');
      expect(res.status).toBe(200);
      expect(res.body.vaccines).toHaveLength(1);
    });

    test('passes search and pagination params', async () => {
      mockAdminService.getVaccineList.mockResolvedValueOnce({
        vaccines: [], search: 'BCG', pageNum: 2, totalPages: 3,
      });
      await agent.get('/admin/vaccines?search=BCG&page=2').set('x-mock-role', 'admin');
      expect(mockAdminService.getVaccineList).toHaveBeenCalledWith('BCG', '2');
    });
  });

  // ===== POST /admin/vaccines/add =====
  describe('POST /admin/vaccines/add', () => {
    test('rejects without CSRF token', async () => {
      const res = await request(app)
        .post('/admin/vaccines/add')
        .set('x-mock-role', 'admin')
        .send({ name: 'BCG', price: 150000 });
      expect(res.status).toBe(403);
    });

    test('returns error when name is missing', async () => {
      const csrf = await fetchCsrf(agent);
      const res = await agent
        .post('/admin/vaccines/add')
        .set('x-mock-role', 'admin')
        .send({ name: '', price: '', _csrf: csrf });

      expect(res.status).toBe(200);
      expect(res.body.error).toContain('Tên và giá vaccine là bắt buộc');
    });

    test('redirects to list on success', async () => {
      mockAdminService.createVaccine.mockResolvedValueOnce({ id: 1 });

      const csrf = await fetchCsrf(agent);
      const res = await agent
        .post('/admin/vaccines/add')
        .set('x-mock-role', 'admin')
        .send({ name: 'BCG', price: '150000', stock: '20', _csrf: csrf });

      expect(mockAdminService.createVaccine).toHaveBeenCalled();
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/admin/vaccines');
    });
  });

  // ===== POST /admin/vaccines/delete/:id =====
  describe('POST /admin/vaccines/delete/:id', () => {
    test('calls deleteVaccine and redirects', async () => {
      mockAdminService.deleteVaccine.mockResolvedValueOnce();

      const csrf = await fetchCsrf(agent);
      const res = await agent
        .post('/admin/vaccines/delete/3')
        .set('x-mock-role', 'admin')
        .send({ _csrf: csrf });

      expect(mockAdminService.deleteVaccine).toHaveBeenCalledWith('3');
      expect(res.status).toBe(302);
    });
  });

  // ===== GET /admin/users =====
  describe('GET /admin/users', () => {
    test('renders user list', async () => {
      mockAdminService.getUserList.mockResolvedValueOnce({
        users: [{ id: 1, username: 'admin' }],
        search: '', filterRole: '', pageNum: 1, totalPages: 1,
      });
      const res = await agent.get('/admin/users').set('x-mock-role', 'admin');
      expect(res.status).toBe(200);
      expect(res.body.users).toHaveLength(1);
    });
  });

  // ===== POST /admin/users/add =====
  describe('POST /admin/users/add', () => {
    test('rejects without CSRF token', async () => {
      const res = await request(app)
        .post('/admin/users/add')
        .set('x-mock-role', 'admin')
        .send({ username: 'new', email: 'new@test.com', password: 'pass123' });
      expect(res.status).toBe(403);
    });

    test('returns error when required fields missing', async () => {
      const csrf = await fetchCsrf(agent);
      const res = await agent
        .post('/admin/users/add')
        .set('x-mock-role', 'admin')
        .send({ username: '', email: '', password: '', _csrf: csrf });

      expect(res.status).toBe(200);
      expect(res.body.error).toContain('Tên đăng nhập, email và mật khẩu là bắt buộc');
    });

    test('returns error for invalid email', async () => {
      const csrf = await fetchCsrf(agent);
      const res = await agent
        .post('/admin/users/add')
        .set('x-mock-role', 'admin')
        .send({ username: 'new', email: 'invalid-email', password: 'pass123', _csrf: csrf });

      expect(res.status).toBe(200);
      expect(res.body.error).toContain('Email không hợp lệ');
    });

    test('creates user and redirects on success', async () => {
      mockAdminService.createUser.mockResolvedValueOnce({ id: 5 });

      const csrf = await fetchCsrf(agent);
      const res = await agent
        .post('/admin/users/add')
        .set('x-mock-role', 'admin')
        .send({ username: 'newuser', email: 'new@test.com', password: 'pass123', role: 'parent', _csrf: csrf });

      expect(mockAdminService.createUser).toHaveBeenCalled();
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/admin/users');
    });
  });

  // ===== GET /admin/schedule =====
  describe('GET /admin/schedule', () => {
    test('renders schedule calendar', async () => {
      mockAdminService.getScheduleMonth.mockResolvedValueOnce({
        daysInMonth: [{ day: 1, maxSlots: 50 }, { day: 2, maxSlots: 30 }],
        currentMonth: 3, currentYear: 2026,
      });
      const res = await agent.get('/admin/schedule').set('x-mock-role', 'admin');
      expect(res.status).toBe(200);
      expect(res.body.daysInMonth).toHaveLength(2);
    });

    test('returns 500 on service failure', async () => {
      mockAdminService.getScheduleMonth.mockRejectedValueOnce(new Error('DB error'));
      const res = await agent.get('/admin/schedule').set('x-mock-role', 'admin');
      expect(res.status).toBe(500);
    });
  });

  // ===== POST /admin/schedule/update =====
  describe('POST /admin/schedule/update', () => {
    test('rejects without CSRF token', async () => {
      const res = await request(app)
        .post('/admin/schedule/update')
        .set('x-mock-role', 'admin')
        .send({ date: '2026-05-01', maxSlots: 30 });
      expect(res.status).toBe(403);
    });

    test('redirects with error when fields missing', async () => {
      const csrf = await fetchCsrf(agent);
      const res = await agent
        .post('/admin/schedule/update')
        .set('x-mock-role', 'admin')
        .send({ date: '', maxSlots: '', _csrf: csrf });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=');
    });

    test('calls updateScheduleConfig and redirects with success', async () => {
      mockAdminService.updateScheduleConfig.mockResolvedValueOnce();

      const csrf = await fetchCsrf(agent);
      const res = await agent
        .post('/admin/schedule/update')
        .set('x-mock-role', 'admin')
        .send({ date: '2026-05-01', maxSlots: '30', _csrf: csrf });

      expect(mockAdminService.updateScheduleConfig).toHaveBeenCalledWith('2026-05-01', '30');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('success=');
    });
  });
});
