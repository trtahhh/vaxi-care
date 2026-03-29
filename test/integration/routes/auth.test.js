const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

// Build minimal test app (no DB)
function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // CSRF middleware (mirrors app.js)
  app.use((req, res, next) => {
    let token = req.cookies['csrf-token'];
    if (!token) {
      token = crypto.randomBytes(16).toString('hex');
      res.cookie('csrf-token', token, {
        httpOnly: false,
        secure: false,
        sameSite: 'strict',
        maxAge: 3600000,
      });
    }
    res.locals.csrfToken = token;
    next();
  });

  // Mock auth middleware via signed header cookie-like approach for test
  app.use((req, res, next) => {
    const role = req.headers['x-mock-role'];
    if (role) {
      req.user = { id: role === 'admin' ? 1 : 2, role };
    } else {
      req.user = null;
    }
    res.locals.user = req.user;
    next();
  });

  // CSRF guard
  const csrfGuard = (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const cookieToken = req.cookies['csrf-token'];
    const sentToken = req.body._csrf || req.headers['x-csrf-token'];
    if (!cookieToken || !sentToken || cookieToken !== sentToken) {
      return res.status(403).json({ error: 'CSRF token không khớp' });
    }
    next();
  };

  // Routes
  app.get('/auth/login', (req, res) => {
    if (req.user) {
      return res.redirect(req.user.role === 'admin' ? '/admin/dashboard' : '/client/dashboard');
    }
    res.status(200).send(`<html><form action="/auth/login" method="POST">
      <input name="email" />
      <input name="password" />
      <input name="_csrf" value="${res.locals.csrfToken}" />
      <button type="submit">Login</button>
    </form></html>`);
  });

  app.post('/auth/login', csrfGuard, (req, res) => {
    const { email, password } = req.body;
    if (email === 'admin@test.com' && password === 'admin123') {
      return res.redirect('/admin/dashboard');
    }
    if (email === 'parent@test.com' && password === 'parent123') {
      return res.redirect('/client/dashboard');
    }
    return res.status(401).send('Invalid credentials');
  });

  app.post('/auth/logout', csrfGuard, (req, res) => {
    res.status(200).send('Logged out');
  });

  app.get('/admin/dashboard', (req, res) => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).send('Forbidden');
    }
    res.status(200).send('Admin Dashboard');
  });

  app.get('/client/dashboard', (req, res) => {
    if (!req.user) {
      return res.redirect('/auth/login');
    }
    res.status(200).send('Client Dashboard');
  });

  return app;
}

async function fetchCsrf(agent) {
  const res = await agent.get('/auth/login');
  const setCookie = res.headers['set-cookie'] || [];
  const csrfCookie = setCookie.find((c) => c.startsWith('csrf-token='));
  if (!csrfCookie) return null;
  return csrfCookie.split(';')[0].split('=')[1];
}

describe('Auth Integration', () => {
  let app;
  let agent;

  beforeEach(() => {
    app = buildTestApp();
    agent = request.agent(app);
  });

  // --- GET /auth/login ---
  describe('GET /auth/login', () => {
    it('should render login page with CSRF token', async () => {
      const res = await agent.get('/auth/login');
      expect(res.status).toBe(200);
      expect(res.text).toContain('name="_csrf"');
    });

    it('should redirect if already logged in as admin', async () => {
      const res = await agent.get('/auth/login').set('x-mock-role', 'admin');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/admin/dashboard');
    });
  });

  // --- POST /auth/login (CSRF protection) ---
  describe('POST /auth/login', () => {
    it('should reject request without CSRF token', async () => {
      const res = await request(app).post('/auth/login').send({ email: 'test@test.com', password: 'pass' });
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('CSRF');
    });

    it('should reject request with invalid CSRF token', async () => {
      const csrf = await fetchCsrf(agent);
      const res = await agent
        .post('/auth/login')
        .send({ email: 'test@test.com', password: 'pass', _csrf: 'wrong-token' });
      expect(res.status).toBe(403);
    });

    it('should accept request with valid CSRF token', async () => {
      const csrf = await fetchCsrf(agent);
      const res = await agent.post('/auth/login').send({ email: 'admin@test.com', password: 'admin123', _csrf: csrf });
      expect(res.status).toBe(302);
    });

    it('should redirect to /admin/dashboard for admin', async () => {
      const csrf = await fetchCsrf(agent);
      const res = await agent.post('/auth/login').send({ email: 'admin@test.com', password: 'admin123', _csrf: csrf });
      expect(res.headers.location).toBe('/admin/dashboard');
    });

    it('should redirect to /client/dashboard for parent', async () => {
      const csrf = await fetchCsrf(agent);
      const res = await agent.post('/auth/login').send({ email: 'parent@test.com', password: 'parent123', _csrf: csrf });
      expect(res.headers.location).toBe('/client/dashboard');
    });

    it('should return 401 for wrong credentials', async () => {
      const csrf = await fetchCsrf(agent);
      const res = await agent.post('/auth/login').send({ email: 'wrong@test.com', password: 'wrong', _csrf: csrf });
      expect(res.status).toBe(401);
    });
  });

  // --- POST /auth/logout ---
  describe('POST /auth/logout', () => {
    it('should reject without CSRF token', async () => {
      const res = await request(app).post('/auth/logout');
      expect(res.status).toBe(403);
    });

    it('should succeed with valid CSRF', async () => {
      const csrf = await fetchCsrf(agent);
      const res = await agent.post('/auth/logout').send({ _csrf: csrf });
      expect(res.status).toBe(200);
    });
  });

  // --- Protected routes ---
  describe('Protected routes', () => {
    it('should redirect unauthenticated user to login', async () => {
      const res = await request(app).get('/client/dashboard');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/auth/login');
    });

    it('should allow authenticated user to access client dashboard', async () => {
      const res = await request(app)
        .get('/client/dashboard')
        .set('x-mock-role', 'parent');
      expect(res.status).toBe(200);
    });

    it('should deny non-admin to admin dashboard', async () => {
      const res = await request(app)
        .get('/admin/dashboard')
        .set('x-mock-role', 'parent');
      expect(res.status).toBe(403);
    });

    it('should allow admin to access admin dashboard', async () => {
      const res = await request(app)
        .get('/admin/dashboard')
        .set('x-mock-role', 'admin');
      expect(res.status).toBe(200);
    });
  });
});
