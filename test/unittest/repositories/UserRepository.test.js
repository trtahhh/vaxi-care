const UserRepository = require('../../../apps/repositories/UserRepository');

describe('UserRepository', () => {
  let repo;
  let fakeRepo;

  beforeEach(() => {
    fakeRepo = {
      create: jest.fn((data) => ({ ...data, _id: Date.now() })),
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      save: jest.fn((entity) => Promise.resolve(entity)),
      remove: jest.fn(),
    };
    repo = new UserRepository({
      getRepository: jest.fn(() => fakeRepo),
    });
  });

  afterEach(() => jest.clearAllMocks());

  // --- create ---
  test('create returns a new entity with data', () => {
    const data = { username: 'test', email: 'test@test.com' };
    const result = repo.create(data);
    expect(fakeRepo.create).toHaveBeenCalledWith(data);
    expect(result.username).toBe('test');
  });

  // --- findById ---
  test('findById calls repo with correct where clause', async () => {
    fakeRepo.findOne.mockResolvedValue({ id: 1, username: 'test' });
    const result = await repo.findById(1);
    expect(fakeRepo.findOne).toHaveBeenCalledWith({
      where: { id: 1 },
      relations: ['children'],
    });
    expect(result.username).toBe('test');
  });

  test('findById returns null when not found', async () => {
    fakeRepo.findOne.mockResolvedValue(null);
    const result = await repo.findById(999);
    expect(result).toBeNull();
  });

  // --- findByUsername ---
  test('findByUsername queries by username', async () => {
    fakeRepo.findOne.mockResolvedValue({ id: 1 });
    await repo.findByUsername('johndoe');
    expect(fakeRepo.findOne).toHaveBeenCalledWith({ where: { username: 'johndoe' } });
  });

  // --- findByEmail ---
  test('findByEmail queries by email', async () => {
    fakeRepo.findOne.mockResolvedValue({ id: 1 });
    await repo.findByEmail('a@b.com');
    expect(fakeRepo.findOne).toHaveBeenCalledWith({ where: { email: 'a@b.com' } });
  });

  // --- findByEmailOrUsername ---
  test('findByEmailOrUsername uses OR query', async () => {
    fakeRepo.findOne.mockResolvedValue({ id: 1 });
    await repo.findByEmailOrUsername('a@b.com', 'johndoe');
    expect(fakeRepo.findOne).toHaveBeenCalledWith({
      where: [{ email: 'a@b.com' }, { username: 'johndoe' }],
    });
  });

  test('findByEmailOrUsername returns null when not found', async () => {
    fakeRepo.findOne.mockResolvedValue(null);
    const result = await repo.findByEmailOrUsername('x@y.com', 'unknown');
    expect(result).toBeNull();
  });

  // --- findByRefreshToken ---
  test('findByRefreshToken queries by refreshToken', async () => {
    fakeRepo.findOne.mockResolvedValue({ id: 1 });
    await repo.findByRefreshToken('refresh-token-abc');
    expect(fakeRepo.findOne).toHaveBeenCalledWith({
      where: { refreshToken: 'refresh-token-abc' },
    });
  });

  // --- findAll ---
  test('findAll returns paginated users', async () => {
    fakeRepo.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const result = await repo.findAll(0, 10);
    expect(fakeRepo.find).toHaveBeenCalledWith({
      where: {},
      skip: 0,
      take: 10,
      order: { id: 'DESC' },
      relations: ['children'],
    });
    expect(result).toHaveLength(2);
  });

  test('findAll filters by role when provided', async () => {
    fakeRepo.find.mockResolvedValue([{ id: 1, role: 'parent' }]);
    await repo.findAll(0, 10, 'parent');
    expect(fakeRepo.find).toHaveBeenCalledWith({
      where: { role: 'parent' },
      skip: 0,
      take: 10,
      order: { id: 'DESC' },
      relations: ['children'],
    });
  });

  test('findAll filters by searchName using Like', async () => {
    fakeRepo.find.mockResolvedValue([]);
    await repo.findAll(0, 10, null, 'john');
    const call = fakeRepo.find.mock.calls[0][0];
    expect(call.where.username.constructor.name).toBe('FindOperator'); // Like wraps in FindOperator
  });

  // --- count ---
  test('count returns total when no filter', async () => {
    fakeRepo.count.mockResolvedValue(42);
    const result = await repo.count();
    expect(fakeRepo.count).toHaveBeenCalledWith({ where: {} });
    expect(result).toBe(42);
  });

  test('count filters by role', async () => {
    fakeRepo.count.mockResolvedValue(10);
    await repo.count('admin');
    expect(fakeRepo.count).toHaveBeenCalledWith({ where: { role: 'admin' } });
  });

  // --- insert ---
  test('insert creates and saves a user', async () => {
    const user = { username: 'new', email: 'new@test.com' };
    fakeRepo.create.mockReturnValue(user);
    fakeRepo.save.mockResolvedValue({ id: 5, ...user });
    const result = await repo.insert(user);
    expect(fakeRepo.create).toHaveBeenCalledWith(user);
    expect(fakeRepo.save).toHaveBeenCalledWith(user);
    expect(result.id).toBe(5);
  });

  // --- update ---
  test('update saves the user entity', async () => {
    const user = { id: 1, username: 'updated' };
    fakeRepo.save.mockResolvedValue(user);
    const result = await repo.update(user);
    expect(fakeRepo.save).toHaveBeenCalledWith(user);
    expect(result.username).toBe('updated');
  });

  // --- delete ---
  test('delete removes user when found', async () => {
    const entity = { id: 1, username: 'toDelete' };
    fakeRepo.findOne.mockResolvedValue(entity);
    fakeRepo.remove.mockResolvedValue(entity);
    const result = await repo.delete(1);
    expect(fakeRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(fakeRepo.remove).toHaveBeenCalledWith(entity);
    expect(result).toBe(entity);
  });

  test('delete returns null when not found', async () => {
    fakeRepo.findOne.mockResolvedValue(null);
    const result = await repo.delete(999);
    expect(fakeRepo.remove).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
