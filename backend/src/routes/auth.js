const { Router } = require("express");
const AuthController = require("../controller/AuthController");

const router = Router();

// Login route
router.post("/login", AuthController.login);

// Register route
router.post("/register", AuthController.register);

module.exports = router;
