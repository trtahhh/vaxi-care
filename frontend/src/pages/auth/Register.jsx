import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "../../styles/auth.css";

export default function Register() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
        fullName: "",
        phone: "",
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        setError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.password !== form.confirmPassword) {
            return setError("Mật khẩu xác nhận không khớp.");
        }
        if (form.password.length < 6) {
            return setError("Mật khẩu phải có ít nhất 6 ký tự.");
        }
        setLoading(true);
        try {
            await register({
                username: form.username,
                email: form.email,
                password: form.password,
                fullName: form.fullName,
                phone: form.phone,
            });
            navigate("/login?registered=true");
        } catch (err) {
            setError(err.response?.data?.message || "Đăng ký thất bại.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card auth-card--wide">
                <div className="auth-logo">
                    <span className="logo-text">VaxiCare</span>
                    <p className="logo-sub">Hệ thống quản lý tiêm chủng</p>
                </div>
                <h2 className="auth-title">Tạo tài khoản</h2>
                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="fullName">Họ và tên</label>
                            <input
                                id="fullName"
                                name="fullName"
                                type="text"
                                value={form.fullName}
                                onChange={handleChange}
                                placeholder="Nguyễn Văn A"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="phone">Số điện thoại</label>
                            <input
                                id="phone"
                                name="phone"
                                type="tel"
                                value={form.phone}
                                onChange={handleChange}
                                placeholder="0901234567"
                            />
                        </div>
                    </div>
                    <div className="form-group">
                        <label htmlFor="username">Tên đăng nhập <span className="required">*</span></label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            value={form.username}
                            onChange={handleChange}
                            placeholder="Nhập tên đăng nhập"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="email">Email <span className="required">*</span></label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            value={form.email}
                            onChange={handleChange}
                            placeholder="example@email.com"
                            required
                        />
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="password">Mật khẩu <span className="required">*</span></label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                value={form.password}
                                onChange={handleChange}
                                placeholder="Ít nhất 6 ký tự"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="confirmPassword">Xác nhận mật khẩu <span className="required">*</span></label>
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                value={form.confirmPassword}
                                onChange={handleChange}
                                placeholder="Nhập lại mật khẩu"
                                required
                            />
                        </div>
                    </div>
                    {error && <p className="auth-error">{error}</p>}
                    <button type="submit" className="auth-btn" disabled={loading}>
                        {loading ? "Đang tạo tài khoản..." : "Đăng ký"}
                    </button>
                </form>
                <p className="auth-switch">
                    Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
                </p>
            </div>
        </div>
    );
}
