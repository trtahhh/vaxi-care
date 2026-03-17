const crypto = require('crypto');

// Simple CSRF middleware using sessions
const csrfMiddleware = (req, res, next) => {
    // Skip CSRF for GET requests (they just read data)
    if (req.method === 'GET') {
        return next();
    }

    // Get token from header (sent by fetch/axios) or form field
    const tokenFromHeader = req.headers['x-csrf-token'];
    const tokenFromForm = req.body._csrf;
    const tokenFromQuery = req.query._csrf;
    const submittedToken = tokenFromHeader || tokenFromForm || tokenFromQuery;

    // Get stored token from cookie or session
    const storedToken = req.cookies['csrf-token'] || req.session?.csrfToken;

    // For now, we'll use a simpler approach - generate token per form render
    // In production, use a proper session store
    if (!storedToken && req.method === 'GET') {
        // Generate new token for GET requests
        const token = crypto.randomBytes(32).toString('hex');
        res.cookie('csrf-token', token, {
            httpOnly: false, // Allow JS to read for form submission
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 3600000 // 1 hour
        });
        res.locals.csrfToken = token;
    }

    next();
};

module.exports = { csrfMiddleware };