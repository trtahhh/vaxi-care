const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

// --- Mock AuthService ---
const mockAuthService = {
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  validateToken: jest.fn(),
  refreshAccessToken: jest.fn(),
};

jest.mock('../../../apps/services/AuthService', () => {
  return jest.fn().mockImplementation(() => mockAuthService);
});

const AuthController = require('../../../apps/controllers/auth/AuthController');

// Build minimal test app
function buildTestApp() {
  const app = express();
  app.set('views', __dirname + '/../../../apps/views');
  app.set('view engine', 'ejs');
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Generate CSRF token (mirrors app.js)
  app.use((req, res, next) => {
    let token = req.cookies['csrf-token'];
    if (!token) {
      token = crypto.randomBytes(16).toString('hex');
      res.cookie('csrf-token', token, { httpOnly: false, secure: false, sameSite: 'strict', maxAge: 3600000 });
    }
    res.locals.csrfToken = token;
    next();
  });

  // Mock auth: set req.user from a header
  app.use((req, res, next) => {
    const role = req.headers['x-mock-role'];
    if (role) {
      req.user = { id: role === 'admin' ? 1 : 2, role, email: `${role}@test.com` };
    }
    res.locals.user = req.user || null;
    next();
  });

  app.use('/auth', AuthController);
  return app;
}

// Get a CSRF token by hitting login GET (works without auth).
// Returns token string and sets cookie on the provided agent.
async function getCsrfToken(app, agent) {
  const res = await agent.get('/auth/login');
  // On unauthenticated request, this returns 200 with Set-Cookie header
  const setCookie = res.headers['set-cookie'] || [];
  const csrfCookie = setCookie.find((c) => c.startsWith('csrf-token='));
  if (!csrfCookie) return null;
  return csrfCookie.split(';')[0].split('=')[1];
}

describe('AuthController Integration', () => {
  let app;

  beforeEach(() => {
    app = buildTestApp();
    jest.clearAllMocks();
  });

  // ===== GET /auth/login =====
  describe('GET /auth/login', () => {
    test('renders login form with CSRF token', async () => {
      const agent = request.agent(app);
      const res = await agent.get('/auth/login');
      expect(res.status).toBe(200);
      expect(res.text).toContain('name="_csrf"');
      expect(res.text).toContain('name="email"');
      expect(res.text).toContain('name="password"');
    });

    test('redirects to admin dashboard if already admin', async () => {
      const agent = request.agent(app);
      const res = await agent.get('/auth/login').set('x-mock-role', 'admin');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/admin/dashboard');
    });

    test('redirects to client dashboard if already parent', async () => {
      const agent = request.agent(app);
      const res = await agent.get('/auth/login').set('x-mock-role', 'parent');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/client/dashboard');
    });
  });

  // ===== POST /auth/login =====
  describe('POST /auth/login', () => {
    test('rejects without CSRF token', async () => {
      const agent = request.agent(app);
      const res = await agent.post('/auth/login').send({ email: 'a@b.com', password: 'pass' });
      expect(res.status).toBe(403);
    });

    test('rejects with invalid CSRF token', async () => {
      const agent = request.agent(app);
      const res = await agent
        .post('/auth/login')
        .send({ email: 'a@b.com', password: 'pass', _csrf: 'wrong-token' });
      expect(res.status).toBe(403);
    });

    test('calls AuthService.login with correct credentials', async () => {
      const agent = request.agent(app);
      const csrf = await getCsrfToken(app, agent);
      await agent.post('/auth/login').send({ email: 'a@b.com', password: 'pass123', _csrf: csrf });
      expect(mockAuthService.login).toHaveBeenCalledWith('a@b.com', 'pass123');
    });

    test('redirects to /client/dashboard on parent login success', async () => {
      const agent = request.agent(app);
      mockAuthService.login.mockResolvedValueOnce({
        user: { id: 2, role: 'parent' },
        accessToken: 'tok',
        refreshToken: 'ref',
      });
      const csrf = await getCsrfToken(app, agent);
      const res = await agent.post('/auth/login').send({ email: 'p@test.com', password: 'pass', _csrf: csrf });
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/client/dashboard');
    });

    test('redirects to /admin/dashboard on admin login success', async () => {
      const agent = request.agent(app);
      mockAuthService.login.mockResolvedValueOnce({
        user: { id: 1, role: 'admin' },
        accessToken: 'tok',
        refreshToken: 'ref',
      });
      const csrf = await getCsrfToken(app, agent);
      const res = await agent.post('/auth/login').send({ email: 'admin@test.com', password: 'pass', _csrf: csrf });
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/admin/dashboard');
    });

    test('renders login with error on AuthService failure', async () => {
      const agent = request.agent(app);
      mockAuthService.login.mockRejectedValueOnce(new Error('Email hoặc mật khẩu không đúng.'));
      const csrf = await getCsrfToken(app, agent);
      const res = await agent.post('/auth/login').send({ email: 'wrong@test.com', password: 'wrong', _csrf: csrf });
      expect(res.status).toBe(200);
      expect(res.text).toContain('Email hoặc mật khẩu không đúng');
    });
  });

  // ===== GET /auth/register =====
  describe('GET /auth/register', () => {
    test('renders registration form', async () => {
      const agent = request.agent(app);
      const res = await agent.get('/auth/register');
      expect(res.status).toBe(200);
      expect(res.text).toContain('name="username"');
      expect(res.text).toContain('name="email"');
      expect(res.text).toContain('name="password"');
      expect(res.text).toContain('name="_csrf"');
    });

    test('redirects if already authenticated', async () => {
      const agent = request.agent(app);
      const res = await agent.get('/auth/register').set('x-mock-role', 'parent');
      expect(res.status).toBe(302);
    });
  });

  // ===== POST /auth/register =====
  describe('POST /auth/register', () => {
    test('rejects without CSRF token', async () => {
      const agent = request.agent(app);
      const res = await agent.post('/auth/register').send({ username: 'u', email: 'u@e.com', password: 'pass' });
      expect(res.status).toBe(403);
    });

    test('calls AuthService.register on success', async () => {
      const agent = request.agent(app);
      mockAuthService.register.mockResolvedValueOnce({ id: 5, username: 'newuser', role: 'parent' });
      const csrf = await getCsrfToken(app, agent);
      const res = await agent.post('/auth/register').send({
        username: 'newuser',
        email: 'newuser@test.com',
        password: 'pass123',
        _csrf: csrf,
      });
      expect(mockAuthService.register).toHaveBeenCalled();
      expect(res.status).toBe(200);
      expect(res.text).toContain('Đăng ký thành công');
    });

    test('renders register form with error on failure', async () => {
      const agent = request.agent(app);
      mockAuthService.register.mockRejectedValueOnce(new Error('Email đã tồn tại.'));
      const csrf = await getCsrfToken(app, agent);
      const res = await agent.post('/auth/register').send({
        username: 'existing',
        email: 'exists@test.com',
        password: 'pass123',
        _csrf: csrf,
      });
      expect(res.status).toBe(200);
      expect(res.text).toContain('Email đã tồn tại');
    });
  });

  // ===== POST /auth/logout =====
  describe('POST /auth/logout', () => {
    test('rejects without CSRF token', async () => {
      const agent = request.agent(app);
      const res = await agent.post('/auth/logout');
      expect(res.status).toBe(403);
    });

    test('calls AuthService.logout and redirects', async () => {
      const agent = request.agent(app);
      mockAuthService.logout.mockResolvedValueOnce();
      const csrf = await getCsrfToken(app, agent);
      const res = await agent.post('/auth/logout').send({ _csrf: csrf });
      expect(mockAuthService.logout).toHaveBeenCalled();
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/auth/login');
    });

    test('redirects to login even if logout throws', async () => {
      const agent = request.agent(app);
      mockAuthService.logout.mockRejectedValueOnce(new Error('Token error'));
      const csrf = await getCsrfToken(app, agent);
      const res = await agent.post('/auth/logout').send({ _csrf: csrf });
      // Should still redirect per controller logic
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/auth/login');
    });
  });
});
