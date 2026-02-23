import { useState, useEffect } from "react";
import api from "../../services/api";
import ParentLayout from "../../components/ParentLayout";
import "../../styles/parent.css";

export default function Appointments() {
    const [data, setData] = useState({ upcoming: [], history: [] });
    const [children, setChildren] = useState([]);
    const [vaccines, setVaccines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ childId: "", vaccineId: "", date: "", notes: "" });
    const [slotInfo, setSlotInfo] = useState(null);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState("upcoming");

    const fetchData = async () => {
        setLoading(true);
        try {
            const [appointmentsRes, childrenRes, vaccinesRes] = await Promise.all([
                api.get("/parent/appointments"),
                api.get("/parent/children"),
                api.get("/vaccines"), // Route công khai lấy danh sách vaccine
            ]);
            setData(appointmentsRes.data);
            setChildren(childrenRes.data);
            setVaccines(vaccinesRes.data);
        } catch {
            setError("Không thể tải dữ liệu.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const checkSlots = async (date) => {
        if (!date) return;
        try {
            const res = await api.get(`/parent/appointments/slots?date=${date}`);
            setSlotInfo(res.data);
        } catch {
            setSlotInfo(null);
        }
    };

    const handleDateChange = (e) => {
        const date = e.target.value;
        setForm({ ...form, date });
        checkSlots(date);
    };

    const handleBook = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError("");
        try {
            await api.post("/parent/appointments", form);
            setShowForm(false);
            fetchData();
        } catch (err) {
            setError(err.response?.data?.message || "Đặt lịch thất bại.");
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = async (id) => {
        if (!window.confirm("Bạn có chắc muốn hủy lịch hẹn này không?")) return;
        try {
            await api.patch(`/parent/appointments/${id}/cancel`);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || "Không thể hủy lịch hẹn.");
        }
    };

    const statusLabel = {
        confirmed: "Đã xác nhận",
        completed: "Đã hoàn thành",
        cancelled: "Đã hủy",
        pending: "Đang chờ",
    };
    const statusClass = {
        confirmed: "badge badge--blue",
        completed: "badge badge--green",
        cancelled: "badge badge--red",
        pending: "badge badge--yellow",
    };

    return (
        <ParentLayout>
            <div className="page-header">
                <h1 className="page-title">Lịch tiêm chủng</h1>
                <button
                    className="btn btn--primary"
                    onClick={() => { setShowForm(true); setError(""); setSlotInfo(null); }}
                >
                    Đặt lịch mới
                </button>
            </div>

            {showForm && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h3 className="modal-title">Đặt lịch tiêm</h3>
                        <form onSubmit={handleBook} className="modal-form">
                            <div className="form-group">
                                <label>Chọn bé</label>
                                <select
                                    value={form.childId}
                                    onChange={(e) => setForm({ ...form, childId: e.target.value })}
                                    required
                                >
                                    <option value="">-- Chọn hồ sơ trẻ --</option>
                                    {children.map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Chọn vaccine</label>
                                <select
                                    value={form.vaccineId}
                                    onChange={(e) => setForm({ ...form, vaccineId: e.target.value })}
                                    required
                                >
                                    <option value="">-- Chọn vaccine --</option>
                                    {vaccines.map((v) => (
                                        <option key={v.id} value={v.id}>
                                            {v.name} {v.ageLabel ? `(${v.ageLabel})` : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Ngày hẹn</label>
                                <input
                                    type="datetime-local"
                                    value={form.date}
                                    onChange={handleDateChange}
                                    min={new Date().toISOString().slice(0, 16)}
                                    required
                                />
                                {slotInfo && (
                                    <p className={`slot-info ${slotInfo.availableSlots === 0 ? "slot-info--full" : "slot-info--ok"}`}>
                                        Còn {slotInfo.availableSlots}/{slotInfo.maxSlots} chỗ trong ngày này
                                    </p>
                                )}
                            </div>
                            <div className="form-group">
                                <label>Ghi chú (tùy chọn)</label>
                                <textarea
                                    value={form.notes}
                                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                    placeholder="Nhập ghi chú nếu có"
                                    rows={2}
                                />
                            </div>
                            {error && <p className="form-error">{error}</p>}
                            <div className="modal-actions">
                                <button type="button" className="btn btn--secondary" onClick={() => setShowForm(false)}>
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn--primary"
                                    disabled={saving || slotInfo?.availableSlots === 0}
                                >
                                    {saving ? "Đang đặt..." : "Xác nhận đặt lịch"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="tab-bar">
                <button
                    className={`tab-btn ${activeTab === "upcoming" ? "tab-btn--active" : ""}`}
                    onClick={() => setActiveTab("upcoming")}
                >
                    Lịch sắp tới ({data.upcoming.length})
                </button>
                <button
                    className={`tab-btn ${activeTab === "history" ? "tab-btn--active" : ""}`}
                    onClick={() => setActiveTab("history")}
                >
                    Lịch sử ({data.history.length})
                </button>
            </div>

            {loading ? (
                <p className="loading-text">Đang tải...</p>
            ) : (
                <div className="appointment-list">
                    {(activeTab === "upcoming" ? data.upcoming : data.history).length === 0 ? (
                        <div className="empty-state">
                            <p>{activeTab === "upcoming" ? "Không có lịch hẹn sắp tới." : "Chưa có lịch sử tiêm."}</p>
                        </div>
                    ) : (
                        (activeTab === "upcoming" ? data.upcoming : data.history).map((appt) => (
                            <div key={appt.id} className="appointment-card">
                                <div className="appointment-card__info">
                                    <h4>{appt.vaccine?.name}</h4>
                                    <p>Bé: <strong>{appt.child?.name}</strong></p>
                                    <p>Ngày: {new Date(appt.date).toLocaleString("vi-VN")}</p>
                                    {appt.notes && <p>Ghi chú: {appt.notes}</p>}
                                </div>
                                <div className="appointment-card__right">
                                    <span className={statusClass[appt.status]}>
                                        {statusLabel[appt.status]}
                                    </span>
                                    {appt.status === "confirmed" && (
                                        <button
                                            className="btn btn--danger btn--sm"
                                            onClick={() => handleCancel(appt.id)}
                                        >
                                            Hủy lịch
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </ParentLayout>
    );
}
