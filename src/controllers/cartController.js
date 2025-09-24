const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

class CartController {
    // Get user's cart
    static async getCart(req, res) {
        try {
            const userId = req.user.id;

            const cart = await prisma.cart.findFirst({
                where: { userId },
                include: {
                    items: {
                        include: {
                            product: true,
                        },
                    },
                },
            });

            if (!cart) {
                // Create cart if doesn't exist
                const newCart = await prisma.cart.create({
                    data: { userId },
                    include: {
                        items: {
                            include: {
                                product: true,
                            },
                        },
                    },
                });
                return res.json(newCart);
            }

            // Calculate total
            const total = cart.items.reduce((sum, item) => {
                return sum + item.product.price * item.quantity;
            }, 0);

            res.json({
                ...cart,
                total,
            });
        } catch (error) {
            console.error("Get cart error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    // Add item to cart
    static async addToCart(req, res) {
        try {
            const userId = req.user.id;
            const { productId, quantity = 1 } = req.body;

            if (!productId) {
                return res
                    .status(400)
                    .json({ error: "Product ID is required" });
            }

            if (quantity <= 0) {
                return res
                    .status(400)
                    .json({ error: "Quantity must be greater than 0" });
            }

            // Check if product exists and has enough stock
            const product = await prisma.product.findUnique({
                where: { id: productId },
            });

            if (!product) {
                return res.status(404).json({ error: "Product not found" });
            }

            if (product.stock < quantity) {
                return res.status(400).json({ error: "Insufficient stock" });
            }

            // Get or create cart
            let cart = await prisma.cart.findFirst({
                where: { userId },
            });

            if (!cart) {
                cart = await prisma.cart.create({
                    data: { userId },
                });
            }

            // Check if item already in cart
            const existingItem = await prisma.cartItem.findUnique({
                where: {
                    cartId_productId: {
                        cartId: cart.id,
                        productId,
                    },
                },
            });

            if (existingItem) {
                // Update quantity
                const newQuantity = existingItem.quantity + parseInt(quantity);

                if (product.stock < newQuantity) {
                    return res
                        .status(400)
                        .json({ error: "Insufficient stock" });
                }

                const updatedItem = await prisma.cartItem.update({
                    where: { id: existingItem.id },
                    data: { quantity: newQuantity },
                    include: { product: true },
                });

                return res.json({
                    message: "Item quantity updated",
                    item: updatedItem,
                });
            } else {
                // Add new item
                const newItem = await prisma.cartItem.create({
                    data: {
                        cartId: cart.id,
                        productId,
                        quantity: parseInt(quantity),
                    },
                    include: { product: true },
                });

                return res.status(201).json({
                    message: "Item added to cart",
                    item: newItem,
                });
            }
        } catch (error) {
            console.error("Add to cart error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    // Update cart item quantity
    static async updateCartItem(req, res) {
        try {
            const userId = req.user.id;
            const { itemId } = req.params;
            const { quantity } = req.body;

            if (!quantity || quantity <= 0) {
                return res
                    .status(400)
                    .json({ error: "Valid quantity is required" });
            }

            // Check if item belongs to user
            const cartItem = await prisma.cartItem.findFirst({
                where: {
                    id: itemId,
                    cart: { userId },
                },
                include: { product: true },
            });

            if (!cartItem) {
                return res.status(404).json({ error: "Cart item not found" });
            }

            // Check stock
            if (cartItem.product.stock < parseInt(quantity)) {
                return res.status(400).json({ error: "Insufficient stock" });
            }

            const updatedItem = await prisma.cartItem.update({
                where: { id: itemId },
                data: { quantity: parseInt(quantity) },
                include: { product: true },
            });

            res.json({
                message: "Cart item updated",
                item: updatedItem,
            });
        } catch (error) {
            console.error("Update cart item error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    // Remove item from cart
    static async removeFromCart(req, res) {
        try {
            const userId = req.user.id;
            const { itemId } = req.params;

            // Check if item belongs to user
            const cartItem = await prisma.cartItem.findFirst({
                where: {
                    id: itemId,
                    cart: { userId },
                },
            });

            if (!cartItem) {
                return res.status(404).json({ error: "Cart item not found" });
            }

            await prisma.cartItem.delete({
                where: { id: itemId },
            });

            res.json({ message: "Item removed from cart" });
        } catch (error) {
            console.error("Remove from cart error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    // Clear entire cart
    static async clearCart(req, res) {
        try {
            const userId = req.user.id;

            const cart = await prisma.cart.findFirst({
                where: { userId },
            });

            if (!cart) {
                return res.status(404).json({ error: "Cart not found" });
            }

            await prisma.cartItem.deleteMany({
                where: { cartId: cart.id },
            });

            res.json({ message: "Cart cleared successfully" });
        } catch (error) {
            console.error("Clear cart error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }
}

module.exports = CartController;
