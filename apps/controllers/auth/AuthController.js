const express = require('express');
const router = express.Router();
const AuthService = require('../../services/AuthService');

const authService = new AuthService();

router.get("/login", (req, res) => {
    res.render("auth/login", { error: null });
});

router.post("/login", async (req, res) => {
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
        res.render("auth/login", { error: error.message });
    }
});

router.get("/register", (req, res) => {
    res.render("auth/register", { error: null, success: null });
});

router.post("/register", async (req, res) => {
    try {
        await authService.register(req.body);
        res.render("auth/login", { error: null, success: "Đăng ký thành công. Vui lòng đăng nhập." });
    } catch (error) {
        res.render("auth/register", { error: error.message, success: null });
    }
});

router.post("/logout", async (req, res) => {
    try {
        const token = req.cookies.refreshToken;
        await authService.logout(token);
        res.clearCookie("refreshToken");
        res.clearCookie("accessToken");
        res.redirect("/auth/login");
    } catch (error) {
        res.redirect("/");
    }
});

module.exports = router;
