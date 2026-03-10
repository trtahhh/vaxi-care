import { useState, useEffect } from "react";
import api from "../../services/api";
import ParentLayout from "../../components/ParentLayout";
import "../../styles/parent.css";

export default function Notifications() {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = async () => {
        try {
            const res = await api.get("/parent/notifications");
            setNotifications(res.data);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchNotifications(); }, []);

    const markAsRead = async (id) => {
        await api.patch(`/parent/notifications/${id}/read`);
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
    };

    const markAllAsRead = async () => {
        await api.patch("/parent/notifications/read-all");
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    };

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return (
        <ParentLayout>
            <div className="page-header">
                <h1 className="page-title">
                    Thông báo {unreadCount > 0 && <span className="badge badge--blue">{unreadCount} mới</span>}
                </h1>
                {unreadCount > 0 && (
                    <button className="btn btn--secondary" onClick={markAllAsRead}>
                        Đánh dấu tất cả đã đọc
                    </button>
                )}
            </div>

            {loading ? (
                <p className="loading-text">Đang tải...</p>
            ) : notifications.length === 0 ? (
                <div className="empty-state">
                    <p>Bạn chưa có thông báo nào.</p>
                </div>
            ) : (
                <div className="notification-list">
                    {notifications.map((notif) => (
                        <div
                            key={notif.id}
                            className={`notification-item ${!notif.isRead ? "notification-item--unread" : ""}`}
                            onClick={() => !notif.isRead && markAsRead(notif.id)}
                        >
                            <div className="notification-item__body">
                                <p className="notification-title">{notif.title}</p>
                                <p className="notification-message">{notif.message}</p>
                                <p className="notification-time">
                                    {new Date(notif.createdAt).toLocaleString("vi-VN")}
                                </p>
                            </div>
                            {!notif.isRead && <span className="unread-dot" />}
                        </div>
                    ))}
                </div>
            )}
        </ParentLayout>
    );
}
