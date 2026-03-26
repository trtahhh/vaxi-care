const express = require("express");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const path = require("path");
const crypto = require("crypto");
const { AppDataSource } = require("./apps/models/data-source");
const { startNotificationScheduler } = require("./apps/scheduler/notificationScheduler");

// Global path base
global.__basedir = __dirname;

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'apps/views'));

app.use('/static', express.static(path.join(__dirname, 'public')));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '10kb' })); 
app.use(cookieParser());

app.use((req, res, next) => {
    const ip = req.ip;
    const now = Date.now();

    if (!global.requestCounts) global.requestCounts = {};
    if (!global.requestCounts[ip]) global.requestCounts[ip] = [];

    global.requestCounts[ip] = global.requestCounts[ip].filter(t => now - t < 60000);

    // Rate limit: 100 requests per minute
    if (global.requestCounts[ip].length > 100) {
        return res.status(429).send("Too many requests. Please try again later.");
    }

    global.requestCounts[ip].push(now);
    next();
});

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

app.use((req, res, next) => {
    res.locals.error = null;
    res.locals.success = null;
    res.locals.user = req.user || null;
    res.locals.currentPath = req.path;
    res.locals.csrfToken = null;
    next();
});

app.use(generateCsrfToken);

const controller = require(global.__basedir + "/apps/controllers");
app.use(controller);

app.use((req, res) => {
    res.status(404).render("client/404", { error: "Không tìm thấy trang." });
});

AppDataSource.initialize()
    .then(() => {
        console.log("Data Source has been initialized!");
        startNotificationScheduler();
        app.listen(port, () => {
            console.log(`Server is running at http://localhost:${port}`);
        });
    })
    .catch((err) => {
        console.error("Error during Data Source initialization", err);
    });
