const AppointmentRepository = require('../../../apps/repositories/AppointmentRepository');

describe('AppointmentRepository', () => {
  let repo;
  let fakeRepo;

  beforeEach(() => {
    fakeRepo = {
      create: jest.fn((data) => ({ ...data, _id: Date.now() })),
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      count: jest.fn(),
      save: jest.fn((entity) => Promise.resolve(entity)),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    repo = new AppointmentRepository({
      getRepository: jest.fn(() => fakeRepo),
    });
  });

  afterEach(() => jest.clearAllMocks());

  // --- create ---
  test('create delegates to repo.create', () => {
    const data = { date: new Date(), status: 'pending' };
    const result = repo.create(data);
    expect(fakeRepo.create).toHaveBeenCalledWith(data);
    expect(result.status).toBe('pending');
  });

  // --- findById ---
  test('findById queries by id with relations', async () => {
    const appt = { id: 5, status: 'pending' };
    fakeRepo.findOne.mockResolvedValue(appt);
    const result = await repo.findById(5);
    expect(fakeRepo.findOne).toHaveBeenCalledWith({
      where: { id: 5 },
      relations: ['child', 'vaccine'],
    });
    expect(result.id).toBe(5);
  });

  test('findById returns null when not found', async () => {
    fakeRepo.findOne.mockResolvedValue(null);
    const result = await repo.findById(999);
    expect(result).toBeNull();
  });

  // --- findByChildId ---
  test('findByChildId queries with child relation sorted by date DESC', async () => {
    fakeRepo.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const result = await repo.findByChildId(3);
    expect(fakeRepo.find).toHaveBeenCalledWith({
      where: { child: { id: 3 } },
      relations: ['vaccine'],
      order: { date: 'DESC' },
    });
    expect(result).toHaveLength(2);
  });

  // --- findByChildIds ---
  test('findByChildIds returns [] for empty input', async () => {
    const result = await repo.findByChildIds([]);
    expect(result).toEqual([]);
    expect(fakeRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  test('findByChildIds uses queryBuilder with IN clause', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 1 }]),
    };
    fakeRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await repo.findByChildIds([1, 2]);
    expect(fakeRepo.createQueryBuilder).toHaveBeenCalledWith('appointment');
    expect(qb.leftJoinAndSelect).toHaveBeenCalled();
    expect(qb.where).toHaveBeenCalledWith('child.id IN (:...childIds)', { childIds: [1, 2] });
    expect(qb.orderBy).toHaveBeenCalledWith('appointment.date', 'ASC');
    expect(result).toHaveLength(1);
  });

  // --- findByDateRange ---
  test('findByDateRange uses Between clause with relations', async () => {
    fakeRepo.find.mockResolvedValue([{ id: 1 }]);
    const start = new Date('2026-04-01');
    const end = new Date('2026-04-30');
    await repo.findByDateRange(start, end);
    expect(fakeRepo.find).toHaveBeenCalledWith({
      where: { date: expect.any(Object) },
      relations: ['child', 'vaccine'],
    });
  });

  // --- findByDate ---
  test('findByDate uses queryBuilder with date filter', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 7 }]),
    };
    fakeRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await repo.findByDate(new Date('2026-05-01'));
    expect(fakeRepo.createQueryBuilder).toHaveBeenCalledWith('appointment');
    expect(qb.where).toHaveBeenCalledWith('DATE(appointment.date) = :date', { date: '2026-05-01' });
    expect(result).toHaveLength(1);
  });

  // --- countUpcomingFromDate ---
  test('countUpcomingFromDate uses MoreThanOrEqual', async () => {
    fakeRepo.count.mockResolvedValue(15);
    const date = new Date('2026-05-01');
    await repo.countUpcomingFromDate(date);
    expect(fakeRepo.count).toHaveBeenCalledWith({ where: { date: expect.any(Object) } });
  });

  // --- countByDate ---
  test('countByDate excludes cancelled appointments', async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(3),
    };
    fakeRepo.createQueryBuilder.mockReturnValue(qb);

    await repo.countByDate(new Date('2026-05-01'));
    expect(qb.andWhere).toHaveBeenCalledWith('appointment.status != :status', { status: 'cancelled' });
  });

  // --- countByDateAndStatus ---
  test('countByDateAndStatus filters by date and status', async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(7),
    };
    fakeRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await repo.countByDateAndStatus(new Date('2026-05-01'), 'confirmed');
    expect(qb.where).toHaveBeenCalledWith('DATE(appointment.date) = :date', { date: '2026-05-01' });
    expect(qb.andWhere).toHaveBeenCalledWith('appointment.status = :status', { status: 'confirmed' });
    expect(result).toBe(7);
  });

  // --- countByDateRange ---
  test('countByDateRange uses Between clause', async () => {
    fakeRepo.count.mockResolvedValue(20);
    const start = new Date('2026-04-01');
    const end = new Date('2026-04-30');
    await repo.countByDateRange(start, end);
    expect(fakeRepo.count).toHaveBeenCalledWith({ where: { date: expect.any(Object) } });
  });

  // --- insert ---
  test('insert creates and saves appointment', async () => {
    const appt = { date: new Date(), status: 'pending' };
    fakeRepo.create.mockReturnValue(appt);
    fakeRepo.save.mockResolvedValue({ id: 10, ...appt });
    const result = await repo.insert(appt);
    expect(fakeRepo.create).toHaveBeenCalledWith(appt);
    expect(fakeRepo.save).toHaveBeenCalledWith(appt);
    expect(result.id).toBe(10);
  });

  // --- update ---
  test('update saves the appointment entity', async () => {
    const appt = { id: 5, status: 'confirmed' };
    fakeRepo.save.mockResolvedValue(appt);
    const result = await repo.update(appt);
    expect(fakeRepo.save).toHaveBeenCalledWith(appt);
    expect(result.status).toBe('confirmed');
  });

  // --- delete ---
  test('delete removes appointment when found', async () => {
    const entity = { id: 5 };
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

  // --- findPending ---
  test('findPending uses findAndCount with pending status', async () => {
    fakeRepo.findAndCount.mockResolvedValue([[{ id: 1 }], 1]);
    const result = await repo.findPending(0, 10);
    expect(fakeRepo.findAndCount).toHaveBeenCalledWith({
      where: { status: 'pending' },
      relations: ['child', 'vaccine', 'child.parent'],
      order: { date: 'ASC' },
      skip: 0,
      take: 10,
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(1);
  });
});
