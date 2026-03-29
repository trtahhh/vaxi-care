const ChildRepository = require('../../../apps/repositories/ChildRepository');

describe('ChildRepository', () => {
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
    repo = new ChildRepository({
      getRepository: jest.fn(() => fakeRepo),
    });
  });

  afterEach(() => jest.clearAllMocks());

  // --- create ---
  test('create delegates to repo.create with data', () => {
    const data = { name: 'Minh', dob: '2020-01-01', gender: 'male' };
    const result = repo.create(data);
    expect(fakeRepo.create).toHaveBeenCalledWith(data);
    expect(result.name).toBe('Minh');
  });

  // --- findById ---
  test('findById includes parent relation', async () => {
    fakeRepo.findOne.mockResolvedValue({ id: 5, name: 'Minh', parent: { id: 1 } });
    const result = await repo.findById(5);
    expect(fakeRepo.findOne).toHaveBeenCalledWith({
      where: { id: 5 },
      relations: ['parent'],
    });
    expect(result.parent.id).toBe(1);
  });

  test('findById returns null when not found', async () => {
    fakeRepo.findOne.mockResolvedValue(null);
    const result = await repo.findById(999);
    expect(result).toBeNull();
  });

  // --- findByParentId ---
  test('findByParentId returns children sorted by name ASC', async () => {
    const children = [{ id: 1, name: 'An' }, { id: 2, name: 'Bình' }];
    fakeRepo.find.mockResolvedValue(children);
    const result = await repo.findByParentId(10);
    expect(fakeRepo.find).toHaveBeenCalledWith({
      where: { parent: { id: 10 } },
      order: { name: 'ASC' },
    });
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('An');
  });

  // --- findByParentIdList ---
  test('findByParentIdList returns empty array for empty input', async () => {
    const result = await repo.findByParentIdList([]);
    expect(result).toEqual([]);
    expect(fakeRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  test('findByParentIdList uses queryBuilder with IN clause', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
    };
    fakeRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await repo.findByParentIdList([1, 2]);
    expect(fakeRepo.createQueryBuilder).toHaveBeenCalledWith('child');
    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('child.parent', 'parent');
    expect(qb.where).toHaveBeenCalledWith('child.id IN (:...childIds)', { childIds: [1, 2] });
    expect(qb.getMany).toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  // --- searchByName ---
  test('searchByName uses Like and respects pagination', async () => {
    fakeRepo.find.mockResolvedValue([{ id: 1, name: 'Minh An' }]);
    const result = await repo.searchByName('Minh', 0, 20);
    expect(fakeRepo.find).toHaveBeenCalledWith({
      where: { name: expect.any(Object) }, // Like wrapper
      skip: 0,
      take: 20,
      order: { id: 'DESC' },
      relations: ['parent'],
    });
    expect(result).toHaveLength(1);
  });

  // --- findAll ---
  test('findAll returns paginated children with parent relation', async () => {
    fakeRepo.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const result = await repo.findAll(10, 5);
    expect(fakeRepo.find).toHaveBeenCalledWith({
      skip: 10,
      take: 5,
      order: { id: 'DESC' },
      relations: ['parent'],
    });
    expect(result).toHaveLength(2);
  });

  // --- count ---
  test('count returns total without search', async () => {
    fakeRepo.count.mockResolvedValue(15);
    const result = await repo.count();
    expect(fakeRepo.count).toHaveBeenCalledWith();
    expect(result).toBe(15);
  });

  test('count uses Like filter when searchName provided', async () => {
    fakeRepo.count.mockResolvedValue(3);
    await repo.count('Minh');
    expect(fakeRepo.count).toHaveBeenCalledWith({
      where: { name: expect.any(Object) },
    });
  });

  // --- insert ---
  test('insert creates and saves a child entity', async () => {
    const child = { name: 'NewChild', dob: '2021-05-01', gender: 'female' };
    fakeRepo.create.mockReturnValue(child);
    fakeRepo.save.mockResolvedValue({ id: 10, ...child });
    const result = await repo.insert(child);
    expect(fakeRepo.create).toHaveBeenCalledWith(child);
    expect(fakeRepo.save).toHaveBeenCalledWith(child);
    expect(result.id).toBe(10);
  });

  // --- update ---
  test('update saves the child entity', async () => {
    const child = { id: 5, name: 'UpdatedName' };
    fakeRepo.save.mockResolvedValue(child);
    const result = await repo.update(child);
    expect(fakeRepo.save).toHaveBeenCalledWith(child);
    expect(result.name).toBe('UpdatedName');
  });

  // --- delete ---
  test('delete removes child when found', async () => {
    const entity = { id: 5, name: 'ToDelete' };
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
