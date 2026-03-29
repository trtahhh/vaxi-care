/**
 * Shared test utilities — mock factories and helpers
 */

// Build a mock AppDataSource for repository tests
function createMockDataSource(mockMethods = {}) {
  return {
    getRepository: jest.fn().mockReturnValue({
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getCount: jest.fn().mockResolvedValue(0),
      })),
      ...mockMethods,
    }),
  };
}

// Mock AppDataSource once globally for all repository tests
const mockDataSource = createMockDataSource();
jest.mock('../../apps/models/data-source', () => ({ AppDataSource: mockDataSource }));

// Factory for service-level mocks
function createMockRepository() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  };
}

module.exports = { createMockDataSource, createMockRepository };
