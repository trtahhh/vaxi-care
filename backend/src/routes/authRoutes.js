const express = require("express");
const router = express.Router();
const authController = require("../controller/authController");
const { authenticate } = require("../middleware/authMiddleware");

// Public routes
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.post("/refresh", authController.refreshToken);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

// Protected routes (cần đăng nhập)
router.patch("/change-password", authenticate, authController.changePassword);

module.exports = router;
