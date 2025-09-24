const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

class UserController {
    // Get all users (Admin only) with pagination
    static async getAllUsers(req, res) {
        try {
            const {
                page = 1,
                limit = 10,
                role,
                search,
                sortBy = "created_at",
                sortOrder = "desc",
            } = req.query;

            const skip = (parseInt(page) - 1) * parseInt(limit);
            const take = parseInt(limit);

            // Build where clause
            const where = {};
            if (role) where.role = role.toUpperCase();
            if (search) {
                where.OR = [
                    { name: { contains: search, mode: "insensitive" } },
                    { email: { contains: search, mode: "insensitive" } },
                ];
            }

            const [users, totalCount] = await Promise.all([
                prisma.user.findMany({
                    where,
                    select: {
                        user_id: true,
                        name: true,
                        email: true,
                        role: true,
                        phone_number: true,
                        created_at: true,
                        updated_at: true,
                        // Include counts for related data
                        _count: {
                            select: {
                                products: true,
                                orders: true,
                                carts: true,
                            },
                        },
                    },
                    skip,
                    take,
                    orderBy: { [sortBy]: sortOrder },
                }),
                prisma.user.count({ where }),
            ]);

            res.json({
                users,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalCount,
                    totalPages: Math.ceil(totalCount / take),
                },
            });
        } catch (error) {
            console.error("Get all users error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    // Get single user by ID (Admin only or own profile)
    static async getUserById(req, res) {
        try {
            const { userId } = req.params;
            const requestingUserId = req.user.user_id;
            const requestingUserRole = req.user.role;

            // Allow admin to view any user, or user to view own profile
            if (
                requestingUserRole !== "ADMIN" &&
                parseInt(userId) !== requestingUserId
            ) {
                return res.status(403).json({
                    error: "Access denied. You can only view your own profile.",
                });
            }

            const user = await prisma.user.findUnique({
                where: { user_id: parseInt(userId) },
                select: {
                    user_id: true,
                    name: true,
                    email: true,
                    role: true,
                    phone_number: true,
                    created_at: true,
                    updated_at: true,
                    // Include related data counts
                    _count: {
                        select: {
                            products: true,
                            orders: true,
                            carts: true,
                        },
                    },
                },
            });

            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }

            res.json({ user });
        } catch (error) {
            console.error("Get user by ID error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    // Get user with detailed information including related data (Admin only or own profile)
    static async getUserDetails(req, res) {
        try {
            const { userId } = req.params;
            const requestingUserId = req.user.user_id;
            const requestingUserRole = req.user.role;

            // Allow admin to view any user details, or user to view own details
            if (
                requestingUserRole !== "ADMIN" &&
                parseInt(userId) !== requestingUserId
            ) {
                return res.status(403).json({
                    error: "Access denied. You can only view your own details.",
                });
            }

            const user = await prisma.user.findUnique({
                where: { user_id: parseInt(userId) },
                select: {
                    user_id: true,
                    name: true,
                    email: true,
                    role: true,
                    phone_number: true,
                    created_at: true,
                    updated_at: true,
                },
            });

            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }

            // Get related data separately for better control
            const [products, orders, cart] = await Promise.all([
                // Recent products created by user
                prisma.product.findMany({
                    where: { user_id: parseInt(userId) },
                    take: 5,
                    orderBy: { created_at: "desc" },
                    select: {
                        product_id: true,
                        name: true,
                        price: true,
                        stock: true,
                        created_at: true,
                    },
                }),
                // Recent orders by user
                prisma.order.findMany({
                    where: { user_id: parseInt(userId) },
                    take: 5,
                    orderBy: { created_at: "desc" },
                    select: {
                        order_id: true,
                        status: true,
                        total_price: true,
                        payment_method: true,
                        created_at: true,
                        _count: {
                            select: {
                                items: true,
                            },
                        },
                    },
                }),
                // Current cart
                prisma.cart.findUnique({
                    where: { user_id: parseInt(userId) },
                    select: {
                        cart_id: true,
                        created_at: true,
                        updated_at: true,
                        _count: {
                            select: {
                                items: true,
                            },
                        },
                    },
                }),
            ]);

            res.json({
                user,
                statistics: {
                    total_products: products.length,
                    total_orders: orders.length,
                    cart_items: cart?._count?.items || 0,
                },
                recent_products: products,
                recent_orders: orders,
                cart_info: cart,
            });
        } catch (error) {
            console.error("Get user details error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    // Get users statistics (Admin only)
    static async getUsersStats(req, res) {
        try {
            const [
                totalUsers,
                totalCustomers,
                totalAdmins,
                recentUsers,
                usersWithMostProducts,
                usersWithMostOrders,
            ] = await Promise.all([
                // Total users count
                prisma.user.count(),
                // Total customers
                prisma.user.count({ where: { role: "CUSTOMER" } }),
                // Total admins
                prisma.user.count({ where: { role: "ADMIN" } }),
                // Recent registered users (last 7 days)
                prisma.user.count({
                    where: {
                        created_at: {
                            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                        },
                    },
                }),
                // Users with most products
                prisma.user.findMany({
                    select: {
                        user_id: true,
                        name: true,
                        email: true,
                        _count: {
                            select: {
                                products: true,
                            },
                        },
                    },
                    orderBy: {
                        products: {
                            _count: "desc",
                        },
                    },
                    take: 5,
                }),
                // Users with most orders
                prisma.user.findMany({
                    select: {
                        user_id: true,
                        name: true,
                        email: true,
                        _count: {
                            select: {
                                orders: true,
                            },
                        },
                    },
                    orderBy: {
                        orders: {
                            _count: "desc",
                        },
                    },
                    take: 5,
                }),
            ]);

            res.json({
                total_users: totalUsers,
                total_customers: totalCustomers,
                total_admins: totalAdmins,
                recent_users: recentUsers,
                top_sellers: usersWithMostProducts,
                top_customers: usersWithMostOrders,
            });
        } catch (error) {
            console.error("Get users stats error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    // Search users (Admin only)
    static async searchUsers(req, res) {
        try {
            const { q, role, limit = 10 } = req.query;

            if (!q || q.trim().length < 2) {
                return res.status(400).json({
                    error: "Search query must be at least 2 characters",
                });
            }

            const where = {
                OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { email: { contains: q, mode: "insensitive" } },
                ],
            };

            if (role) where.role = role.toUpperCase();

            const users = await prisma.user.findMany({
                where,
                select: {
                    user_id: true,
                    name: true,
                    email: true,
                    role: true,
                    phone_number: true,
                    created_at: true,
                },
                take: parseInt(limit),
                orderBy: { name: "asc" },
            });

            res.json({
                query: q,
                results: users,
                count: users.length,
            });
        } catch (error) {
            console.error("Search users error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }
}

module.exports = UserController;
