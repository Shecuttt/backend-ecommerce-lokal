const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

class OrderController {
    // Create order from cart
    static async createOrder(req, res) {
        try {
            const userId = req.user.id;

            // Get user's cart with items
            const cart = await prisma.cart.findFirst({
                where: { userId },
                include: {
                    items: {
                        include: { product: true },
                    },
                },
            });

            if (!cart || cart.items.length === 0) {
                return res.status(400).json({ error: "Cart is empty" });
            }

            // Check stock availability for all items
            for (const item of cart.items) {
                if (item.product.stock < item.quantity) {
                    return res.status(400).json({
                        error: `Insufficient stock for ${item.product.name}`,
                    });
                }
            }

            // Calculate total amount
            const totalAmount = cart.items.reduce((sum, item) => {
                return sum + item.product.price * item.quantity;
            }, 0);

            // Create order using transaction
            const result = await prisma.$transaction(async (prisma) => {
                // Create order
                const order = await prisma.order.create({
                    data: {
                        userId,
                        totalAmount,
                        status: "PENDING",
                    },
                });

                // Create order items and update product stock
                for (const item of cart.items) {
                    // Create order item
                    await prisma.orderItem.create({
                        data: {
                            orderId: order.id,
                            productId: item.productId,
                            quantity: item.quantity,
                            price: item.product.price, // Store price at time of order
                        },
                    });

                    // Update product stock
                    await prisma.product.update({
                        where: { id: item.productId },
                        data: {
                            stock: {
                                decrement: item.quantity,
                            },
                        },
                    });
                }

                // Clear cart
                await prisma.cartItem.deleteMany({
                    where: { cartId: cart.id },
                });

                return order;
            });

            // Get complete order data
            const completeOrder = await prisma.order.findUnique({
                where: { id: result.id },
                include: {
                    items: {
                        include: { product: true },
                    },
                },
            });

            res.status(201).json({
                message: "Order created successfully",
                order: completeOrder,
            });
        } catch (error) {
            console.error("Create order error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    // Get user's orders
    static async getUserOrders(req, res) {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 10 } = req.query;

            const skip = (parseInt(page) - 1) * parseInt(limit);
            const take = parseInt(limit);

            const [orders, totalCount] = await Promise.all([
                prisma.order.findMany({
                    where: { userId },
                    include: {
                        items: {
                            include: { product: true },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                    skip,
                    take,
                }),
                prisma.order.count({ where: { userId } }),
            ]);

            res.json({
                orders,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalCount,
                    totalPages: Math.ceil(totalCount / take),
                },
            });
        } catch (error) {
            console.error("Get user orders error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    // Get single order
    static async getOrder(req, res) {
        try {
            const userId = req.user.id;
            const { orderId } = req.params;

            const order = await prisma.order.findFirst({
                where: {
                    id: orderId,
                    userId, // Make sure user can only access their own orders
                },
                include: {
                    items: {
                        include: { product: true },
                    },
                },
            });

            if (!order) {
                return res.status(404).json({ error: "Order not found" });
            }

            res.json(order);
        } catch (error) {
            console.error("Get order error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    // Cancel order (only if status is PENDING)
    static async cancelOrder(req, res) {
        try {
            const userId = req.user.id;
            const { orderId } = req.params;

            const order = await prisma.order.findFirst({
                where: {
                    id: orderId,
                    userId,
                },
                include: {
                    items: {
                        include: { product: true },
                    },
                },
            });

            if (!order) {
                return res.status(404).json({ error: "Order not found" });
            }

            if (order.status !== "PENDING") {
                return res.status(400).json({
                    error: "Cannot cancel order that is already being processed",
                });
            }

            // Cancel order using transaction
            await prisma.$transaction(async (prisma) => {
                // Update order status
                await prisma.order.update({
                    where: { id: orderId },
                    data: { status: "CANCELLED" },
                });

                // Restore product stock
                for (const item of order.items) {
                    await prisma.product.update({
                        where: { id: item.productId },
                        data: {
                            stock: {
                                increment: item.quantity,
                            },
                        },
                    });
                }
            });

            res.json({ message: "Order cancelled successfully" });
        } catch (error) {
            console.error("Cancel order error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    // Admin: Get all orders
    static async getAllOrders(req, res) {
        try {
            const { page = 1, limit = 10, status } = req.query;

            const skip = (parseInt(page) - 1) * parseInt(limit);
            const take = parseInt(limit);

            const where = {};
            if (status) where.status = status.toUpperCase();

            const [orders, totalCount] = await Promise.all([
                prisma.order.findMany({
                    where,
                    include: {
                        user: {
                            select: { id: true, name: true, email: true },
                        },
                        items: {
                            include: { product: true },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                    skip,
                    take,
                }),
                prisma.order.count({ where }),
            ]);

            res.json({
                orders,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalCount,
                    totalPages: Math.ceil(totalCount / take),
                },
            });
        } catch (error) {
            console.error("Get all orders error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    // Admin: Update order status
    static async updateOrderStatus(req, res) {
        try {
            const { orderId } = req.params;
            const { status } = req.body;

            const validStatuses = [
                "PENDING",
                "PROCESSING",
                "SHIPPED",
                "DELIVERED",
                "CANCELLED",
            ];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ error: "Invalid status" });
            }

            const order = await prisma.order.findUnique({
                where: { id: orderId },
            });

            if (!order) {
                return res.status(404).json({ error: "Order not found" });
            }

            const updatedOrder = await prisma.order.update({
                where: { id: orderId },
                data: { status },
                include: {
                    user: {
                        select: { id: true, name: true, email: true },
                    },
                    items: {
                        include: { product: true },
                    },
                },
            });

            res.json({
                message: "Order status updated successfully",
                order: updatedOrder,
            });
        } catch (error) {
            console.error("Update order status error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }
}

module.exports = OrderController;
