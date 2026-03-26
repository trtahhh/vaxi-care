const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const UserRepository = require("../repositories/UserRepository");
const { AppDataSource } = require("../models/data-source");

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

class AuthService {
  async login(email, password) {
    if (!email || !password) {
      throw new Error("Vui lòng nhập email và mật khẩu.");
    }

    const userRepo = new UserRepository();
    const user = await userRepo.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new Error("Email hoặc mật khẩu không đúng.");
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await userRepo.update(user);

    return { user, accessToken, refreshToken };
  }

  async register(data) {
    if (!data.username || !data.email || !data.password) {
      throw new Error("Vui lòng điền đầy đủ thông tin bắt buộc.");
    }

    if (data.password.length < 6) {
      throw new Error("Mật khẩu phải có ít nhất 6 ký tự.");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new Error("Email không hợp lệ.");
    }

    if (data.phone && !/^0\d{9}$/.test(data.phone)) {
      throw new Error("Số điện thoại phải bắt đầu bằng 0 và có 10 chữ số.");
    }

    const userRepo = new UserRepository();
    const existing = await userRepo.findByEmailOrUsername(data.email, data.username);
    if (existing) {
      throw new Error("Email hoặc tên đăng nhập đã tồn tại.");
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = userRepo.create({
      username: data.username,
      email: data.email.toLowerCase().trim(),
      password: hashedPassword,
      fullName: data.fullName || null,
      phone: data.phone || null,
      role: "parent"
    });
    return await userRepo.insert(user);
  }

  async logout(refreshToken) {
    if (!refreshToken) return;

    const userRepo = new UserRepository();
    const user = await userRepo.findByRefreshToken(refreshToken);
    if (user) {
      user.refreshToken = null;
      await userRepo.update(user);
    }
  }

  async validateToken(token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      return payload;
    } catch (error) {
      return null;
    }
  }

  async refreshAccessToken(refreshToken) {
    try {
      const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      const userRepo = new UserRepository();
      const user = await userRepo.findById(payload.id);
      if (!user || user.refreshToken !== refreshToken) {
        throw new Error("Invalid refresh token");
      }
      const accessToken = generateAccessToken(user);
      return { user, accessToken };
    } catch (error) {
      throw new Error("Token refresh failed");
    }
  }
}

module.exports = AuthService;
