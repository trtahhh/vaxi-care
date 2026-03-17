const express = require('express');
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { AppDataSource } = require("../../models/data-source"); 
const { authenticate } = require("./auth.middleware");

const userRepo = () => AppDataSource.getRepository("User");

const generateAccessToken = (user) => {
    return jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "15m" }
    );
};

const generateRefreshToken = (user) => {
    return jwt.sign(
        { id: user.id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: "7d" }
    );
};

// ... Email Logic ...

// Routes & Controllers are MERGED Here!

// GET /auth/login - View Login Page
router.get("/login", (req, res) => {
    res.render("auth/login", { error: null });
});

// POST /auth/login - Process Login
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.render("auth/login", { error: "Vui lòng nhập email và mật khẩu." });
        }

        const repo = userRepo();
        const user = await repo.findOne({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.render("auth/login", { error: "Email hoặc mật khẩu không đúng." });
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        user.refreshToken = refreshToken;
        await repo.save(user);

        res.cookie("refreshToken", refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", maxAge: 7 * 24 * 60 * 60 * 1000 });
        res.cookie("accessToken", accessToken, { httpOnly: true }); // Storing access token as cookie for monolithic views
        
        // Redirect based on role
        if (user.role === 'admin') return res.redirect('/admin/dashboard');
        return res.redirect('/');
        
    } catch (error) {
        res.render("auth/login", { error: "Lỗi server." });
    }
});

// GET /auth/register - View Register Page
router.get("/register", (req, res) => {
    res.render("auth/register", { error: null, success: null });
});

// POST /auth/register - Process Registration
router.post("/register", async (req, res) => {
    try {
        const { username, email, password, fullName, phone } = req.body;
        if (!username || !email || !password) {
            return res.render("auth/register", { error: "Vui lòng điền đầy đủ thông tin bắt buộc.", success: null });
        }

        const repo = userRepo();
        const existingUser = await repo.findOne({ where: [{ email }, { username }] });
        if (existingUser) {
            return res.render("auth/register", { error: "Email hoặc tên đăng nhập đã tồn tại.", success: null });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = repo.create({ username, email, password: hashedPassword, fullName: fullName || null, phone: phone || null, role: "parent" });
        await repo.save(newUser);

        res.render("auth/login", { error: null, success: "Đăng ký thành công. Vui lòng đăng nhập." });
    } catch (error) {
        res.render("auth/register", { error: "Lỗi server.", success: null });
    }
});

router.post("/logout", async (req, res) => {
    try {
        const token = req.cookies.refreshToken;
        if (token) {
            const repo = userRepo();
            const user = await repo.findOne({ where: { refreshToken: token } });
            if (user) {
                user.refreshToken = null;
                await repo.save(user);
            }
        }
        res.clearCookie("refreshToken");
        res.clearCookie("accessToken");
        res.redirect("/auth/login");
    } catch (error) {
        res.redirect("/");
    }
});

module.exports = router;
