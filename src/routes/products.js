const express = require("express");
const ProductController = require("../controllers/productController");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

// Public routes
router.get("/", ProductController.getProducts);
router.get("/:id", ProductController.getProduct);

// Admin only routes
router.post(
    "/",
    authenticate,
    authorize("ADMIN"),
    ProductController.createProduct
);
router.put(
    "/:id",
    authenticate,
    authorize("ADMIN"),
    ProductController.updateProduct
);
router.delete(
    "/:id",
    authenticate,
    authorize("ADMIN"),
    ProductController.deleteProduct
);

module.exports = router;
