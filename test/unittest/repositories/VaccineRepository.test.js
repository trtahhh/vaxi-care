const VaccineRepository = require('../../../apps/repositories/VaccineRepository');

describe('VaccineRepository', () => {
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
      createQueryBuilder: jest.fn(),
    };
    repo = new VaccineRepository({
      getRepository: jest.fn(() => fakeRepo),
    });
  });

  afterEach(() => jest.clearAllMocks());

  // --- create ---
  test('create returns entity with data', () => {
    const data = { name: 'BCG', price: 150000, stock: 20 };
    const result = repo.create(data);
    expect(fakeRepo.create).toHaveBeenCalledWith(data);
    expect(result.name).toBe('BCG');
  });

  // --- findById ---
  test('findById queries by id', async () => {
    fakeRepo.findOne.mockResolvedValue({ id: 3, name: 'BCG' });
    const result = await repo.findById(3);
    expect(fakeRepo.findOne).toHaveBeenCalledWith({ where: { id: 3 } });
    expect(result.name).toBe('BCG');
  });

  test('findById returns null when not found', async () => {
    fakeRepo.findOne.mockResolvedValue(null);
    const result = await repo.findById(999);
    expect(result).toBeNull();
  });

  // --- findAll ---
  test('findAll returns paginated vaccines', async () => {
    fakeRepo.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const result = await repo.findAll(0, 10);
    expect(fakeRepo.find).toHaveBeenCalledWith({
      skip: 0,
      take: 10,
      order: { id: 'DESC' },
    });
    expect(result).toHaveLength(2);
  });

  test('findAll respects skip and take', async () => {
    fakeRepo.find.mockResolvedValue([{ id: 5 }]);
    await repo.findAll(20, 5);
    const call = fakeRepo.find.mock.calls[0][0];
    expect(call.skip).toBe(20);
    expect(call.take).toBe(5);
  });

  // --- searchByName ---
  test('searchByName uses Like filter with pagination', async () => {
    fakeRepo.find.mockResolvedValue([{ id: 1, name: 'COVID-19' }]);
    await repo.searchByName('COVID', 0, 10);
    expect(fakeRepo.find).toHaveBeenCalledWith({
      where: expect.any(Object),
      skip: 0,
      take: 10,
      order: { id: 'DESC' },
    });
  });

  // --- count ---
  test('count returns total without search', async () => {
    fakeRepo.count.mockResolvedValue(25);
    const result = await repo.count();
    expect(fakeRepo.count).toHaveBeenCalledWith();
    expect(result).toBe(25);
  });

  test('count uses Like when searchName provided', async () => {
    fakeRepo.count.mockResolvedValue(3);
    await repo.count('BCG');
    expect(fakeRepo.count).toHaveBeenCalledWith({
      where: { name: expect.any(Object) },
    });
  });

  // --- insert ---
  test('insert creates and saves vaccine', async () => {
    const vaccine = { name: 'MMR', price: 300000, stock: 15 };
    fakeRepo.create.mockReturnValue(vaccine);
    fakeRepo.save.mockResolvedValue({ id: 7, ...vaccine });
    const result = await repo.insert(vaccine);
    expect(fakeRepo.create).toHaveBeenCalledWith(vaccine);
    expect(fakeRepo.save).toHaveBeenCalledWith(vaccine);
    expect(result.id).toBe(7);
  });

  // --- update ---
  test('update saves the vaccine entity', async () => {
    const vaccine = { id: 3, name: 'Updated', stock: 50 };
    fakeRepo.save.mockResolvedValue(vaccine);
    const result = await repo.update(vaccine);
    expect(fakeRepo.save).toHaveBeenCalledWith(vaccine);
    expect(result.stock).toBe(50);
  });

  // --- delete ---
  test('delete removes vaccine when found', async () => {
    const entity = { id: 3, name: 'ToDelete' };
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

  // --- findLowStock ---
  test('findLowStock uses queryBuilder with stock threshold', async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 1, stock: 2 }]),
    };
    fakeRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await repo.findLowStock(10);
    expect(fakeRepo.createQueryBuilder).toHaveBeenCalledWith('vaccine');
    expect(qb.where).toHaveBeenCalledWith('vaccine.stock < :threshold', { threshold: 10 });
    expect(qb.orderBy).toHaveBeenCalledWith('vaccine.stock', 'ASC');
    expect(result).toEqual([{ id: 1, stock: 2 }]);
  });

  test('findLowStock uses default threshold of 10', async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    fakeRepo.createQueryBuilder.mockReturnValue(qb);

    await repo.findLowStock();
    expect(qb.where).toHaveBeenCalledWith('vaccine.stock < :threshold', { threshold: 10 });
  });
});
