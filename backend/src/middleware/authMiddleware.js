const jwt = require("jsonwebtoken");

// Xác thực access token từ header Authorization: Bearer <token>
exports.authenticate = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "Yêu cầu xác thực. Vui lòng đăng nhập." });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = payload; // { id, role }
        next();
    } catch (error) {
        return res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn." });
    }
};

// Kiểm tra role có nằm trong danh sách được phép không
exports.authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Bạn không có quyền truy cập chức năng này." });
        }
        next();
    };
};
