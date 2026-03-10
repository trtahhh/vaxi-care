const jwt = require("jsonwebtoken");

// Xác thực access token từ Cookie thay vì Header Authorization
exports.authenticate = (req, res, next) => {
    // In monolithic app, we use cookies since the browser handles the state
    const token = req.cookies.accessToken;

    if (!token) {
        return res.redirect('/auth/login');
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = payload; // { id, role }
        
        // Pass user info to locals so all views can access it
        res.locals.user = req.user;
        next();
    } catch (error) {
        // Token expired or invalid
        res.clearCookie('accessToken');
        return res.redirect('/auth/login');
    }
};

// Kiểm tra role có nằm trong danh sách được phép không
exports.authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            // Render a 403 page instead of returning JSON
            return res.status(403).send("Bạn không có quyền truy cập chức năng này.");
        }
        next();
    };
};
