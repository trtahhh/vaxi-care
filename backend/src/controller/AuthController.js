const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { AppDataSource } = require("../data-source");

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

const sendEmail = async (to, subject, html) => {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
    await transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, html });
};

// POST /api/auth/register
exports.register = async (req, res) => {
    try {
        const { username, email, password, fullName, phone } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ message: "Vui lòng điền đầy đủ thông tin bắt buộc." });
        }

        const repo = userRepo();
        const existingUser = await repo.findOne({ where: [{ email }, { username }] });
        if (existingUser) {
            return res.status(409).json({ message: "Email hoặc tên đăng nhập đã tồn tại." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = repo.create({
            username,
            email,
            password: hashedPassword,
            fullName: fullName || null,
            phone: phone || null,
            role: "parent",
        });
        await repo.save(newUser);

        res.status(201).json({ message: "Đăng ký thành công." });
    } catch (error) {
        res.status(500).json({ message: "Lỗi server.", error: error.message });
    }
};

// POST /api/auth/login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Vui lòng nhập email và mật khẩu." });
        }

        const repo = userRepo();
        const user = await repo.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({ message: "Email hoặc mật khẩu không đúng." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Email hoặc mật khẩu không đúng." });
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        user.refreshToken = refreshToken;
        await repo.save(user);

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.json({
            accessToken,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
            },
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi server.", error: error.message });
    }
};

// POST /api/auth/logout
exports.logout = async (req, res) => {
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
        res.json({ message: "Đăng xuất thành công." });
    } catch (error) {
        res.status(500).json({ message: "Lỗi server.", error: error.message });
    }
};

// POST /api/auth/refresh
exports.refreshToken = async (req, res) => {
    try {
        const token = req.cookies.refreshToken;
        if (!token) {
            return res.status(401).json({ message: "Không tìm thấy refresh token." });
        }

        const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
        const repo = userRepo();
        const user = await repo.findOne({ where: { id: payload.id, refreshToken: token } });

        if (!user) {
            return res.status(403).json({ message: "Refresh token không hợp lệ." });
        }

        const newAccessToken = generateAccessToken(user);
        res.json({ accessToken: newAccessToken });
    } catch (error) {
        res.status(403).json({ message: "Refresh token hết hạn hoặc không hợp lệ." });
    }
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const repo = userRepo();
        const user = await repo.findOne({ where: { email } });

        // Luôn trả về cùng thông báo để tránh lộ thông tin email
        if (!user) {
            return res.json({ message: "Nếu email tồn tại, một liên kết đặt lại mật khẩu sẽ được gửi." });
        }

        const resetToken = crypto.randomBytes(32).toString("hex");
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 giờ
        await repo.save(user);

        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
        await sendEmail(
            email,
            "VaxiCare - Đặt lại mật khẩu",
            `<p>Nhấn vào liên kết sau để đặt lại mật khẩu (hết hạn sau 1 giờ):</p>
             <a href="${resetUrl}">${resetUrl}</a>
             <p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`
        );

        res.json({ message: "Nếu email tồn tại, một liên kết đặt lại mật khẩu sẽ được gửi." });
    } catch (error) {
        res.status(500).json({ message: "Lỗi server.", error: error.message });
    }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            return res.status(400).json({ message: "Thiếu token hoặc mật khẩu mới." });
        }

        const repo = userRepo();
        const user = await repo.findOne({ where: { resetPasswordToken: token } });

        if (!user || !user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
            return res.status(400).json({ message: "Token không hợp lệ hoặc đã hết hạn." });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await repo.save(user);

        res.json({ message: "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại." });
    } catch (error) {
        res.status(500).json({ message: "Lỗi server.", error: error.message });
    }
};

// PATCH /api/auth/change-password (yêu cầu đăng nhập)
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const repo = userRepo();
        const user = await repo.findOne({ where: { id: req.user.id } });

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Mật khẩu hiện tại không đúng." });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await repo.save(user);

        res.json({ message: "Đổi mật khẩu thành công." });
    } catch (error) {
        res.status(500).json({ message: "Lỗi server.", error: error.message });
    }
};
