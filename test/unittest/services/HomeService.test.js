const mockChildRepo = {
  findById: jest.fn(),
  findByParentId: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  insert: jest.fn(),
};
const mockVaccineRepo = {
  findById: jest.fn(),
  findAll: jest.fn(),
  count: jest.fn(),
  searchByName: jest.fn(),
  create: jest.fn(),
  insert: jest.fn(),
  findLowStock: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};
const mockAppointmentRepo = {
  findById: jest.fn(),
  findByChildIds: jest.fn(),
  findByChildId: jest.fn(),
  countByDate: jest.fn(),
  countUpcomingFromDate: jest.fn(),
  countByDateRange: jest.fn(),
  create: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
};
const mockSlotRepo = {
  findByDate: jest.fn(),
  findByDateRange: jest.fn(),
};
const mockUserRepo = {
  findAll: jest.fn(),
};

jest.mock('../../../apps/repositories/ChildRepository', () => jest.fn().mockImplementation(() => mockChildRepo));
jest.mock('../../../apps/repositories/VaccineRepository', () => jest.fn().mockImplementation(() => mockVaccineRepo));
jest.mock('../../../apps/repositories/AppointmentRepository', () => jest.fn().mockImplementation(() => mockAppointmentRepo));
jest.mock('../../../apps/repositories/DailySlotConfigRepository', () => jest.fn().mockImplementation(() => mockSlotRepo));
jest.mock('../../../apps/repositories/UserRepository', () => jest.fn().mockImplementation(() => mockUserRepo));

const HomeService = require('../../../apps/services/HomeService');

const clearRepoMocks = () => {
  [mockChildRepo, mockVaccineRepo, mockAppointmentRepo, mockSlotRepo, mockUserRepo].forEach((repo) => {
    Object.values(repo).forEach((fn) => {
      if (fn && typeof fn.mockClear === 'function') fn.mockClear();
    });
  });
};

describe('HomeService', () => {
  let service;

  beforeEach(() => {
    clearRepoMocks();
    service = new HomeService();
  });

  // ===== getChildVaccinationProgress =====
  describe('getChildVaccinationProgress', () => {
    test('returns 0 when no vaccines exist', async () => {
      mockVaccineRepo.findAll.mockResolvedValue([]);
      const result = await service.getChildVaccinationProgress(1);
      expect(result).toBe(0);
    });

    test('returns 0 when no appointments exist', async () => {
      mockVaccineRepo.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      mockAppointmentRepo.findByChildId.mockResolvedValue([]);
      const result = await service.getChildVaccinationProgress(1);
      expect(result).toBe(0);
    });

    test('calculates correct percentage', async () => {
      mockVaccineRepo.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
      mockAppointmentRepo.findByChildId.mockResolvedValue([
        { status: 'completed', vaccine: { id: 1 } },
        { status: 'completed', vaccine: { id: 2 } },
      ]);
      const result = await service.getChildVaccinationProgress(1);
      expect(result).toBe(50);
    });

    test('caps at 100%', async () => {
      mockVaccineRepo.findAll.mockResolvedValue([{ id: 1 }]);
      mockAppointmentRepo.findByChildId.mockResolvedValue([
        { status: 'completed', vaccine: { id: 1 } },
        { status: 'completed', vaccine: { id: 1 } },
      ]);
      const result = await service.getChildVaccinationProgress(1);
      expect(result).toBe(100);
    });

    test('ignores cancelled appointments', async () => {
      mockVaccineRepo.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      mockAppointmentRepo.findByChildId.mockResolvedValue([
        { status: 'cancelled', vaccine: { id: 1 } },
        { status: 'pending', vaccine: { id: 2 } },
      ]);
      const result = await service.getChildVaccinationProgress(1);
      expect(result).toBe(0);
    });

    test('ignores appointments without vaccine relation', async () => {
      mockVaccineRepo.findAll.mockResolvedValue([{ id: 1 }]);
      mockAppointmentRepo.findByChildId.mockResolvedValue([
        { status: 'completed', vaccine: null },
      ]);
      const result = await service.getChildVaccinationProgress(1);
      expect(result).toBe(0);
    });
  });

  // ===== getDashboardData =====
  describe('getDashboardData', () => {
    test('returns enriched children with progress', async () => {
      const children = [{ id: 1, name: 'Minh', dob: '2020-01-01' }];
      mockChildRepo.findByParentId.mockResolvedValue(children);
      mockAppointmentRepo.findByChildId.mockResolvedValue([
        { status: 'completed', vaccine: { id: 1 }, date: new Date(), child: { id: 1 } },
      ]);
      mockAppointmentRepo.findByChildIds.mockResolvedValue([
        { id: 1, date: new Date('2026-06-01'), status: 'confirmed', child: { id: 1 }, vaccine: { id: 1 } },
      ]);
      // vaccineRepo.findAll is called multiple times per child
      mockVaccineRepo.findAll.mockReturnValue([{ id: 1 }, { id: 2 }]);

      const result = await service.getDashboardData(1);

      expect(result.children).toHaveLength(1);
      expect(result.children[0]).toHaveProperty('progress');
    });

    test('returns upcoming appointments in the future', async () => {
      mockChildRepo.findByParentId.mockResolvedValue([{ id: 1 }]);
      mockAppointmentRepo.findByChildIds.mockResolvedValue([
        { id: 1, date: new Date('2026-06-01'), status: 'confirmed', child: { id: 1 }, vaccine: { id: 1 } },
        { id: 2, date: new Date('2024-01-01'), status: 'confirmed', child: { id: 1 }, vaccine: { id: 1 } }, // past
        { id: 3, date: new Date('2026-06-01'), status: 'cancelled', child: { id: 1 }, vaccine: { id: 1 } }, // cancelled
      ]);
      mockVaccineRepo.findAll.mockReturnValue([]);

      const result = await service.getDashboardData(1);
      expect(result.upcomingAppointments).toHaveLength(1);
    });

    test('sets nextMilestone to vaccine name when recommendations exist', async () => {
      // Deterministic setup without isolateModules
      mockChildRepo.findByParentId.mockResolvedValue([{ id: 1, name: 'Minh', dob: '2020-01-01' }]);
      mockChildRepo.findById.mockResolvedValue({ id: 1, dob: new Date('2020-01-01') });
      mockVaccineRepo.findAll.mockResolvedValue([{ id: 1, name: 'BCG', recommendedAgeMonths: 0 }]);
      mockAppointmentRepo.findByChildId.mockResolvedValue([]);
      mockAppointmentRepo.findByChildIds.mockResolvedValue([]);

      const result = await service.getDashboardData(1);
      expect(result.children[0].nextMilestone).toBe('BCG');
    });
  });

  // ===== getParents =====
  describe('getParents', () => {
    test('calls userRepo.findAll with parent role', async () => {
      mockUserRepo.findAll.mockResolvedValue([{ id: 1, role: 'parent' }]);
      const result = await service.getParents();
      expect(mockUserRepo.findAll).toHaveBeenCalledWith(0, 1000, 'parent');
      expect(result).toHaveLength(1);
    });
  });

  // ===== addChild =====
  describe('addChild', () => {
    test('throws when name is missing', async () => {
      await expect(service.addChild({ dob: '2020-01-01', gender: 'male', parentId: 1 }))
        .rejects.toThrow(/Vui lòng nhập/);
    });

    test('throws when dob is missing', async () => {
      await expect(service.addChild({ name: 'Minh', gender: 'male', parentId: 1 }))
        .rejects.toThrow(/Vui lòng nhập/);
    });

    test('throws when gender is missing', async () => {
      await expect(service.addChild({ name: 'Minh', dob: '2020-01-01', parentId: 1 }))
        .rejects.toThrow(/Vui lòng nhập/);
    });

    test('throws when parentId is missing', async () => {
      await expect(service.addChild({ name: 'Minh', dob: '2020-01-01', gender: 'male' }))
        .rejects.toThrow(/Vui lòng nhập/);
    });

    test('creates and inserts child with parsed parentId', async () => {
      mockChildRepo.create.mockImplementation((d) => d);
      mockChildRepo.insert.mockResolvedValue({ id: 5 });

      await service.addChild({ name: 'Minh', dob: '2020-01-01', gender: 'male', parentId: '3' });

      expect(mockChildRepo.create).toHaveBeenCalledWith({
        name: 'Minh',
        dob: '2020-01-01',
        gender: 'male',
        parent: { id: 3 },
      });
    });
  });

  // ===== getChildrenForBooking =====
  describe('getChildrenForBooking', () => {
    test('admin/ staff can book for any child', async () => {
      mockChildRepo.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      await service.getChildrenForBooking(1, 'admin');
      expect(mockChildRepo.findAll).toHaveBeenCalledWith(0, 1000);
    });

    test('parent can only book for their own children', async () => {
      mockChildRepo.findByParentId.mockResolvedValue([{ id: 1 }]);
      await service.getChildrenForBooking(5, 'parent');
      expect(mockChildRepo.findByParentId).toHaveBeenCalledWith(5);
    });
  });

  // ===== getVaccinesForBooking =====
  describe('getVaccinesForBooking', () => {
    test('returns all vaccines', async () => {
      mockVaccineRepo.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const result = await service.getVaccinesForBooking();
      expect(mockVaccineRepo.findAll).toHaveBeenCalledWith(0, 100);
      expect(result).toHaveLength(2);
    });
  });

  // ===== getRecommendedVaccines =====
  describe('getRecommendedVaccines', () => {
    test('returns empty when child not found', async () => {
      mockChildRepo.findById.mockResolvedValue(null);
      const result = await service.getRecommendedVaccines(999);
      expect(result).toEqual([]);
    });

    test('filters by recommended age and not completed', async () => {
      const child = { id: 1, dob: new Date('2020-01-01') }; // ~6 years old
      mockChildRepo.findById.mockResolvedValue(child);
      mockVaccineRepo.findAll.mockResolvedValue([
        { id: 1, name: 'BCG', recommendedAgeMonths: 0 },
        { id: 2, name: 'MMR', recommendedAgeMonths: 12 },
        { id: 3, name: 'Future', recommendedAgeMonths: 120 },
      ]);
      mockAppointmentRepo.findByChildIds.mockResolvedValue([
        { status: 'completed', vaccine: { id: 2 } },
      ]);

      const result = await service.getRecommendedVaccines(1);

      expect(result.some(v => v.name === 'BCG')).toBe(true);
      expect(result.some(v => v.name === 'MMR')).toBe(false); // already done
      expect(result.some(v => v.name === 'Future')).toBe(false); // not due yet
    });

    test('filters out completed vaccines', async () => {
      mockChildRepo.findById.mockResolvedValue({ id: 1, dob: new Date('2020-01-01') });
      mockVaccineRepo.findAll.mockResolvedValue([{ id: 1, recommendedAgeMonths: 0 }]);
      mockAppointmentRepo.findByChildIds.mockResolvedValue([
        { status: 'completed', vaccine: { id: 1 } },
      ]);
      const result = await service.getRecommendedVaccines(1);
      expect(result).toHaveLength(0);
    });
  });

  // ===== getSlotInfo =====
  describe('getSlotInfo', () => {
    test('uses default 50 slots when no config', async () => {
      mockSlotRepo.findByDate.mockResolvedValue(null);
      mockAppointmentRepo.countByDate.mockResolvedValue(10);
      const result = await service.getSlotInfo(new Date('2026-05-01'));
      expect(result.maxSlots).toBe(50);
      expect(result.availableSlots).toBe(40);
    });

    test('uses configured maxSlots when available', async () => {
      mockSlotRepo.findByDate.mockResolvedValue({ maxSlots: 30 });
      mockAppointmentRepo.countByDate.mockResolvedValue(5);
      const result = await service.getSlotInfo(new Date('2026-05-01'));
      expect(result.maxSlots).toBe(30);
      expect(result.availableSlots).toBe(25);
    });
  });

  // ===== bookAppointment =====
  describe('bookAppointment', () => {
    test('throws when child not found', async () => {
      mockChildRepo.findById.mockResolvedValue(null);
      await expect(service.bookAppointment(1, { childId: 999 }, 'parent')).rejects.toThrow('Trẻ không tồn tại');
    });

    test('throws when parent tries to book for another parent child', async () => {
      mockChildRepo.findById.mockResolvedValue({ id: 1, parent: { id: 99 } });
      await expect(service.bookAppointment(1, { childId: 1 }, 'parent')).rejects.toThrow('Bạn không có quyền đặt lịch cho trẻ này');
    });

    test('admin can book for any child', async () => {
      mockChildRepo.findById.mockResolvedValue({ id: 1, parent: { id: 99 } });
      mockSlotRepo.findByDate.mockResolvedValue(null);
      mockAppointmentRepo.countByDate.mockResolvedValue(0);
      mockAppointmentRepo.findByChildIds.mockResolvedValue([]);
      mockVaccineRepo.findById.mockResolvedValue({ id: 1, stock: 10 });
      mockAppointmentRepo.create.mockImplementation((d) => d);
      mockAppointmentRepo.insert.mockResolvedValue({ id: 1 });

      await service.bookAppointment(1, { childId: '1', vaccineId: '1', date: '2026-06-01' }, 'admin');
      expect(mockAppointmentRepo.insert).toHaveBeenCalled();
    });

    test('throws when date is in past', async () => {
      mockChildRepo.findById.mockResolvedValue({ id: 1, parent: { id: 1 } });
      await expect(service.bookAppointment(1, { childId: '1', date: '2020-01-01' }, 'parent')).rejects.toThrow('Ngày hẹn phải là ngày trong tương lai');
    });

    test('throws when slots are full', async () => {
      mockChildRepo.findById.mockResolvedValue({ id: 1, parent: { id: 1 } });
      mockSlotRepo.findByDate.mockResolvedValue({ maxSlots: 1 });
      mockAppointmentRepo.countByDate.mockResolvedValue(1);
      await expect(service.bookAppointment(1, { childId: '1', date: '2026-06-01' }, 'parent')).rejects.toThrow('Ngày này đã đầy lịch hẹn');
    });

    test('throws on duplicate booking (same child, vaccine, date)', async () => {
      mockChildRepo.findById.mockResolvedValue({ id: 1, parent: { id: 1 } });
      mockSlotRepo.findByDate.mockResolvedValue(null);
      mockAppointmentRepo.countByDate.mockResolvedValue(0);
      mockAppointmentRepo.findByChildIds.mockResolvedValue([
        { id: 5, vaccine: { id: 2 }, date: new Date('2026-05-01'), status: 'confirmed' },
      ]);
      await expect(service.bookAppointment(1, { childId: '1', vaccineId: '2', date: '2026-05-01' }, 'parent')).rejects.toThrow('Trẻ đã có lịch tiêm vắc xin này vào ngày đã chọn');
    });

    test('allows duplicate if existing booking is cancelled', async () => {
      mockChildRepo.findById.mockResolvedValue({ id: 1, parent: { id: 1 } });
      mockSlotRepo.findByDate.mockResolvedValue(null);
      mockAppointmentRepo.countByDate.mockResolvedValue(0);
      mockAppointmentRepo.findByChildIds.mockResolvedValue([
        { id: 5, vaccine: { id: 2 }, date: new Date('2026-05-01'), status: 'cancelled' },
      ]);
      mockVaccineRepo.findById.mockResolvedValue({ id: 2, stock: 10 });
      mockAppointmentRepo.create.mockImplementation((d) => d);
      mockAppointmentRepo.insert.mockResolvedValue({ id: 6 });

      // Should NOT throw
      await service.bookAppointment(1, { childId: '1', vaccineId: '2', date: '2026-05-01' }, 'parent');
      expect(mockAppointmentRepo.insert).toHaveBeenCalled();
    });

    test('throws when vaccine not found', async () => {
      mockChildRepo.findById.mockResolvedValue({ id: 1, parent: { id: 1 } });
      mockSlotRepo.findByDate.mockResolvedValue(null);
      mockAppointmentRepo.countByDate.mockResolvedValue(0);
      mockAppointmentRepo.findByChildIds.mockResolvedValue([]);
      mockVaccineRepo.findById.mockResolvedValue(null);
      await expect(service.bookAppointment(1, { childId: '1', vaccineId: '999', date: '2026-06-01' }, 'parent')).rejects.toThrow('Vắc xin không tồn tại');
    });

    test('throws when vaccine out of stock', async () => {
      mockChildRepo.findById.mockResolvedValue({ id: 1, parent: { id: 1 } });
      mockSlotRepo.findByDate.mockResolvedValue(null);
      mockAppointmentRepo.countByDate.mockResolvedValue(0);
      mockAppointmentRepo.findByChildIds.mockResolvedValue([]);
      mockVaccineRepo.findById.mockResolvedValue({ id: 1, stock: 0 });
      await expect(service.bookAppointment(1, { childId: '1', vaccineId: '1', date: '2026-06-01' }, 'parent')).rejects.toThrow('Vắc xin này hiện đã hết hàng');
    });

    test('creates appointment with pending status for parent', async () => {
      mockChildRepo.findById.mockResolvedValue({ id: 1, parent: { id: 1 } });
      mockSlotRepo.findByDate.mockResolvedValue(null);
      mockAppointmentRepo.countByDate.mockResolvedValue(0);
      mockAppointmentRepo.findByChildIds.mockResolvedValue([]);
      mockVaccineRepo.findById.mockResolvedValue({ id: 1, stock: 10 });
      mockAppointmentRepo.create.mockImplementation((d) => d);
      mockAppointmentRepo.insert.mockResolvedValue({ id: 1 });

      await service.bookAppointment(1, { childId: '1', vaccineId: '1', date: '2026-06-01', notes: 'Test note' }, 'parent');

      expect(mockAppointmentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          child: { id: 1 },
          vaccine: { id: 1 },
          notes: 'Test note',
        })
      );
    });
  });

  // ===== getUpcomingAppointments =====
  describe('getUpcomingAppointments', () => {
    test('returns empty when user has no children', async () => {
      mockChildRepo.findByParentId.mockResolvedValue([]);
      const result = await service.getUpcomingAppointments(1);
      expect(result).toEqual([]);
    });

    test('filters out past, cancelled, completed appointments', async () => {
      mockChildRepo.findByParentId.mockResolvedValue([{ id: 1 }]);
      mockAppointmentRepo.findByChildIds.mockResolvedValue([
        { id: 1, date: new Date('2026-06-01'), status: 'confirmed' },
        { id: 2, date: new Date('2020-01-01'), status: 'confirmed' },
        { id: 3, date: new Date('2026-06-01'), status: 'cancelled' },
        { id: 4, date: new Date('2026-06-01'), status: 'completed' },
      ]);
      const result = await service.getUpcomingAppointments(1);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });
  });

  // ===== getVaccineDetail =====
  describe('getVaccineDetail', () => {
    test('returns vaccine when found', async () => {
      mockVaccineRepo.findById.mockResolvedValue({ id: 3, name: 'MMR' });
      const result = await service.getVaccineDetail(3);
      expect(result.name).toBe('MMR');
    });

    test('throws when vaccine not found', async () => {
      mockVaccineRepo.findById.mockResolvedValue(null);
      await expect(service.getVaccineDetail(999)).rejects.toThrow('Vắc xin không tồn tại');
    });
  });

  // ===== cancelAppointment =====
  describe('cancelAppointment', () => {
    test('throws when appointment not found', async () => {
      mockAppointmentRepo.findById.mockResolvedValue(null);
      await expect(service.cancelAppointment(999, 1, 'parent')).rejects.toThrow('Lịch hẹn không tồn tại');
    });

    test('throws when parent tries to cancel another parent appointment', async () => {
      mockAppointmentRepo.findById.mockResolvedValue({ id: 5, child: { id: 1 }, status: 'confirmed' });
      mockChildRepo.findById.mockResolvedValue({ id: 1, parent: { id: 99 } }); // different parent
      await expect(service.cancelAppointment(5, 1, 'parent')).rejects.toThrow('Bạn không có quyền hủy lịch hẹn này');
    });

    test('admin can cancel any appointment', async () => {
      mockAppointmentRepo.findById.mockResolvedValue({ id: 5, child: { id: 1 }, status: 'confirmed' });
      mockAppointmentRepo.update.mockResolvedValue({ id: 5, status: 'cancelled' });

      await service.cancelAppointment(5, 1, 'admin');
      expect(mockAppointmentRepo.update).toHaveBeenCalled();
    });

    test('throws when appointment is already cancelled', async () => {
      mockAppointmentRepo.findById.mockResolvedValue({ id: 5, child: { id: 1 }, status: 'cancelled' });
      mockChildRepo.findById.mockResolvedValue({ id: 1, parent: { id: 1 } });
      await expect(service.cancelAppointment(5, 1, 'parent')).rejects.toThrow('Không thể hủy lịch hẹn ở trạng thái này');
    });

    test('throws when appointment is already completed', async () => {
      mockAppointmentRepo.findById.mockResolvedValue({ id: 5, child: { id: 1 }, status: 'completed' });
      mockChildRepo.findById.mockResolvedValue({ id: 1, parent: { id: 1 } });
      await expect(service.cancelAppointment(5, 1, 'parent')).rejects.toThrow('Không thể hủy lịch hẹn ở trạng thái này');
    });

    test('successfully cancels pending appointment', async () => {
      mockAppointmentRepo.findById.mockResolvedValue({ id: 5, child: { id: 1 }, status: 'pending' });
      mockChildRepo.findById.mockResolvedValue({ id: 1, parent: { id: 1 } });
      mockAppointmentRepo.update.mockResolvedValue({ id: 5, status: 'cancelled' });

      const result = await service.cancelAppointment(5, 1, 'parent');
      expect(mockAppointmentRepo.update).toHaveBeenCalledWith({ id: 5, child: { id: 1 }, status: 'cancelled' });
    });
  });

  // ===== Extra coverage branches =====
  describe('Coverage branches', () => {
    test('getChildVaccinationProgress returns 0 when appointments is empty array', async () => {
      mockVaccineRepo.findAll.mockResolvedValue([{ id: 1 }]);
      mockAppointmentRepo.findByChildId.mockResolvedValue([]);
      const result = await service.getChildVaccinationProgress(1);
      expect(result).toBe(0);
    });

    test('getDashboardData skips appointments when childIds is empty', async () => {
      mockChildRepo.findByParentId.mockResolvedValue([]);
      const result = await service.getDashboardData(1);
      expect(result.upcomingAppointments).toEqual([]);
    });

    test('getDashboardData sets nextMilestone to completion when no vaccines', async () => {
      const children = [{ id: 1, name: 'Minh', dob: '2020-01-01' }];
      mockChildRepo.findByParentId.mockResolvedValue(children);
      mockVaccineRepo.findAll.mockResolvedValue([]);
      mockAppointmentRepo.findByChildId.mockResolvedValue([]);
      mockAppointmentRepo.findByChildIds.mockResolvedValue([]);

      const result = await service.getDashboardData(1);
      expect(result.children[0].nextMilestone).toBe('Tất cả các mũi tiêm đã hoàn thành!');
    });

    test('getRecommendedVaccines excludes vaccine with null recommendedAgeMonths', async () => {
      mockChildRepo.findById.mockResolvedValue({ id: 1, dob: new Date('2020-01-01') });
      mockVaccineRepo.findAll.mockResolvedValue([
        { id: 1, name: 'BCG', recommendedAgeMonths: 0 },
        { id: 2, name: 'Unknown', recommendedAgeMonths: null },
      ]);
      mockAppointmentRepo.findByChildIds.mockResolvedValue([]);
      const result = await service.getRecommendedVaccines(1);
      expect(result.some(v => v.name === 'BCG')).toBe(true);
      expect(result.some(v => v.name === 'Unknown')).toBe(false);
    });

    test('getRecommendedVaccines returns all when child age matches all vaccines', async () => {
      mockChildRepo.findById.mockResolvedValue({ id: 1, dob: new Date('2020-01-01') });
      mockVaccineRepo.findAll.mockResolvedValue([
        { id: 1, name: 'BCG', recommendedAgeMonths: 0 },
        { id: 2, name: 'MMR', recommendedAgeMonths: 12 },
      ]);
      mockAppointmentRepo.findByChildIds.mockResolvedValue([]);
      const result = await service.getRecommendedVaccines(1);
      expect(result).toHaveLength(2);
    });

    test('bookAppointment works without vaccineId', async () => {
      mockChildRepo.findById.mockResolvedValue({ id: 1, parent: { id: 1 } });
      mockSlotRepo.findByDate.mockResolvedValue(null);
      mockAppointmentRepo.countByDate.mockResolvedValue(0);
      mockAppointmentRepo.findByChildIds.mockResolvedValue([]);
      mockAppointmentRepo.create.mockImplementation((d) => d);
      mockAppointmentRepo.insert.mockResolvedValue({ id: 1 });

      await service.bookAppointment(1, { childId: '1', date: '2026-06-01' }, 'parent');

      expect(mockAppointmentRepo.insert).toHaveBeenCalled();
    });

    test('bookAppointment with staff role creates confirmed appointment', async () => {
      mockChildRepo.findById.mockResolvedValue({ id: 1, parent: { id: 99 } });
      mockSlotRepo.findByDate.mockResolvedValue(null);
      mockAppointmentRepo.countByDate.mockResolvedValue(0);
      mockAppointmentRepo.findByChildIds.mockResolvedValue([]);
      mockVaccineRepo.findById.mockResolvedValue({ id: 1, stock: 10 });
      mockAppointmentRepo.create.mockImplementation((d) => d);
      mockAppointmentRepo.insert.mockResolvedValue({ id: 1 });

      await service.bookAppointment(1, { childId: '1', vaccineId: '1', date: '2026-06-01' }, 'staff');

      expect(mockAppointmentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'confirmed' })
      );
    });

    test('cancelAppointment throws when child not found (parent path)', async () => {
      mockAppointmentRepo.findById.mockResolvedValue({ id: 5, child: { id: 1 }, status: 'confirmed' });
      mockChildRepo.findById.mockResolvedValue(null);
      await expect(service.cancelAppointment(5, 1, 'parent')).rejects.toThrow('Bạn không có quyền hủy lịch hẹn này');
    });

    test('cancelAppointment staff skips ownership check (does not call childRepo in this execution)', async () => {
      clearRepoMocks();
      mockAppointmentRepo.findById.mockResolvedValue({ id: 5, child: { id: 1 }, status: 'confirmed' });
      mockAppointmentRepo.update.mockResolvedValue({ id: 5, status: 'cancelled' });

      await service.cancelAppointment(5, 1, 'staff');
      expect(mockChildRepo.findById).not.toHaveBeenCalled();
      expect(mockAppointmentRepo.update).toHaveBeenCalled();
    });

    test('getUpcomingAppointments returns all child appointments sorted', async () => {
      mockChildRepo.findByParentId.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      mockAppointmentRepo.findByChildIds.mockResolvedValue([
        { id: 2, date: new Date('2026-07-01'), status: 'confirmed', child: { id: 1 }, vaccine: { id: 1 } },
        { id: 1, date: new Date('2026-06-15'), status: 'pending', child: { id: 2 }, vaccine: { id: 2 } },
      ]);
      const result = await service.getUpcomingAppointments(1);
      expect(result).toHaveLength(2);
    });

    test('getVaccineDetail throws with non-numeric id', async () => {
      mockVaccineRepo.findById.mockResolvedValue(null);
      await expect(service.getVaccineDetail('abc')).rejects.toThrow('Vắc xin không tồn tại');
    });

    test('addChild parses parentId from string', async () => {
      mockChildRepo.create.mockImplementation((d) => d);
      mockChildRepo.insert.mockResolvedValue({ id: 10 });
      await service.addChild({ name: 'Test', dob: '2020-01-01', gender: 'female', parentId: '5' });
      expect(mockChildRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ parent: { id: 5 } })
      );
    });
  });
});
