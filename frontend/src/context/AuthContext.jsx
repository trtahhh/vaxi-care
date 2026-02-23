import { createContext, useContext, useState, useEffect } from "react";
import api, { setAccessToken, getAccessToken } from "../services/api";
import axios from "axios";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Khi app khởi động, thử lấy access token mới bằng refresh token trong cookie
    useEffect(() => {
        const tryRefresh = async () => {
            try {
                const response = await axios.post(
                    "http://localhost:3000/api/auth/refresh",
                    {},
                    { withCredentials: true }
                );
                setAccessToken(response.data.accessToken);
                // Decode token để lấy thông tin user cơ bản
                const payload = JSON.parse(atob(response.data.accessToken.split(".")[1]));
                setUser({ id: payload.id, role: payload.role });
            } catch {
                // Không có refresh token hợp lệ, user chưa đăng nhập
                setUser(null);
            } finally {
                setLoading(false);
            }
        };
        tryRefresh();
    }, []);

    const login = async (email, password) => {
        const response = await api.post("/auth/login", { email, password });
        setAccessToken(response.data.accessToken);
        setUser(response.data.user);
        return response.data;
    };

    const logout = async () => {
        await api.post("/auth/logout");
        setAccessToken(null);
        setUser(null);
    };

    const register = async (data) => {
        const response = await api.post("/auth/register", data);
        return response.data;
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, register }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth phải được dùng trong AuthProvider");
    return context;
};
