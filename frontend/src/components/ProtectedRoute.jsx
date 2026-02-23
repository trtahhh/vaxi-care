import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Route bảo vệ - chỉ cho phép user đã đăng nhập và đúng role
export default function ProtectedRoute({ children, allowedRoles }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="app-loading">
                <p>Đang tải...</p>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/login" replace />;
    }

    return children;
}
