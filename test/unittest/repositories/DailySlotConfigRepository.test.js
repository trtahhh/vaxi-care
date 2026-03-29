const DailySlotConfigRepository = require('../../../apps/repositories/DailySlotConfigRepository');

describe('DailySlotConfigRepository', () => {
  let repo;
  let fakeRepo;

  beforeEach(() => {
    fakeRepo = {
      create: jest.fn((data) => ({ ...data, _id: Date.now() })),
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn((entity) => Promise.resolve(entity)),
      remove: jest.fn(),
    };
    repo = new DailySlotConfigRepository({
      getRepository: jest.fn(() => fakeRepo),
    });
  });

  afterEach(() => jest.clearAllMocks());

  // --- create ---
  test('create delegates to repo.create with data', () => {
    const data = { date: '2026-04-01', maxSlots: 30 };
    const result = repo.create(data);
    expect(fakeRepo.create).toHaveBeenCalledWith(data);
    expect(result.date).toBe('2026-04-01');
  });

  // --- findByDate ---
  test('findByDate queries by date string', async () => {
    fakeRepo.findOne.mockResolvedValue({ id: 1, date: '2026-04-01', maxSlots: 30 });
    const result = await repo.findByDate('2026-04-01');
    expect(fakeRepo.findOne).toHaveBeenCalledWith({ where: { date: '2026-04-01' } });
    expect(result.maxSlots).toBe(30);
  });

  test('findByDate returns null when not found', async () => {
    fakeRepo.findOne.mockResolvedValue(null);
    const result = await repo.findByDate('2099-12-31');
    expect(result).toBeNull();
  });

  // --- findByDateRange ---
  test('findByDateRange queries with Between clause', async () => {
    const start = new Date('2026-04-01');
    const end = new Date('2026-04-30');
    fakeRepo.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const result = await repo.findByDateRange(start, end);
    expect(fakeRepo.find).toHaveBeenCalledWith({
      where: expect.any(Object),
      order: { date: 'ASC' },
    });
    expect(result).toHaveLength(2);
  });

  // --- upsert (insert path) ---
  test('upsert creates new config when none exists', async () => {
    fakeRepo.findOne.mockResolvedValue(null);
    fakeRepo.create.mockImplementation((data) => data);
    fakeRepo.save.mockResolvedValue({ id: 1, date: '2026-05-01', maxSlots: 40 });

    const result = await repo.upsert('2026-05-01', 40);

    expect(fakeRepo.findOne).toHaveBeenCalledWith({ where: { date: '2026-05-01' } });
    expect(fakeRepo.create).toHaveBeenCalledWith({ date: '2026-05-01', maxSlots: 40 });
    expect(fakeRepo.save).toHaveBeenCalled();
    expect(result.maxSlots).toBe(40);
  });

  // --- upsert (update path) ---
  test('upsert updates existing config', async () => {
    const existing = { id: 5, date: '2026-06-15', maxSlots: 20 };
    fakeRepo.findOne.mockResolvedValue(existing);
    fakeRepo.save.mockResolvedValue({ ...existing, maxSlots: 35 });

    const result = await repo.upsert('2026-06-15', 35);

    expect(fakeRepo.create).not.toHaveBeenCalled();
    expect(fakeRepo.save).toHaveBeenCalledWith({ ...existing, maxSlots: 35 });
    expect(result.maxSlots).toBe(35);
  });

  // --- delete ---
  test('delete removes config when found', async () => {
    const entity = { id: 3, date: '2026-07-01' };
    fakeRepo.findOne.mockResolvedValue(entity);
    fakeRepo.remove.mockResolvedValue(entity);
    const result = await repo.delete(3);
    expect(fakeRepo.findOne).toHaveBeenCalledWith({ where: { id: 3 } });
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
