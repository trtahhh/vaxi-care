const NotificationRepository = require('../../../apps/repositories/NotificationRepository');

describe('NotificationRepository', () => {
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
      update: jest.fn(),
    };
    repo = new NotificationRepository({
      getRepository: jest.fn(() => fakeRepo),
    });
  });

  afterEach(() => jest.clearAllMocks());

  // --- create ---
  test('create delegates to repo.create', () => {
    const data = { title: 'Test', message: 'Body', user: { id: 1 } };
    const result = repo.create(data);
    expect(fakeRepo.create).toHaveBeenCalledWith(data);
    expect(result.title).toBe('Test');
  });

  // --- findById ---
  test('findById queries by id with user relation', async () => {
    fakeRepo.findOne.mockResolvedValue({ id: 5, title: 'Notif' });
    const result = await repo.findById(5);
    expect(fakeRepo.findOne).toHaveBeenCalledWith({
      where: { id: 5 },
      relations: ['user'],
    });
    expect(result.title).toBe('Notif');
  });

  test('findById returns null when not found', async () => {
    fakeRepo.findOne.mockResolvedValue(null);
    const result = await repo.findById(999);
    expect(result).toBeNull();
  });

  // --- findByUserId ---
  test('findByUserId returns notifications sorted DESC with limit', async () => {
    const notifications = [{ id: 1 }, { id: 2 }];
    fakeRepo.find.mockResolvedValue(notifications);
    const result = await repo.findByUserId(10, 20);
    expect(fakeRepo.find).toHaveBeenCalledWith({
      where: { user: { id: 10 } },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    expect(result).toHaveLength(2);
  });

  test('findByUserId uses default take of 50', async () => {
    fakeRepo.find.mockResolvedValue([]);
    await repo.findByUserId(5);
    expect(fakeRepo.find).toHaveBeenCalledWith({
      where: { user: { id: 5 } },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  });

  // --- countUnreadByUserId ---
  test('countUnreadByUserId queries with isRead false', async () => {
    fakeRepo.count.mockResolvedValue(3);
    const result = await repo.countUnreadByUserId(7);
    expect(fakeRepo.count).toHaveBeenCalledWith({
      where: { user: { id: 7 }, isRead: false },
    });
    expect(result).toBe(3);
  });

  // --- insert ---
  test('insert creates and saves notification', async () => {
    const notif = { title: 'New', user: { id: 1 }, isRead: false };
    fakeRepo.create.mockReturnValue(notif);
    fakeRepo.save.mockResolvedValue({ id: 99, ...notif });
    const result = await repo.insert(notif);
    expect(fakeRepo.create).toHaveBeenCalledWith(notif);
    expect(fakeRepo.save).toHaveBeenCalledWith(notif);
    expect(result.id).toBe(99);
  });

  // --- markAsRead ---
  test('markAsRead sets isRead true when found', async () => {
    const entity = { id: 1, isRead: false };
    fakeRepo.findOne.mockResolvedValue(entity);
    fakeRepo.save.mockResolvedValue({ ...entity, isRead: true });

    const result = await repo.markAsRead(1, 1);
    expect(fakeRepo.findOne).toHaveBeenCalledWith({ where: { id: 1, user: { id: 1 } } });
    expect(result.isRead).toBe(true);
  });

  test('markAsRead returns null when not found', async () => {
    fakeRepo.findOne.mockResolvedValue(null);
    const result = await repo.markAsRead(999, 1);
    expect(result).toBeNull();
    expect(fakeRepo.save).not.toHaveBeenCalled();
  });

  // --- markAllAsRead ---
  test('markAllAsRead calls bulk update', async () => {
    fakeRepo.update.mockResolvedValue(undefined);
    await repo.markAllAsRead(10);
    expect(fakeRepo.update).toHaveBeenCalledWith(
      { user: { id: 10 }, isRead: false },
      { isRead: true }
    );
  });

  // --- delete ---
  test('delete removes notification when found', async () => {
    const entity = { id: 5, title: 'ToDelete' };
    fakeRepo.findOne.mockResolvedValue(entity);
    fakeRepo.remove.mockResolvedValue(entity);
    const result = await repo.delete(5);
    expect(fakeRepo.findOne).toHaveBeenCalledWith({ where: { id: 5 } });
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
