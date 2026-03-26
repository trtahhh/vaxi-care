const jwt = require("jsonwebtoken");

exports.authenticate = (req, res, next) => {
    const token = req.cookies.accessToken;

    if (!token) {
        return res.redirect('/auth/login');
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = payload; 
        
        res.locals.user = req.user;
        next();
    } catch (error) {
        res.clearCookie('accessToken');
        return res.redirect('/auth/login');
    }
};

exports.authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).send("Bạn không có quyền truy cập chức năng này.");
        }
        next();
    };
};
