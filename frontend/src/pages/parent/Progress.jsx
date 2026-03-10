import { useState, useEffect } from "react";
import api from "../../services/api";
import ParentLayout from "../../components/ParentLayout";
import "../../styles/parent.css";

export default function Progress() {
    const [children, setChildren] = useState([]);
    const [selectedChild, setSelectedChild] = useState(null);
    const [progressData, setProgressData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [childrenLoading, setChildrenLoading] = useState(true);

    useEffect(() => {
        const fetchChildren = async () => {
            try {
                const res = await api.get("/parent/children");
                setChildren(res.data);
                if (res.data.length > 0) {
                    setSelectedChild(res.data[0].id);
                }
            } finally {
                setChildrenLoading(false);
            }
        };
        fetchChildren();
    }, []);

    useEffect(() => {
        if (!selectedChild) return;
        const fetchProgress = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/parent/vaccine-progress/${selectedChild}`);
                setProgressData(res.data);
            } catch {
                setProgressData(null);
            } finally {
                setLoading(false);
            }
        };
        fetchProgress();
    }, [selectedChild]);

    return (
        <ParentLayout>
            <div className="page-header">
                <h1 className="page-title">Tiến độ tiêm chủng</h1>
            </div>

            {childrenLoading ? (
                <p className="loading-text">Đang tải...</p>
            ) : children.length === 0 ? (
                <div className="empty-state">
                    <p>Bạn chưa có hồ sơ trẻ. Hãy thêm hồ sơ trẻ trước.</p>
                </div>
            ) : (
                <>
                    <div className="child-selector">
                        {children.map((child) => (
                            <button
                                key={child.id}
                                className={`child-tab ${selectedChild === child.id ? "child-tab--active" : ""}`}
                                onClick={() => setSelectedChild(child.id)}
                            >
                                {child.name}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <p className="loading-text">Đang tải tiến độ...</p>
                    ) : progressData ? (
                        <>
                            <div className="progress-summary">
                                <div className="summary-card">
                                    <span className="summary-number">{progressData.summary.vaccinatedFromRecommended}</span>
                                    <span className="summary-label">Đã tiêm (theo khuyến nghị)</span>
                                </div>
                                <div className="summary-card">
                                    <span className="summary-number">{progressData.summary.recommendedCount}</span>
                                    <span className="summary-label">Tổng vaccine khuyến nghị</span>
                                </div>
                                <div className="summary-card summary-card--highlight">
                                    <span className="summary-number">{progressData.summary.completionRate}%</span>
                                    <span className="summary-label">Hoàn thành</span>
                                </div>
                            </div>

                            <div className="progress-bar-wrapper">
                                <div
                                    className="progress-bar-fill"
                                    style={{ width: `${progressData.summary.completionRate}%` }}
                                />
                            </div>

                            <h3 className="section-title">Danh sách vaccine</h3>
                            <div className="vaccine-list">
                                {progressData.vaccines.map((vaccine) => (
                                    <div
                                        key={vaccine.id}
                                        className={`vaccine-item ${vaccine.vaccinated ? "vaccine-item--done" : vaccine.recommended ? "vaccine-item--due" : ""}`}
                                    >
                                        <div className="vaccine-item__left">
                                            <span className={`vaccine-status-dot ${vaccine.vaccinated ? "dot--green" : "dot--grey"}`} />
                                            <div>
                                                <p className="vaccine-name">{vaccine.name}</p>
                                                {vaccine.ageLabel && (
                                                    <p className="vaccine-age">Khuyến nghị: {vaccine.ageLabel}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="vaccine-item__right">
                                            {vaccine.vaccinated ? (
                                                <span className="badge badge--green">Đã tiêm</span>
                                            ) : vaccine.recommended ? (
                                                <span className="badge badge--yellow">Cần tiêm</span>
                                            ) : (
                                                <span className="badge badge--grey">Chưa đến tuổi</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <p className="loading-text">Không thể tải dữ liệu tiến độ.</p>
                    )}
                </>
            )}
        </ParentLayout>
    );
}
