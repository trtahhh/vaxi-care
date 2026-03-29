const mockUserRepo = {
  findByEmailOrUsername: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  findAll: jest.fn(),
  count: jest.fn(),
};
const mockVaccineRepo = {
  findById: jest.fn(),
  findAll: jest.fn(),
  count: jest.fn(),
  searchByName: jest.fn(),
  create: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findLowStock: jest.fn(),
};
const mockChildRepo = {
  findById: jest.fn(),
  findAll: jest.fn(),
  count: jest.fn(),
  searchByName: jest.fn(),
};
const mockAppointmentRepo = {
  findById: jest.fn(),
  findPending: jest.fn(),
  update: jest.fn(),
  findByChildId: jest.fn(),
  countUpcomingFromDate: jest.fn(),
  countByDateRange: jest.fn(),
};
const mockSlotRepo = {
  findByDateRange: jest.fn(),
  upsert: jest.fn(),
};
const mockNotificationService = {
  sendAppointmentReminder: jest.fn(),
  createInAppNotification: jest.fn(),
};

const mockAppDataSource = {
  getRepository: jest.fn((name) => ({
    count: jest.fn().mockResolvedValue(10),
  })),
};

jest.mock('../../../apps/models/data-source', () => ({ AppDataSource: mockAppDataSource }));
jest.mock('../../../apps/repositories/UserRepository', () => jest.fn().mockImplementation(() => mockUserRepo));
jest.mock('../../../apps/repositories/ChildRepository', () => jest.fn().mockImplementation(() => mockChildRepo));
jest.mock('../../../apps/repositories/VaccineRepository', () => jest.fn().mockImplementation(() => mockVaccineRepo));
jest.mock('../../../apps/repositories/AppointmentRepository', () => jest.fn().mockImplementation(() => mockAppointmentRepo));
jest.mock('../../../apps/repositories/DailySlotConfigRepository', () => jest.fn().mockImplementation(() => mockSlotRepo));
jest.mock('../../../apps/services/NotificationService', () => jest.fn().mockImplementation(() => mockNotificationService));

const AdminService = require('../../../apps/services/AdminService');

describe('AdminService', () => {
  let service;

  beforeEach(() => {
    service = new AdminService();
    jest.clearAllMocks();
  });

  // ===== getDashboardStats =====
  describe('getDashboardStats', () => {
    test('returns all counters', async () => {
      mockAppointmentRepo.countUpcomingFromDate.mockResolvedValue(5);
      mockAppointmentRepo.countByDateRange.mockResolvedValue(12);
      mockVaccineRepo.findLowStock.mockResolvedValue([]);

      const result = await service.getDashboardStats();

      expect(result.userCount).toBe(10);
      expect(result.childCount).toBe(10);
      expect(result.vaccineCount).toBe(10);
      expect(result.todayAppointments).toBe(5);
      expect(result.weeklyTrend).toBe(12);
    });

    test('returns stock alerts when vaccines low', async () => {
      mockAppointmentRepo.countUpcomingFromDate.mockResolvedValue(0);
      mockAppointmentRepo.countByDateRange.mockResolvedValue(0);
      mockVaccineRepo.findLowStock.mockResolvedValue([
        { name: 'BCG', stock: 3 },
        { name: 'MMR', stock: 1 },
      ]);

      const result = await service.getDashboardStats();
      expect(result.stockAlerts).toHaveLength(2);
      expect(result.stockAlerts[0].name).toBe('BCG');
    });
  });

  // ===== getPendingAppointments =====
  describe('getPendingAppointments', () => {
    test('returns paginated appointments', async () => {
      mockAppointmentRepo.findPending.mockResolvedValue([[{ id: 1 }], 15]);
      const result = await service.getPendingAppointments(2);
      expect(result.appointments).toHaveLength(1);
      expect(result.total).toBe(15);
      expect(result.pageNum).toBe(2);
      expect(result.totalPages).toBe(2);
    });

    test('defaults page to 1 for invalid page', async () => {
      mockAppointmentRepo.findPending.mockResolvedValue([[{ id: 1 }], 20]);
      const result = await service.getPendingAppointments(-5);
      expect(result.pageNum).toBe(1);
    });

    test('calculates correct skip for page 3', async () => {
      mockAppointmentRepo.findPending.mockResolvedValue([[], 0]);
      await service.getPendingAppointments(3);
      expect(mockAppointmentRepo.findPending).toHaveBeenCalledWith(20, 10);
    });
  });

  // ===== updateAppointmentStatus =====
  describe('updateAppointmentStatus', () => {
    const mockAppointment = {
      id: 5,
      status: 'pending',
      child: { id: 3, parent: { id: 2, email: 'p@test.com', username: 'parent' }, name: 'Minh' },
      vaccine: { id: 2, name: 'BCG' },
      date: new Date('2026-05-01'),
    };

    test('throws if appointment not found', async () => {
      mockAppointmentRepo.findById.mockResolvedValue(null);
      await expect(service.updateAppointmentStatus(999, 'confirmed')).rejects.toThrow('Lịch hẹn không tồn tại');
    });

    test('throws for invalid status', async () => {
      mockAppointmentRepo.findById.mockResolvedValue({ ...mockAppointment });
      await expect(service.updateAppointmentStatus(5, 'invalid')).rejects.toThrow('Trạng thái không hợp lệ');
    });

    test('updates appointment status and sends confirmed notification', async () => {
      mockAppointmentRepo.findById.mockResolvedValue({ ...mockAppointment });
      mockAppointmentRepo.update.mockResolvedValue({ ...mockAppointment, status: 'confirmed' });
      mockVaccineRepo.findById.mockResolvedValue({ id: 2, name: 'BCG' });
      mockNotificationService.sendAppointmentReminder.mockResolvedValue();
      mockNotificationService.createInAppNotification.mockResolvedValue();

      const result = await service.updateAppointmentStatus(5, 'confirmed');

      expect(mockAppointmentRepo.update).toHaveBeenCalled();
      expect(mockNotificationService.sendAppointmentReminder).toHaveBeenCalledWith(
        { id: 2, email: 'p@test.com', username: 'parent' },
        'Minh',
        'BCG',
        expect.any(Date)
      );
      expect(mockNotificationService.createInAppNotification).toHaveBeenCalledWith(
        2,
        expect.stringContaining('đã được xác nhận'),
        expect.any(String)
      );
    });

    test('sends cancelled notification', async () => {
      mockAppointmentRepo.findById.mockResolvedValue({ ...mockAppointment });
      mockAppointmentRepo.update.mockResolvedValue({ ...mockAppointment, status: 'cancelled' });
      mockNotificationService.createInAppNotification.mockResolvedValue();

      await service.updateAppointmentStatus(5, 'cancelled');

      expect(mockNotificationService.sendAppointmentReminder).not.toHaveBeenCalled();
      expect(mockNotificationService.createInAppNotification).toHaveBeenCalledWith(
        2,
        expect.stringContaining('bị hủy'),
        expect.any(String)
      );
    });

    test('sends completed notification', async () => {
      mockAppointmentRepo.findById.mockResolvedValue({ ...mockAppointment });
      mockAppointmentRepo.update.mockResolvedValue({ ...mockAppointment, status: 'completed' });
      mockNotificationService.createInAppNotification.mockResolvedValue();

      await service.updateAppointmentStatus(5, 'completed');

      expect(mockNotificationService.createInAppNotification).toHaveBeenCalledWith(
        2,
        expect.stringContaining('hoàn thành'),
        expect.any(String)
      );
    });

    test('loads child relation when not loaded', async () => {
      const apptWithoutChild = { id: 5, status: 'pending', child: { id: 3 } };
      mockAppointmentRepo.findById.mockResolvedValue(apptWithoutChild);
      mockChildRepo.findById.mockResolvedValue({ id: 3, parent: { id: 2, email: 'p@test.com', username: 'parent' }, name: 'Minh' });
      mockAppointmentRepo.update.mockResolvedValue({ ...apptWithoutChild, status: 'confirmed' });
      mockNotificationService.sendAppointmentReminder.mockResolvedValue();
      mockNotificationService.createInAppNotification.mockResolvedValue();

      await service.updateAppointmentStatus(5, 'confirmed');

      expect(mockChildRepo.findById).toHaveBeenCalledWith(3);
    });

    test('notification failure does not block status update', async () => {
      mockAppointmentRepo.findById.mockResolvedValue({ ...mockAppointment });
      mockAppointmentRepo.update.mockResolvedValue({ ...mockAppointment, status: 'confirmed' });
      mockNotificationService.sendAppointmentReminder.mockRejectedValue(new Error('Email error'));
      mockNotificationService.createInAppNotification.mockRejectedValue(new Error('DB error'));

      // Should NOT throw
      const result = await service.updateAppointmentStatus(5, 'confirmed');
      expect(result).toBeDefined();
    });
  });

  // ===== getVaccineList =====
  describe('getVaccineList', () => {
    test('returns paginated vaccines', async () => {
      mockVaccineRepo.findAll.mockResolvedValue([{ id: 1 }]);
      mockVaccineRepo.count.mockResolvedValue(25);
      const result = await service.getVaccineList(null, 1);
      expect(result.vaccines).toHaveLength(1);
      expect(result.totalPages).toBe(3);
    });

    test('uses search when provided', async () => {
      mockVaccineRepo.searchByName.mockResolvedValue([{ id: 2, name: 'BCG' }]);
      mockVaccineRepo.count.mockResolvedValue(1);
      const result = await service.getVaccineList('BCG', 1);
      expect(mockVaccineRepo.searchByName).toHaveBeenCalledWith('BCG', 0, 10);
      expect(result.vaccines[0].name).toBe('BCG');
    });

    test('defaults page to 1 for invalid page', async () => {
      mockVaccineRepo.findAll.mockResolvedValue([]);
      mockVaccineRepo.count.mockResolvedValue(0);
      const result = await service.getVaccineList(null, -1);
      expect(result.pageNum).toBe(1);
    });
  });

  // ===== getVaccineById =====
  describe('getVaccineById', () => {
    test('returns vaccine by id', async () => {
      mockVaccineRepo.findById.mockResolvedValue({ id: 3, name: 'MMR' });
      const result = await service.getVaccineById(3);
      expect(mockVaccineRepo.findById).toHaveBeenCalledWith(3);
      expect(result.name).toBe('MMR');
    });
  });

  // ===== createVaccine =====
  describe('createVaccine', () => {
    test('parses price and stock as numbers', async () => {
      mockVaccineRepo.create.mockImplementation((d) => d);
      mockVaccineRepo.insert.mockResolvedValue({ id: 1 });
      await service.createVaccine({ name: 'V1', price: '100000', stock: '10', recommendedAgeMonths: '6' });
      expect(mockVaccineRepo.create).toHaveBeenCalledWith({
        name: 'V1',
        description: undefined,
        price: 100000,
        stock: 10,
        recommendedAgeMonths: 6,
        ageLabel: undefined,
      });
    });

    test('handles null recommendedAgeMonths', async () => {
      mockVaccineRepo.create.mockImplementation((d) => d);
      mockVaccineRepo.insert.mockResolvedValue({ id: 1 });
      await service.createVaccine({ name: 'V1', price: '50000', stock: '0', recommendedAgeMonths: '' });
      expect(mockVaccineRepo.create).toHaveBeenCalled();
    });
  });

  // ===== updateVaccine =====
  describe('updateVaccine', () => {
    test('updates and returns vaccine', async () => {
      mockVaccineRepo.findById.mockResolvedValue({ id: 3, name: 'Old' });
      mockVaccineRepo.update.mockResolvedValue({ id: 3, name: 'Updated' });
      const result = await service.updateVaccine(3, { name: 'Updated', price: '200000', stock: '5' });
      expect(result.name).toBe('Updated');
    });

    test('returns null when vaccine not found', async () => {
      mockVaccineRepo.findById.mockResolvedValue(null);
      const result = await service.updateVaccine(999, { name: 'X' });
      expect(result).toBeNull();
    });
  });

  // ===== deleteVaccine =====
  describe('deleteVaccine', () => {
    test('calls repository delete', async () => {
      mockVaccineRepo.delete.mockResolvedValue({ id: 3 });
      const result = await service.deleteVaccine(3);
      expect(mockVaccineRepo.delete).toHaveBeenCalledWith(3);
      expect(result.id).toBe(3);
    });
  });

  // ===== getScheduleMonth =====
  describe('getScheduleMonth', () => {
    test('returns calendar days for month', async () => {
      mockSlotRepo.findByDateRange.mockResolvedValue([
        { date: new Date('2026-04-05'), maxSlots: 30 },
      ]);
      const result = await service.getScheduleMonth(4, 2026);
      expect(result.daysInMonth).toHaveLength(30);
      expect(result.currentMonth).toBe(4);
      expect(result.currentYear).toBe(2026);
    });

    test('defaults invalid month to current month', async () => {
      mockSlotRepo.findByDateRange.mockResolvedValue([]);
      const result = await service.getScheduleMonth(15, 2026);
      expect(result.currentMonth).toBe(new Date().getMonth() + 1);
    });

    test('defaults invalid year to current year', async () => {
      mockSlotRepo.findByDateRange.mockResolvedValue([]);
      const result = await service.getScheduleMonth(3, 1999);
      expect(result.currentYear).toBe(new Date().getFullYear());
    });

    test('marks past days correctly', async () => {
      mockSlotRepo.findByDateRange.mockResolvedValue([]);
      const result = await service.getScheduleMonth(1, 2020);
      // All days in Jan 2020 should be marked past
      expect(result.daysInMonth.every(d => d.isPast)).toBe(true);
    });

    test('uses config maxSlots when available', async () => {
      mockSlotRepo.findByDateRange.mockResolvedValue([
        { date: '2026-04-01', maxSlots: 40 },
      ]);
      const result = await service.getScheduleMonth(4, 2026);
      const configuredDay = result.daysInMonth.find(d => d.maxSlots === 40);
      expect(configuredDay).toBeDefined();
    });
  });

  // ===== updateScheduleConfig =====
  describe('updateScheduleConfig', () => {
    test('rejects invalid date format', async () => {
      await expect(service.updateScheduleConfig('01/05/2026', 30)).rejects.toThrow('Ngày không hợp lệ');
    });

    test('rejects slots > 1000', async () => {
      await expect(service.updateScheduleConfig('2026-05-01', 1001)).rejects.toThrow('Số lượng slot phải từ 0-1000');
    });

    test('rejects negative slots', async () => {
      await expect(service.updateScheduleConfig('2026-05-01', -5)).rejects.toThrow('Số lượng slot phải từ 0-1000');
    });

    test('calls slotRepo.upsert with valid params', async () => {
      mockSlotRepo.upsert.mockResolvedValue({ date: '2026-05-01', maxSlots: 30 });
      await service.updateScheduleConfig('2026-05-01', 30);
      expect(mockSlotRepo.upsert).toHaveBeenCalledWith('2026-05-01', 30);
    });
  });

  // ===== getUserList =====
  describe('getUserList', () => {
    test('returns paginated users', async () => {
      mockUserRepo.findAll.mockResolvedValue([{ id: 1 }]);
      mockUserRepo.count.mockResolvedValue(20);
      const result = await service.getUserList(null, null, 1);
      expect(result.users).toHaveLength(1);
      expect(result.totalPages).toBe(2);
    });

    test('filters by role', async () => {
      mockUserRepo.findAll.mockResolvedValue([]);
      mockUserRepo.count.mockResolvedValue(0);
      await service.getUserList('parent', null, 1);
      expect(mockUserRepo.findAll).toHaveBeenCalledWith(0, 10, 'parent', null);
    });

    test('filters by search name', async () => {
      mockUserRepo.findAll.mockResolvedValue([]);
      mockUserRepo.count.mockResolvedValue(0);
      await service.getUserList(null, 'john', 1);
      expect(mockUserRepo.findAll).toHaveBeenCalledWith(0, 10, null, 'john');
    });

    test('defaults page to 1 for invalid page', async () => {
      mockUserRepo.findAll.mockResolvedValue([]);
      mockUserRepo.count.mockResolvedValue(0);
      const result = await service.getUserList(null, null, -3);
      expect(result.pageNum).toBe(1);
    });
  });

  // ===== createUser =====
  describe('createUser', () => {
    test('throws if duplicate exists', async () => {
      mockUserRepo.findByEmailOrUsername.mockResolvedValue({ id: 1 });
      await expect(service.createUser({ username: 'u', email: 'u@e.com', password: '123456' }))
        .rejects.toThrow('Email hoặc tên đăng nhập đã tồn tại');
    });

    test('creates user with hashed password and default parent role', async () => {
      mockUserRepo.findByEmailOrUsername.mockResolvedValue(null);
      mockUserRepo.create.mockImplementation((d) => d);
      mockUserRepo.insert.mockResolvedValue({ id: 5, username: 'new', role: 'parent' });
      const result = await service.createUser({ username: 'new', email: 'new@test.com', password: 'pass123' });
      expect(mockUserRepo.insert).toHaveBeenCalled();
      expect(result.role).toBe('parent');
    });

    test('creates user with specified role', async () => {
      mockUserRepo.findByEmailOrUsername.mockResolvedValue(null);
      mockUserRepo.create.mockImplementation((d) => d);
      mockUserRepo.insert.mockResolvedValue({ id: 6 });
      await service.createUser({ username: 'staff1', email: 's@test.com', password: 'pass', role: 'staff' });
      expect(mockUserRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'staff' })
      );
    });
  });

  // ===== getChildList =====
  describe('getChildList', () => {
    test('returns paginated children', async () => {
      mockChildRepo.findAll.mockResolvedValue([{ id: 1 }]);
      mockChildRepo.count.mockResolvedValue(15);
      const result = await service.getChildList(null, 1);
      expect(result.children).toHaveLength(1);
      expect(result.totalPages).toBe(2);
    });

    test('uses search when provided', async () => {
      mockChildRepo.searchByName.mockResolvedValue([{ id: 2, name: 'Minh' }]);
      mockChildRepo.count.mockResolvedValue(1);
      const result = await service.getChildList('Minh', 1);
      expect(mockChildRepo.searchByName).toHaveBeenCalledWith('Minh', 0, 10);
      expect(result.search).toBe('Minh');
    });

    test('defaults page to 1 for invalid page', async () => {
      mockChildRepo.findAll.mockResolvedValue([]);
      mockChildRepo.count.mockResolvedValue(0);
      const result = await service.getChildList(null, 0);
      expect(result.pageNum).toBe(1);
    });
  });

  // ===== getChildDetail =====
  describe('getChildDetail', () => {
    test('returns child with appointments', async () => {
      const child = { id: 3, name: 'Minh', parent: { id: 1 } };
      const appointments = [{ id: 1, status: 'completed' }];
      mockChildRepo.findById.mockResolvedValue(child);
      mockAppointmentRepo.findByChildId.mockResolvedValue(appointments);
      const result = await service.getChildDetail(3);
      expect(result.child.name).toBe('Minh');
      expect(result.appointments).toHaveLength(1);
    });

    test('returns null when child not found', async () => {
      mockChildRepo.findById.mockResolvedValue(null);
      const result = await service.getChildDetail(999);
      expect(result).toBeNull();
    });
  });
});
