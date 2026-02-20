import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import "../../styles/auth.css";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setMessage("");
        try {
            const response = await api.post("/auth/forgot-password", { email });
            setMessage(response.data.message);
        } catch (err) {
            setError(err.response?.data?.message || "Có lỗi xảy ra. Vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-logo">
                    <span className="logo-text">VaxiCare</span>
                </div>
                <h2 className="auth-title">Quên mật khẩu</h2>
                <p className="auth-desc">
                    Nhập email của bạn, chúng tôi sẽ gửi liên kết đặt lại mật khẩu.
                </p>
                {!message ? (
                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-group">
                            <label htmlFor="email">Email</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Nhập email của bạn"
                                required
                            />
                        </div>
                        {error && <p className="auth-error">{error}</p>}
                        <button type="submit" className="auth-btn" disabled={loading}>
                            {loading ? "Đang gửi..." : "Gửi liên kết đặt lại"}
                        </button>
                    </form>
                ) : (
                    <div className="auth-success">
                        <p>{message}</p>
                    </div>
                )}
                <p className="auth-switch">
                    <Link to="/login">Quay lại đăng nhập</Link>
                </p>
            </div>
        </div>
    );
}
