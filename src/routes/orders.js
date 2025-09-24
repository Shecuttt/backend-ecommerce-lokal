const express = require("express");
const OrderController = require("../controllers/orderController");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

// All order routes require authentication
router.use(authenticate);

// User routes
router.post("/", OrderController.createOrder);
router.get("/my-orders", OrderController.getUserOrders);
router.get("/:orderId", OrderController.getOrder);
router.patch("/:orderId/cancel", OrderController.cancelOrder);

// Admin routes
router.get("/", authorize("ADMIN"), OrderController.getAllOrders);
router.patch(
    "/:orderId/status",
    authorize("ADMIN"),
    OrderController.updateOrderStatus
);

module.exports = router;
