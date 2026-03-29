const path = require('path');
const ejs = require('ejs');

describe('View render smoke tests', () => {
  const viewsDir = path.join(__dirname, '../../../apps/views');

  const render = (template, data = {}) => {
    return new Promise((resolve, reject) => {
      ejs.renderFile(
        path.join(viewsDir, `${template}.ejs`),
        {
          currentPath: '/client/dashboard',
          user: { id: 1, username: 'tester', role: 'admin', email: 't@test.com' },
          csrfToken: 'test-csrf-token',
          ...data,
        },
        {},
        (err, str) => {
          if (err) return reject(err);
          resolve(str);
        }
      );
    });
  };

  test('renders client/dashboard', async () => {
    const html = await render('client/dashboard', {
      children: [
        {
          id: 1,
          name: 'Bé Minh',
          dob: '2023-01-10',
          gender: 'male',
          progress: 60,
          nextMilestone: 'Mũi 6 trong 1',
          parent: { id: 2, username: 'parent1' },
          appointments: [{ status: 'completed' }],
        },
      ],
      upcomingAppointments: [
        {
          id: 10,
          date: new Date().toISOString(),
          appointmentTime: '09:00',
          vaccine: { name: 'Hexaxim' },
          child: { name: 'Bé Minh' },
        },
      ],
    });

    expect(html).toContain('Bé Minh');
    expect(html).toContain('ĐẶT LỊCH NGAY');
  });

  test('renders client/book-appointment', async () => {
    const html = await render('client/book-appointment', {
      currentPath: '/appointments/book',
      children: [{ id: 1, name: 'Bé An', dob: '2023-03-05' }],
      vaccines: [{ id: 1, name: 'Hexaxim', price: 850000, recommendedAgeMonths: 2 }],
      recommendations: [{ id: 1 }],
      selectedChildId: 1,
    });

    expect(html).toContain('Đặt lịch tiêm chủng');
    expect(html).toContain('Hexaxim');
  });

  test('renders client/notifications', async () => {
    const html = await render('client/notifications', {
      currentPath: '/client/notifications',
      notifications: [
        {
          id: 1,
          title: 'Nhắc lịch tiêm',
          message: 'Bé có lịch tiêm ngày mai',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
      ],
      unreadCount: 1,
    });

    expect(html).toContain('Nhắc lịch tiêm');
    expect(html).toContain('ĐÁNH DẤU ĐÃ ĐỌC');
  });

  test('renders admin/dashboard', async () => {
    const html = await render('admin/dashboard', {
      currentPath: '/admin/dashboard',
      userCount: 10,
      childCount: 20,
      vaccineCount: 5,
      todayAppointments: 3,
      weeklyTrend: [{ date: 'T2', count: 2 }],
      stockAlerts: [{ name: 'Hexaxim', type: '6in1', stock: 4 }],
    });

    expect(html).toContain('Tổng quan quản trị');
    expect(html).toContain('Hexaxim');
  });

  test('renders admin/vaccines/index', async () => {
    const html = await render('admin/vaccines/index', {
      currentPath: '/admin/vaccines',
      vaccines: [
        {
          id: 1,
          name: 'Hexaxim',
          price: 850000,
          stock: 12,
          recommendedAgeMonths: 2,
          ageLabel: 'Từ 2 tháng',
          type: '6in1',
        },
      ],
      search: '',
      currentPage: 1,
      totalPages: 1,
    });

    expect(html).toContain('Kho Vắc xin');
    expect(html).toContain('Hexaxim');
  });

  test('renders admin/users/index', async () => {
    const html = await render('admin/users/index', {
      currentPath: '/admin/users',
      users: [
        {
          id: 1,
          username: 'admin1',
          email: 'admin@test.com',
          phone: '0912345678',
          role: 'admin',
          createdAt: new Date().toISOString(),
        },
      ],
      search: '',
      filterRole: '',
      currentPage: 1,
      totalPages: 1,
    });

    expect(html).toContain('Quản lý nhân sự');
    expect(html).toContain('admin1');
  });

  test('renders admin/children/detail', async () => {
    const html = await render('admin/children/detail', {
      currentPath: '/admin/children',
      child: {
        id: 1,
        name: 'Bé Na',
        dob: '2023-02-02',
        gender: 'female',
        parent: { fullName: 'Nguyen Van A', phone: '0909' },
      },
      appointments: [
        {
          date: new Date().toISOString(),
          appointmentTime: '08:30',
          vaccine: { name: 'BCG' },
          status: 'completed',
          notes: 'Ổn định',
        },
      ],
    });

    expect(html).toContain('Bé Na');
    expect(html).toContain('BCG');
  });
});
