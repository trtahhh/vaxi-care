const jwt = require("jsonwebtoken");

const checkJwt = (req, res, next) => {
    const token = req.headers["authorization"]?.split(" ")[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({ message: "No token provided" });
    }

    try {
        const jwtPayload = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret_key");
        res.locals.jwtPayload = jwtPayload;
        
        // Refresh token logic can go here (optional)
        
        next();
    } catch (error) {
        res.status(401).json({ message: "Invalid token" });
    }
};

module.exports = checkJwt;
