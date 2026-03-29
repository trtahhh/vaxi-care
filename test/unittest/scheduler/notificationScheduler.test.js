// Mock cron before requiring the scheduler
const mockScheduleFn = jest.fn();
jest.mock('node-cron', () => ({
  schedule: jest.fn((pattern, fn) => {
    mockScheduleFn(pattern, fn);
    return { stop: jest.fn() };
  }),
}));

// Mock NotificationService used by scheduler
const mockNotifService = {
  sendAppointmentReminder: jest.fn(),
  createInAppNotification: jest.fn(),
};

jest.mock('../../../apps/services/NotificationService', () => {
  return jest.fn().mockImplementation(() => mockNotifService);
});

// Mock AppDataSource used by scheduler
const mockAppDataSource = {
  getRepository: jest.fn(),
};

jest.mock('../../../apps/models/data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

const { startNotificationScheduler } = require('../../../apps/scheduler/notificationScheduler');

// Helper: build a queryBuilder mock with given getMany result
function makeQb(getManyResult) {
  const qb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(getManyResult),
  };
  mockAppDataSource.getRepository.mockReturnValue({ createQueryBuilder: jest.fn(() => qb) });
  return qb;
}

describe('notificationScheduler', () => {
  let scheduledFn;

  beforeEach(() => {
    jest.clearAllMocks();
    // Register scheduler and capture the scheduled cron callback
    mockScheduleFn.mockClear();
    startNotificationScheduler();
    expect(mockScheduleFn).toHaveBeenCalledTimes(1);
    expect(mockScheduleFn.mock.calls[0][0]).toBe('0 9 * * *');
    scheduledFn = mockScheduleFn.mock.calls[0][1];
  });

  // ----- DB error path -----
  test('handles outer try/catch for database error gracefully', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockRejectedValue(new Error('DB connection failed')),
    };
    mockAppDataSource.getRepository.mockReturnValue({ createQueryBuilder: jest.fn(() => qb) });

    await expect(scheduledFn()).resolves.not.toThrow();
  });

  // ----- Guard branches -----
  test('skips appointment when child is null', async () => {
    makeQb([{ id: 1, child: null }]);
    await scheduledFn();
    expect(mockNotifService.sendAppointmentReminder).not.toHaveBeenCalled();
    expect(mockNotifService.createInAppNotification).not.toHaveBeenCalled();
  });

  test('skips appointment when parent is null', async () => {
    makeQb([{ id: 1, child: { id: 3, parent: null } }]);
    await scheduledFn();
    expect(mockNotifService.sendAppointmentReminder).not.toHaveBeenCalled();
  });

  test('skips appointment when parent email is missing', async () => {
    makeQb([{
      id: 1,
      child: { id: 3, name: 'Minh', parent: { id: 2, username: 'john' } },
      vaccine: { name: 'BCG' },
      date: new Date(),
    }]);
    await scheduledFn();
    expect(mockNotifService.sendAppointmentReminder).not.toHaveBeenCalled();
    expect(mockNotifService.createInAppNotification).not.toHaveBeenCalled();
  });

  // ----- Happy path -----
  test('sends email and in-app notification for valid appointment', async () => {
    makeQb([{
      id: 5,
      child: { id: 3, name: 'Minh', parent: { id: 2, email: 'parent@test.com', username: 'parent' } },
      vaccine: { name: 'BCG' },
      date: new Date('2026-05-01'),
    }]);
    mockNotifService.sendAppointmentReminder.mockResolvedValue();
    mockNotifService.createInAppNotification.mockResolvedValue();

    await scheduledFn();

    expect(mockNotifService.sendAppointmentReminder).toHaveBeenCalledWith(
      { id: 2, email: 'parent@test.com', username: 'parent' },
      'Minh',
      'BCG',
      expect.any(Date)
    );
    expect(mockNotifService.createInAppNotification).toHaveBeenCalledWith(
      2,
      'Nhắc nhở lịch tiêm chủng',
      expect.stringContaining('Minh')
    );
  });

  test('uses "vắc xin" when vaccine is null', async () => {
    makeQb([{
      id: 5,
      child: { id: 3, name: 'Minh', parent: { id: 2, email: 'p@test.com', username: 'p' } },
      vaccine: null,
      date: new Date('2026-05-01'),
    }]);
    mockNotifService.sendAppointmentReminder.mockResolvedValue();
    mockNotifService.createInAppNotification.mockResolvedValue();

    await scheduledFn();

    expect(mockNotifService.sendAppointmentReminder).toHaveBeenCalledWith(
      expect.any(Object), 'Minh', 'vắc xin', expect.any(Date)
    );
  });

  test('handles email send failure but still creates in-app notification', async () => {
    makeQb([{
      id: 5,
      child: { id: 3, name: 'Minh', parent: { id: 2, email: 'parent@test.com', username: 'parent' } },
      vaccine: { name: 'BCG' },
      date: new Date('2026-05-01'),
    }]);
    mockNotifService.sendAppointmentReminder.mockRejectedValue(new Error('SMTP error'));
    mockNotifService.createInAppNotification.mockResolvedValue();

    // Should NOT throw
    await expect(scheduledFn()).resolves.not.toThrow();
    expect(mockNotifService.createInAppNotification).toHaveBeenCalled();
  });

  test('handles in-app notification failure gracefully', async () => {
    makeQb([{
      id: 5,
      child: { id: 3, name: 'Minh', parent: { id: 2, email: 'parent@test.com', username: 'parent' } },
      vaccine: { name: 'BCG' },
      date: new Date('2026-05-01'),
    }]);
    mockNotifService.sendAppointmentReminder.mockResolvedValue();
    mockNotifService.createInAppNotification.mockRejectedValue(new Error('DB error'));

    await expect(scheduledFn()).resolves.not.toThrow();
  });

  test('processes multiple appointments in loop', async () => {
    makeQb([
      {
        id: 1,
        child: { id: 3, name: 'Minh', parent: { id: 2, email: 'p@test.com', username: 'p' } },
        vaccine: { name: 'BCG' },
        date: new Date('2026-05-01'),
      },
      {
        id: 2,
        child: { id: 4, name: 'Lan', parent: { id: 3, email: 'q@test.com', username: 'q' } },
        vaccine: { name: 'MMR' },
        date: new Date('2026-05-01'),
      },
    ]);
    mockNotifService.sendAppointmentReminder.mockResolvedValue();
    mockNotifService.createInAppNotification.mockResolvedValue();

    await scheduledFn();

    expect(mockNotifService.sendAppointmentReminder).toHaveBeenCalledTimes(2);
    expect(mockNotifService.createInAppNotification).toHaveBeenCalledTimes(2);
  });

  test('skips one invalid appointment but processes valid ones', async () => {
    makeQb([
      {
        id: 1,
        child: null, // invalid
      },
      {
        id: 2,
        child: { id: 4, name: 'Lan', parent: { id: 3, email: 'q@test.com', username: 'q' } },
        vaccine: { name: 'MMR' },
        date: new Date('2026-05-01'),
      },
    ]);
    mockNotifService.sendAppointmentReminder.mockResolvedValue();
    mockNotifService.createInAppNotification.mockResolvedValue();

    await scheduledFn();

    expect(mockNotifService.sendAppointmentReminder).toHaveBeenCalledTimes(1);
    expect(mockNotifService.createInAppNotification).toHaveBeenCalledTimes(1);
  });
});
