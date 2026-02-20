const { AppDataSource } = require("../data-source");

const notificationRepo = () => AppDataSource.getRepository("Notification");

// GET /api/notifications - Lấy danh sách thông báo in-app của user
exports.getMyNotifications = async (req, res) => {
    try {
        const notifications = await notificationRepo().find({
            where: { user: { id: req.user.id } },
            order: { createdAt: "DESC" },
        });
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ message: "Lỗi server.", error: error.message });
    }
};

// PATCH /api/notifications/:id/read - Đánh dấu thông báo đã đọc
exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const repo = notificationRepo();

        const notification = await repo.findOne({
            where: { id: parseInt(id), user: { id: req.user.id } },
        });
        if (!notification) {
            return res.status(404).json({ message: "Không tìm thấy thông báo." });
        }

        notification.isRead = true;
        await repo.save(notification);
        res.json({ message: "Đã đánh dấu đọc." });
    } catch (error) {
        res.status(500).json({ message: "Lỗi server.", error: error.message });
    }
};

// PATCH /api/notifications/read-all - Đánh dấu tất cả đã đọc
exports.markAllAsRead = async (req, res) => {
    try {
        await notificationRepo()
            .createQueryBuilder()
            .update()
            .set({ isRead: true })
            .where("user_id = :userId", { userId: req.user.id })
            .execute();

        res.json({ message: "Đã đánh dấu tất cả là đã đọc." });
    } catch (error) {
        res.status(500).json({ message: "Lỗi server.", error: error.message });
    }
};
