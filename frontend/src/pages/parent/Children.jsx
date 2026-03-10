import { useState, useEffect } from "react";
import api from "../../services/api";
import ParentLayout from "../../components/ParentLayout";
import "../../styles/parent.css";

export default function Children() {
    const [children, setChildren] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchChildren = async () => {
            try {
                const res = await api.get("/parent/children");
                setChildren(res.data);
            } catch {
                setError("Không thể tải danh sách hồ sơ trẻ.");
            } finally {
                setLoading(false);
            }
        };
        fetchChildren();
    }, []);

    const genderLabel = { male: "Nam", female: "Nữ", other: "Khác" };

    const getAgeText = (dob) => {
        const birth = new Date(dob);
        const now = new Date();
        const months =
            (now.getFullYear() - birth.getFullYear()) * 12 +
            (now.getMonth() - birth.getMonth());
        if (months < 12) return `${months} tháng tuổi`;
        const years = Math.floor(months / 12);
        const remainMonths = months % 12;
        return remainMonths > 0 ? `${years} tuổi ${remainMonths} tháng` : `${years} tuổi`;
    };

    return (
        <ParentLayout>
            <div className="page-header">
                <h1 className="page-title">Hồ sơ trẻ</h1>
            </div>

            <p className="children-note">
                Để thêm hoặc chỉnh sửa hồ sơ trẻ, vui lòng liên hệ nhân viên tại trung tâm.
            </p>

            {loading ? (
                <p className="loading-text">Đang tải...</p>
            ) : error ? (
                <p className="loading-text">{error}</p>
            ) : children.length === 0 ? (
                <div className="empty-state">
                    <p>Chưa có hồ sơ trẻ nào được đăng ký.</p>
                    <p style={{ fontSize: "13px" }}>Vui lòng đến trung tâm với giấy khai sinh để được nhân viên hỗ trợ đăng ký.</p>
                </div>
            ) : (
                <div className="children-grid">
                    {children.map((child) => (
                        <div key={child.id} className="child-card">
                            <div className="child-card__avatar">
                                {child.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="child-card__info">
                                <h3>{child.name}</h3>
                                <p>Ngày sinh: {new Date(child.dob).toLocaleDateString("vi-VN")}</p>
                                <p>Giới tính: {genderLabel[child.gender]}</p>
                                <p>Tuổi: {getAgeText(child.dob)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </ParentLayout>
    );
}
