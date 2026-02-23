import axios from "axios";

// Access token lưu trong memory (không lưu localStorage để an toàn hơn)
let accessToken = null;

export const setAccessToken = (token) => {
    accessToken = token;
};

export const getAccessToken = () => accessToken;

const api = axios.create({
    baseURL: "http://localhost:3000/api",
    withCredentials: true, // Gửi cookie (refreshToken) theo mỗi request
});

// Request interceptor: tự động đính kèm access token
api.interceptors.request.use((config) => {
    if (accessToken) {
        config.headers["Authorization"] = `Bearer ${accessToken}`;
    }
    return config;
});

// Response interceptor: tự động refresh token khi gặp lỗi 401
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                // Nếu đang refresh thì đưa request vào hàng đợi
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then((token) => {
                    originalRequest.headers["Authorization"] = `Bearer ${token}`;
                    return api(originalRequest);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const response = await axios.post(
                    "http://localhost:3000/api/auth/refresh",
                    {},
                    { withCredentials: true }
                );
                const newToken = response.data.accessToken;
                setAccessToken(newToken);
                processQueue(null, newToken);
                originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                setAccessToken(null);
                window.location.href = "/login";
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default api;
