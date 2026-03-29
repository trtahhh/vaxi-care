const express = require("express");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const path = require("path");
const crypto = require("crypto");
const { AppDataSource } = require("./apps/models/data-source");
const { startNotificationScheduler } = require("./apps/scheduler/notificationScheduler");

// Security: Helmet
const helmet = require("helmet");

// Global path base
global.__basedir = __dirname;

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const expressLayouts = require('express-ejs-layouts');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'apps/views'));
app.use(expressLayouts);
app.set('layout', 'client/layout');

// Layout selection middleware
app.use((req, res, next) => {
    if (req.path === '/' || req.path.startsWith('/auth')) {
        res.locals.layout = 'client/empty_layout';
    } else if (req.path.startsWith('/admin')) {
        res.locals.layout = 'admin/layout';
    } else {
        res.locals.layout = 'client/layout';
    }
    next();
});

// Security headers first
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/img', express.static(path.join(__dirname, 'public/img')));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// In-memory rate limiter (note: use Redis for production/multi-instance)
app.use((req, res, next) => {
    const ip = req.ip;
    const now = Date.now();

    if (!global.requestCounts) global.requestCounts = {};
    if (!global.requestCounts[ip]) global.requestCounts[ip] = [];

    global.requestCounts[ip] = global.requestCounts[ip].filter(t => now - t < 60000);

    if (global.requestCounts[ip].length > 100) {
        return res.status(429).send("Too many requests. Please try again later.");
    }

    global.requestCounts[ip].push(now);
    next();
});

// CSRF token generation
const generateCsrfToken = (req, res, next) => {
    let token = req.cookies['csrf-token'];
    if (!token) {
        token = crypto.randomBytes(32).toString('hex');
        res.cookie('csrf-token', token, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 3600000
        });
    }
    res.locals.csrfToken = token;
    next();
};

// CSRF validation middleware for state-changing requests
const validateCsrfToken = (req, res, next) => {
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) return next();

    const cookieToken = req.cookies['csrf-token'];
    const bodyToken = req.body && req.body._csrf;
    const headerToken = req.headers['x-csrf-token'];
    const queryToken = req.query._csrf;

    const sentToken = bodyToken || headerToken || queryToken;

    if (!cookieToken || !sentToken || cookieToken !== sentToken) {
        return res.status(403).send("Yêu cầu không hợp lệ (CSRF token không khớp). Vui lòng tải lại trang và thử lại.");
    }

    next();
};

// Locals middleware (runs before routes)
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.currentPath = req.path;
    res.locals.error = null;
    res.locals.success = null;
    next();
});

app.use(generateCsrfToken);

// Routes (controllers will apply validateCsrfToken per route if needed)
const controller = require(global.__basedir + "/apps/controllers");
app.use(controller);

// 404 handler
app.use((req, res) => {
    res.status(404).render("client/404", { layout: 'client/empty_layout', error: "Không tìm thấy trang." });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("[Unhandled Error]", err);
    if (res.headersSent) return next(err);
    res.status(500).send("Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.");
});

// Graceful shutdown
let server;

AppDataSource.initialize()
    .then(async () => {
        console.log("Data Source has been initialized!");
        startNotificationScheduler();
        server = app.listen(port, () => {
            console.log(`Server is running at http://localhost:${port}`);
        });
    })
    .catch((err) => {
        console.error("Error during Data Source initialization", err);
    });

const gracefulShutdown = async (signal) => {
    console.log(`\n[Server] Nhận tín hiệu ${signal}, đang tắt server...`);
    if (server) server.close();
    try {
        await AppDataSource.destroy();
        console.log("[Server] Kết nối database đã đóng.");
    } catch (e) {
        console.error("[Server] Lỗi khi đóng database:", e);
    }
    process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
