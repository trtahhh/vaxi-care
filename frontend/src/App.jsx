import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

// Auth pages
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";

// Parent pages
import Children from "./pages/parent/Children";
import Appointments from "./pages/parent/Appointments";
import Progress from "./pages/parent/Progress";
import Notifications from "./pages/parent/Notifications";

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    {/* Public routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />

                    {/* Parent protected routes */}
                    <Route
                        path="/parent/dashboard"
                        element={
                            <ProtectedRoute allowedRoles={["parent"]}>
                                <Children />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/parent/children"
                        element={
                            <ProtectedRoute allowedRoles={["parent"]}>
                                <Children />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/parent/appointments"
                        element={
                            <ProtectedRoute allowedRoles={["parent"]}>
                                <Appointments />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/parent/progress"
                        element={
                            <ProtectedRoute allowedRoles={["parent"]}>
                                <Progress />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/parent/notifications"
                        element={
                            <ProtectedRoute allowedRoles={["parent"]}>
                                <Notifications />
                            </ProtectedRoute>
                        }
                    />

                    {/* Default redirect */}
                    <Route path="/" element={<Navigate to="/login" replace />} />
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}
