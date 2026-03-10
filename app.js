const express = require("express");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const path = require("path");
const { AppDataSource } = require("./apps/models/data-source");
const { startNotificationScheduler } = require("./apps/scheduler/notificationScheduler");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Setup EJS for Server-Side Rendering
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'apps/views'));

// Serve static assets publicly
app.use('/static', express.static(path.join(__dirname, 'public')));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Handle standard HTML form submissions
app.use(cookieParser());

// Pass variables global to all Views
app.use((req, res, next) => {
    res.locals.error = null;
    res.locals.success = null;
    res.locals.user = req.user || null;
    res.locals.currentPath = req.path;
    next();
});

// FEATURE-BASED ROUTERS (Controller-as-Router)
app.use("/auth", require("./apps/controllers/auth/auth.controller"));
app.use("/", require("./apps/controllers/home/home.controller"));

// Fallback logic for not-found pages
app.use((req, res) => {
    res.status(404).render("client/404", { error: "Không tìm thấy trang." });
});

// Khởi động DB rồi mới chạy server và scheduler
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
