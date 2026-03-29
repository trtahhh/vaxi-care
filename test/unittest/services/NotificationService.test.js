// Mock nodemailer before importing NotificationService
const mockTransport = {
  sendMail: jest.fn().mockResolvedValue({ messageId: 'msg-123' }),
};

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => mockTransport),
}));

// Mock NotificationRepository used by NotificationService
const mockNotifRepo = {
  create: jest.fn((data) => data),
  insert: jest.fn().mockResolvedValue({ id: 42 }),
};

jest.mock('../../../apps/repositories/NotificationRepository', () => {
  return jest.fn().mockImplementation(() => mockNotifRepo);
});

const NotificationService = require('../../../apps/services/NotificationService');

describe('NotificationService', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationService();
  });

  // --- sendAppointmentReminder ---
  describe('sendAppointmentReminder', () => {
    test('skips email when parent is null', async () => {
      await service.sendAppointmentReminder(null, 'Minh', 'BCG', new Date());
      expect(mockTransport.sendMail).not.toHaveBeenCalled();
    });

    test('skips email when parent has no email', async () => {
      await service.sendAppointmentReminder({ username: 'john' }, 'Minh', 'BCG', new Date());
      expect(mockTransport.sendMail).not.toHaveBeenCalled();
    });

    test('sends email with correct subject and content', async () => {
      const parent = { email: 'parent@test.com', fullName: 'Nguyen Van A' };
      await service.sendAppointmentReminder(parent, 'Minh', 'BCG', '2026-05-01T10:00:00');

      expect(mockTransport.sendMail).toHaveBeenCalledTimes(1);
      const mailCall = mockTransport.sendMail.mock.calls[0][0];
      expect(mailCall.to).toBe('parent@test.com');
      expect(mailCall.subject).toContain('Nhắc nhở');
      expect(mailCall.html).toContain('Minh');
      expect(mailCall.html).toContain('BCG');
    });

    test('handles email send failure gracefully without throwing', async () => {
      mockTransport.sendMail.mockRejectedValueOnce(new Error('SMTP error'));

      const parent = { email: 'parent@test.com', username: 'john' };
      // Should not throw
      await expect(
        service.sendAppointmentReminder(parent, 'Minh', 'MMR', new Date())
      ).resolves.not.toThrow();
    });

    test('uses username when fullName is absent', async () => {
      const parent = { email: 'john@test.com', username: 'johndoe' };
      await service.sendAppointmentReminder(parent, 'Minh', 'BCG', new Date());

      const mailCall = mockTransport.sendMail.mock.calls[0][0];
      expect(mailCall.html).toContain('johndoe');
    });
  });

  // --- createInAppNotification ---
  describe('createInAppNotification', () => {
    test('creates and inserts notification with correct data', async () => {
      await service.createInAppNotification(10, 'Test Title', 'Test message body');

      expect(mockNotifRepo.create).toHaveBeenCalledWith({
        title: 'Test Title',
        message: 'Test message body',
        user: { id: 10 },
        isRead: false,
      });
      expect(mockNotifRepo.insert).toHaveBeenCalled();
    });

    test('returns inserted notification with id', async () => {
      mockNotifRepo.insert.mockResolvedValueOnce({ id: 99, title: 'Hi' });
      const result = await service.createInAppNotification(5, 'Hi', 'There');
      expect(result.id).toBe(99);
    });
  });
});
