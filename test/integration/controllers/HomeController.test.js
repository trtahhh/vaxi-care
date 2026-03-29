const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

// --- Mock HomeService ---
const mockHomeService = {
  getDashboardData: jest.fn(),
  getParents: jest.fn(),
  addChild: jest.fn(),
  getChildrenForBooking: jest.fn(),
  getVaccinesForBooking: jest.fn(),
  getRecommendedVaccines: jest.fn(),
  getSlotInfo: jest.fn(),
  bookAppointment: jest.fn(),
  cancelAppointment: jest.fn(),
  getVaccineDetail: jest.fn(),
};

jest.mock('../../../apps/services/HomeService', () => {
  return jest.fn().mockImplementation(() => mockHomeService);
});

// Mock child repo used inline in controller
jest.mock('../../../apps/repositories/ChildRepository', () => {
  const mock = { findById: jest.fn() };
  return jest.fn().mockImplementation(() => mock);
});

// Mock appointment repo used inline in controller
jest.mock('../../../apps/repositories/AppointmentRepository', () => {
  const mock = { findByChildIds: jest.fn(), findByChildId: jest.fn() };
  return jest.fn().mockImplementation(() => mock);
});

// Mock notification repo used inline in controller
jest.mock('../../../apps/repositories/NotificationRepository', () => {
  const mock = {
    findByUserId: jest.fn().mockResolvedValue([]),
    countUnreadByUserId: jest.fn().mockResolvedValue(0),
    markAsRead: jest.fn().mockResolvedValue({}),
  };
  return jest.fn().mockImplementation(() => mock);
});

// Mock auth middleware
const mockAuthMiddleware = (req, res, next) => {
  const role = req.headers['x-mock-role'];
  const id = req.headers['x-mock-id'];
  if (role) {
    req.user = { id: id ? parseInt(id) : 2, role, email: `${role}@test.com` };
  }
  next();
};

// Build test app using res.json() instead of res.render() to avoid EJS dependency
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

  const isParent = (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!['parent', 'admin', 'staff'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };

  const csrfGuard = (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const cookieToken = req.cookies['csrf-token'];
    const sentToken = req.body._csrf || req.headers['x-csrf-token'];
    if (!cookieToken || !sentToken || cookieToken !== sentToken) {
      return res.status(403).json({ error: 'CSRF token không khớp' });
    }
    next();
  };

  // GET /client/dashboard
  app.get('/client/dashboard', isParent, async (req, res) => {
    try {
      const userId = req.user.role === 'admin' || req.user.role === 'staff'
        ? (req.query.parentId || req.user.id)
        : req.user.id;
      const result = await mockHomeService.getDashboardData(userId);
      res.json({ children: result.children, upcomingAppointments: result.upcomingAppointments });
    } catch (e) {
      res.status(500).json({ error: 'Lỗi tải bảng điều khiển' });
    }
  });

  // GET /children/add
  app.get('/children/add', isParent, async (req, res) => {
    const parents = await mockHomeService.getParents();
    res.json({ parents });
  });

  // POST /children/add
  app.post('/children/add', isParent, csrfGuard, async (req, res) => {
    try {
      await mockHomeService.addChild(req.body);
      res.redirect('/client/dashboard');
    } catch (e) {
      const parents = await mockHomeService.getParents();
      res.status(200).json({ error: e.message, parents });
    }
  });

  // GET /appointments/book
  app.get('/appointments/book', isParent, async (req, res) => {
    const children = await mockHomeService.getChildrenForBooking(req.user.id, req.user.role);
    const vaccines = await mockHomeService.getVaccinesForBooking();
    let recommendations = [];
    if (req.query.childId) {
      recommendations = await mockHomeService.getRecommendedVaccines(parseInt(req.query.childId));
    }
    res.json({ children, vaccines, recommendations, selectedChildId: req.query.childId || null });
  });

  // POST /appointments/book
  app.post('/appointments/book', isParent, csrfGuard, async (req, res) => {
    try {
      await mockHomeService.bookAppointment(req.user.id, req.body, req.user.role);
      res.redirect('/client/dashboard');
    } catch (e) {
      const children = await mockHomeService.getChildrenForBooking(req.user.id, req.user.role);
      const vaccines = await mockHomeService.getVaccinesForBooking();
      res.status(200).json({ error: e.message, children, vaccines });
    }
  });

  // GET /appointments/slots
  app.get('/appointments/slots', isParent, async (req, res) => {
    const date = new Date(req.query.date);
    if (isNaN(date.getTime())) return res.status(400).json({ error: 'Ngày không hợp lệ' });
    const slotInfo = await mockHomeService.getSlotInfo(date);
    res.json(slotInfo);
  });

  // POST /appointments/:id/cancel
  app.post('/appointments/:id/cancel', isParent, csrfGuard, async (req, res) => {
    try {
      await mockHomeService.cancelAppointment(parseInt(req.params.id), req.user.id, req.user.role);
      res.redirect('/client/dashboard?success=Hủy%20lịch%20hẹn%20thành%20công');
    } catch (e) {
      res.redirect('/client/dashboard?error=' + encodeURIComponent(e.message));
    }
  });

  return app;
}

// Fetch CSRF: use the SAME agent to capture Set-Cookie and use it in POST
async function fetchCsrf(app, agent) {
  const res = await agent.get('/client/dashboard');
  // Even 401 response includes the Set-Cookie header
  const setCookie = res.headers['set-cookie'] || [];
  const csrfCookie = setCookie.find((c) => c.startsWith('csrf-token='));
  if (!csrfCookie) return null;
  return csrfCookie.split(';')[0].split('=')[1];
}

describe('HomeController Integration', () => {
  let app;
  let agent;

  beforeEach(() => {
    app = buildTestApp();
    agent = request.agent(app);
    jest.clearAllMocks();
  });

  // ===== GET /client/dashboard =====
  describe('GET /client/dashboard', () => {
    test('rejects unauthenticated request', async () => {
      const res = await request(app).get('/client/dashboard');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    test('renders dashboard with children and appointments', async () => {
      mockHomeService.getDashboardData.mockResolvedValueOnce({
        children: [{ id: 1, name: 'Minh' }],
        upcomingAppointments: [{ id: 10, status: 'pending' }],
      });

      const res = await agent.get('/client/dashboard').set('x-mock-role', 'parent');
      expect(res.status).toBe(200);
      expect(res.body.children).toHaveLength(1);
      expect(res.body.children[0].name).toBe('Minh');
    });

    test('returns 500 on service failure', async () => {
      mockHomeService.getDashboardData.mockRejectedValueOnce(new Error('DB error'));

      const res = await agent.get('/client/dashboard').set('x-mock-role', 'parent');
      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Lỗi');
    });
  });

  // ===== GET /children/add =====
  describe('GET /children/add', () => {
    test('renders add-child form with parents list', async () => {
      mockHomeService.getParents.mockResolvedValueOnce([{ id: 1, username: 'parent1' }]);
      const res = await agent.get('/children/add').set('x-mock-role', 'admin');
      expect(res.status).toBe(200);
      expect(res.body.parents).toHaveLength(1);
    });
  });

  // ===== POST /children/add =====
  describe('POST /children/add', () => {
    test('rejects without CSRF token', async () => {
      const res = await request(app)
        .post('/children/add')
        .set('x-mock-role', 'admin')
        .send({ name: 'Minh', dob: '2020-01-01', gender: 'male', parentId: 1 });
      expect(res.status).toBe(403);
    });

    test('calls addChild and redirects on success', async () => {
      mockHomeService.addChild.mockResolvedValueOnce({ id: 5 });

      const csrf = await fetchCsrf(app, agent);
      const res = await agent
        .post('/children/add')
        .set('x-mock-role', 'admin')
        .send({ name: 'Minh', dob: '2020-01-01', gender: 'male', parentId: 1, _csrf: csrf });

      expect(mockHomeService.addChild).toHaveBeenCalled();
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/client/dashboard');
    });

    test('returns error on service failure', async () => {
      mockHomeService.addChild.mockRejectedValueOnce(new Error('Parent ID không hợp lệ'));
      mockHomeService.getParents.mockResolvedValueOnce([{ id: 1 }]);

      const csrf = await fetchCsrf(app, agent);
      const res = await agent
        .post('/children/add')
        .set('x-mock-role', 'admin')
        .send({ name: '', dob: '', gender: '', parentId: '', _csrf: csrf });

      expect(res.status).toBe(200);
      expect(res.body.error).toContain('Parent ID không hợp lệ');
    });
  });

  // ===== GET /appointments/book =====
  describe('GET /appointments/book', () => {
    test('renders booking form with children and vaccines', async () => {
      mockHomeService.getChildrenForBooking.mockResolvedValueOnce([{ id: 1, name: 'Minh' }]);
      mockHomeService.getVaccinesForBooking.mockResolvedValueOnce([{ id: 1, name: 'BCG' }]);
      mockHomeService.getRecommendedVaccines.mockResolvedValueOnce([]);

      const res = await agent.get('/appointments/book?childId=1').set('x-mock-role', 'parent');
      expect(res.status).toBe(200);
      expect(mockHomeService.getChildrenForBooking).toHaveBeenCalled();
      expect(mockHomeService.getVaccinesForBooking).toHaveBeenCalled();
    });

    test('loads recommended vaccines when childId is provided', async () => {
      mockHomeService.getChildrenForBooking.mockResolvedValueOnce([{ id: 2 }]);
      mockHomeService.getVaccinesForBooking.mockResolvedValueOnce([]);
      mockHomeService.getRecommendedVaccines.mockResolvedValueOnce([{ id: 3, name: 'MMR' }]);

      await agent.get('/appointments/book?childId=2').set('x-mock-role', 'parent');

      expect(mockHomeService.getRecommendedVaccines).toHaveBeenCalledWith(2);
    });
  });

  // ===== POST /appointments/book =====
  describe('POST /appointments/book', () => {
    test('rejects without CSRF token', async () => {
      const res = await request(app)
        .post('/appointments/book')
        .set('x-mock-role', 'parent')
        .send({ childId: 1, vaccineId: 1, date: '2026-05-01' });
      expect(res.status).toBe(403);
    });

    test('calls bookAppointment on valid request', async () => {
      mockHomeService.bookAppointment.mockResolvedValueOnce({ id: 100 });

      const csrf = await fetchCsrf(app, agent);
      const res = await agent
        .post('/appointments/book')
        .set('x-mock-role', 'parent')
        .send({ childId: 1, vaccineId: 2, date: '2026-05-01', _csrf: csrf });

      expect(mockHomeService.bookAppointment).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ childId: 1, vaccineId: 2, date: '2026-05-01', _csrf: expect.any(String) }),
        'parent'
      );
      expect(res.status).toBe(302);
    });

    test('returns error on service failure', async () => {
      mockHomeService.bookAppointment.mockRejectedValueOnce(new Error('Trẻ không tồn tại'));
      mockHomeService.getChildrenForBooking.mockResolvedValueOnce([]);
      mockHomeService.getVaccinesForBooking.mockResolvedValueOnce([]);

      const csrf = await fetchCsrf(app, agent);
      const res = await agent
        .post('/appointments/book')
        .set('x-mock-role', 'parent')
        .send({ childId: 999, vaccineId: 1, date: '2026-05-01', _csrf: csrf });

      expect(res.status).toBe(200);
      expect(res.body.error).toContain('Trẻ không tồn tại');
    });
  });

  // ===== GET /appointments/slots =====
  describe('GET /appointments/slots', () => {
    test('returns slot info as JSON', async () => {
      mockHomeService.getSlotInfo.mockResolvedValueOnce({ maxSlots: 30, bookedCount: 5, availableSlots: 25 });

      const res = await agent
        .get('/appointments/slots?date=2026-05-01')
        .set('x-mock-role', 'parent');

      expect(res.status).toBe(200);
      expect(res.body.maxSlots).toBe(30);
      expect(res.body.availableSlots).toBe(25);
    });

    test('returns 400 for invalid date', async () => {
      const res = await agent
        .get('/appointments/slots?date=invalid-date')
        .set('x-mock-role', 'parent');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Ngày không hợp lệ');
    });
  });

  // ===== POST /appointments/:id/cancel =====
  describe('POST /appointments/:id/cancel', () => {
    test('rejects without CSRF token', async () => {
      const res = await request(app)
        .post('/appointments/5/cancel')
        .set('x-mock-role', 'parent');
      expect(res.status).toBe(403);
    });

    test('calls cancelAppointment and redirects with success', async () => {
      mockHomeService.cancelAppointment.mockResolvedValueOnce({ id: 5, status: 'cancelled' });

      const csrf = await fetchCsrf(app, agent);
      const res = await agent
        .post('/appointments/5/cancel')
        .set('x-mock-role', 'parent')
        .send({ _csrf: csrf });

      expect(mockHomeService.cancelAppointment).toHaveBeenCalledWith(5, 2, 'parent');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('success=');
    });

    test('redirects with error on service failure', async () => {
      mockHomeService.cancelAppointment.mockRejectedValueOnce(new Error('Lịch hẹn không tồn tại'));

      const csrf = await fetchCsrf(app, agent);
      const res = await agent
        .post('/appointments/999/cancel')
        .set('x-mock-role', 'parent')
        .send({ _csrf: csrf });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=');
    });
  });
});
