import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import api from "../../services/api";
import "../../styles/auth.css";

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");
    const navigate = useNavigate();
    const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.newPassword !== form.confirmPassword) {
            return setError("Mật khẩu xác nhận không khớp.");
        }
        if (form.newPassword.length < 6) {
            return setError("Mật khẩu phải có ít nhất 6 ký tự.");
        }
        setLoading(true);
        setError("");
        try {
            await api.post("/auth/reset-password", {
                token,
                newPassword: form.newPassword,
            });
            navigate("/login?reset=true");
        } catch (err) {
            setError(err.response?.data?.message || "Có lỗi xảy ra. Liên kết có thể đã hết hạn.");
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="auth-container">
                <div className="auth-card">
                    <p className="auth-error">Liên kết đặt lại mật khẩu không hợp lệ.</p>
                    <Link to="/forgot-password" className="auth-btn">Yêu cầu liên kết mới</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-logo">
                    <span className="logo-text">VaxiCare</span>
                </div>
                <h2 className="auth-title">Đặt lại mật khẩu</h2>
                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label htmlFor="newPassword">Mật khẩu mới</label>
                        <input
                            id="newPassword"
                            name="newPassword"
                            type="password"
                            value={form.newPassword}
                            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                            placeholder="Ít nhất 6 ký tự"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="confirmPassword">Xác nhận mật khẩu mới</label>
                        <input
                            id="confirmPassword"
                            name="confirmPassword"
                            type="password"
                            value={form.confirmPassword}
                            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                            placeholder="Nhập lại mật khẩu"
                            required
                        />
                    </div>
                    {error && <p className="auth-error">{error}</p>}
                    <button type="submit" className="auth-btn" disabled={loading}>
                        {loading ? "Đang cập nhật..." : "Đặt lại mật khẩu"}
                    </button>
                </form>
            </div>
        </div>
    );
}
