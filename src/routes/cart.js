const express = require("express");
const CartController = require("../controllers/cartController");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// All cart routes require authentication
router.use(authenticate);

router.get("/", CartController.getCart);
router.post("/add", CartController.addToCart);
router.put("/item/:itemId", CartController.updateCartItem);
router.delete("/item/:itemId", CartController.removeFromCart);
router.delete("/clear", CartController.clearCart);

module.exports = router;
