const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const mockUserRepo = {
  findByEmail: jest.fn(),
  findByRefreshToken: jest.fn(),
  findById: jest.fn(),
  findByEmailOrUsername: jest.fn(),
  create: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
};

jest.mock('../../../apps/repositories/UserRepository', () => {
  return jest.fn().mockImplementation(() => mockUserRepo);
});

const AuthService = require('../../../apps/services/AuthService');

describe('AuthService', () => {
  let service;

  beforeEach(() => {
    service = new AuthService();
    jest.clearAllMocks();
  });

  test('login throws when missing credentials', async () => {
    await expect(service.login('', '')).rejects.toThrow('Vui lòng nhập email và mật khẩu.');
  });

  test('login succeeds with valid credentials', async () => {
    const hashed = await bcrypt.hash('123456', 10);
    const user = { id: 1, role: 'parent', email: 'a@b.com', password: hashed };
    mockUserRepo.findByEmail.mockResolvedValue(user);
    mockUserRepo.update.mockResolvedValue(user);

    const result = await service.login('a@b.com', '123456');
    expect(result.user.id).toBe(1);
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
  });

  test('register throws for invalid email', async () => {
    await expect(service.register({ username: 'u', email: 'invalid', password: '123456' }))
      .rejects.toThrow('Email không hợp lệ.');
  });

  test('register creates parent user', async () => {
    mockUserRepo.findByEmailOrUsername.mockResolvedValue(null);
    mockUserRepo.create.mockImplementation((d) => d);
    mockUserRepo.insert.mockResolvedValue({ id: 2, role: 'parent' });

    const result = await service.register({ username: 'u', email: 'u@e.com', password: '123456' });
    expect(result.id).toBe(2);
  });

  test('validateToken returns null for invalid token', async () => {
    const payload = await service.validateToken('invalid');
    expect(payload).toBeNull();
  });

  test('validateToken returns payload for valid token', async () => {
    const token = jwt.sign({ id: 1, role: 'parent' }, process.env.JWT_SECRET || 'test', { expiresIn: '15m' });
    const payload = await service.validateToken(token);
    expect(payload.id).toBe(1);
  });
});
