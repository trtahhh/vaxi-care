const express = require("express");
const router = express.Router();

router.use("/auth", require(__dirname + "/auth/AuthController"));
router.use("/admin", require(__dirname + "/admin/AdminController"));
router.use("/", require(__dirname + "/home/HomeController"));

module.exports = router;
