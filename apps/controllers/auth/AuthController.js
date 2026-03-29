const express = require('express');
const router = express.Router();
const AuthService = require('../../services/AuthService');

const authService = new AuthService();

// Inline CSRF guard for auth forms
const csrfGuard = (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const cookieToken = req.cookies['csrf-token'];
    const sentToken = req.body._csrf || req.headers['x-csrf-token'] || req.query._csrf;
    if (!cookieToken || !sentToken || cookieToken !== sentToken) {
        return res.status(403).send("Yêu cầu không hợp lệ. Vui lòng tải lại trang.");
    }
    next();
};

router.get("/login", (req, res) => {
    if (req.user) {
        return res.redirect(req.user.role === 'admin' ? '/admin/dashboard' : '/client/dashboard');
    }
    res.render("auth/login", { error: null, success: null });
});

router.post("/login", csrfGuard, async (req, res) => {
    try {
        const { email, password } = req.body;
        const { user, accessToken, refreshToken } = await authService.login(email, password);

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        res.cookie("accessToken", accessToken, { httpOnly: true });

        if (user.role === 'admin') return res.redirect('/admin/dashboard');
        return res.redirect('/client/dashboard');
    } catch (error) {
        res.render("auth/login", { error: error.message, success: null });
    }
});

router.get("/register", (req, res) => {
    if (req.user) {
        return res.redirect(req.user.role === 'admin' ? '/admin/dashboard' : '/client/dashboard');
    }
    res.render("auth/register", { error: null, success: null });
});

router.post("/register", csrfGuard, async (req, res) => {
    try {
        await authService.register(req.body);
        res.render("auth/login", { error: null, success: "Đăng ký thành công. Vui lòng đăng nhập." });
    } catch (error) {
        res.render("auth/register", { error: error.message, success: null });
    }
});

router.post("/logout", csrfGuard, async (req, res) => {
    try {
        const token = req.cookies.refreshToken;
        await authService.logout(token);
        res.clearCookie("refreshToken");
        res.clearCookie("accessToken");
    } catch (error) {
        // Still clear cookies even on error
    }
    res.redirect("/auth/login");
});

module.exports = router;
