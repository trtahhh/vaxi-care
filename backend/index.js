const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { AppDataSource } = require('./src/data-source');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const authRoutes = require("./src/routes/auth");

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);

app.get('/', (req, res) => {
  res.send('VaxiCare Backend is running!');
});

// Initialize Database
AppDataSource.initialize()
    .then(() => {
        console.log("Data Source has been initialized!");
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    })
    .catch((err) => {
        console.error("Error during Data Source initialization", err);
    });
