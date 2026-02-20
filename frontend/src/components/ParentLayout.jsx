import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/parentLayout.css";

const navItems = [
    { path: "/parent/dashboard", label: "Tổng quan" },
    { path: "/parent/children", label: "Hồ sơ trẻ" },
    { path: "/parent/appointments", label: "Lịch tiêm" },
    { path: "/parent/progress", label: "Tiến độ tiêm" },
    { path: "/parent/notifications", label: "Thông báo" },
];

export default function ParentLayout({ children }) {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    return (
        <div className="layout">
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <span className="logo-text">VaxiCare</span>
                </div>
                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`nav-item ${location.pathname === item.path ? "nav-item--active" : ""}`}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>
                <div className="sidebar-footer">
                    <div className="user-info">
                        <span className="user-name">{user?.username}</span>
                        <span className="user-role">Phụ huynh</span>
                    </div>
                    <button className="logout-btn" onClick={handleLogout}>
                        Đăng xuất
                    </button>
                </div>
            </aside>
            <main className="main-content">
                {children}
            </main>
        </div>
    );
}
