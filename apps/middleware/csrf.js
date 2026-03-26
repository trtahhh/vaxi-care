const crypto = require('crypto');

// Simple CSRF middleware using sessions
const csrfMiddleware = (req, res, next) => {
    if (req.method === 'GET') {
        return next();
    }

    const tokenFromHeader = req.headers['x-csrf-token'];
    const tokenFromForm = req.body._csrf;
    const tokenFromQuery = req.query._csrf;
    const submittedToken = tokenFromHeader || tokenFromForm || tokenFromQuery;

    const storedToken = req.cookies['csrf-token'] || req.session?.csrfToken;

    if (!storedToken && req.method === 'GET') {
        const token = crypto.randomBytes(32).toString('hex');
        res.cookie('csrf-token', token, {
            httpOnly: false, 
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 3600000 // 1 hour
        });
        res.locals.csrfToken = token;
    }

    next();
};

module.exports = { csrfMiddleware };