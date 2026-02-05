const { DataSource } = require("typeorm");
require("dotenv").config();

const AppDataSource = new DataSource({
    type: "mysql",
    host: process.env.DB_HOST || "localhost",
    port: 3306,
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "vaxi_care",
    synchronize: true, // Auto-create tables (Dev only)
    logging: false,
    entities: [__dirname + "/entity/*.js"],
    subscribers: [],
    migrations: [],
});

module.exports = { AppDataSource };
