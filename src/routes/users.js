// src/routes/users.js
const express = require("express");
const UserController = require("../controllers/userController");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

// Admin only routes
router.get("/", authorize("ADMIN"), UserController.getAllUsers);
router.get("/stats", authorize("ADMIN"), UserController.getUsersStats);
router.get("/search", authorize("ADMIN"), UserController.searchUsers);

// User can view own profile, Admin can view any
router.get("/:userId", UserController.getUserById);
router.get("/:userId/details", UserController.getUserDetails);

module.exports = router;
