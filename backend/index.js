const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const { AppDataSource } = require("./src/data-source");
const { startNotificationScheduler } = require("./src/scheduler/notificationScheduler");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Routes
const authRoutes = require("./src/routes/authRoutes");
const parentRoutes = require("./src/routes/parentRoutes");

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true, // Cho phép gửi cookie
}));
app.use(express.json());
app.use(cookieParser());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/parent", parentRoutes);

app.get("/", (req, res) => {
    res.send("VaxiCare Backend is running!");
});

// Khởi động DB rồi mới chạy server và scheduler
AppDataSource.initialize()
    .then(() => {
        console.log("Data Source has been initialized!");
        startNotificationScheduler();
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    })
    .catch((err) => {
        console.error("Error during Data Source initialization", err);
    });
