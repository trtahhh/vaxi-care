const { DataSource } = require("typeorm");
require("dotenv").config();

// Import entity schemas explicitly
const User = require("./User");
const Child = require("./Child");
const Vaccine = require("./Vaccine");
const Appointment = require("./Appointment");
const DailySlotConfig = require("./DailySlotConfig");
const Notification = require("./Notification");

const AppDataSource = new DataSource({
    type: "mysql",
    host: process.env.DB_HOST || "localhost",
    port: 3306,
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "vaxi_care",
    synchronize: true, // Auto-create tables (Dev only)
    logging: false,
    entities: [User, Child, Vaccine, Appointment, DailySlotConfig, Notification],
    subscribers: [],
    migrations: [],
});

module.exports = { AppDataSource };
