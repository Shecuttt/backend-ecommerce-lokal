const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

class ProductController {
    // Get all products with pagination & filtering
    static async getProducts(req, res) {
        try {
            const {
                page = 1,
                limit = 10,
                category,
                search,
                sortBy = "created_at",
                sortOrder = "desc",
            } = req.query;

            const skip = (parseInt(page) - 1) * parseInt(limit);
            const take = parseInt(limit);

            // Build where clause
            const where = {};
            if (category) where.category = category;
            if (search) {
                where.OR = [
                    { name: { contains: search, mode: "insensitive" } },
                    { description: { contains: search, mode: "insensitive" } },
                ];
            }

            // Get products with pagination
            const [products, totalCount] = await Promise.all([
                prisma.product.findMany({
                    where,
                    skip,
                    take,
                    orderBy: { [sortBy]: sortOrder },
                }),
                prisma.product.count({ where }),
            ]);

            res.json({
                products,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalCount,
                    totalPages: Math.ceil(totalCount / take),
                },
            });
        } catch (error) {
            console.error("Get products error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    // Get single product
    static async getProduct(req, res) {
        try {
            const { id } = req.params;

            const product = await prisma.product.findUnique({
                where: { id },
            });

            if (!product) {
                return res.status(404).json({ error: "Product not found" });
            }

            res.json(product);
        } catch (error) {
            console.error("Get product error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    // Create product (Admin only)
    static async createProduct(req, res) {
        try {
            const { name, description, price, stock, imageUrl, category } =
                req.body;

            if (!name || !price || !category) {
                return res
                    .status(400)
                    .json({ error: "Name, price, and category are required" });
            }

            if (price <= 0) {
                return res
                    .status(400)
                    .json({ error: "Price must be greater than 0" });
            }

            const product = await prisma.product.create({
                data: {
                    name,
                    description,
                    price: parseInt(price),
                    stock: parseInt(stock) || 0,
                    imageUrl,
                    category,
                },
            });

            res.status(201).json({
                message: "Product created successfully",
                product,
            });
        } catch (error) {
            console.error("Create product error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    // Update product (Admin only)
    static async updateProduct(req, res) {
        try {
            const { id } = req.params;
            const { name, description, price, stock, imageUrl, category } =
                req.body;

            const existingProduct = await prisma.product.findUnique({
                where: { id },
            });

            if (!existingProduct) {
                return res.status(404).json({ error: "Product not found" });
            }

            const updateData = {};
            if (name !== undefined) updateData.name = name;
            if (description !== undefined) updateData.description = description;
            if (price !== undefined) updateData.price = parseInt(price);
            if (stock !== undefined) updateData.stock = parseInt(stock);
            if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
            if (category !== undefined) updateData.category = category;

            const product = await prisma.product.update({
                where: { id },
                data: updateData,
            });

            res.json({
                message: "Product updated successfully",
                product,
            });
        } catch (error) {
            console.error("Update product error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    // Delete product (Admin only)
    static async deleteProduct(req, res) {
        try {
            const { id } = req.params;

            const existingProduct = await prisma.product.findUnique({
                where: { id },
            });

            if (!existingProduct) {
                return res.status(404).json({ error: "Product not found" });
            }

            await prisma.product.delete({
                where: { id },
            });

            res.json({ message: "Product deleted successfully" });
        } catch (error) {
            console.error("Delete product error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }
}

module.exports = ProductController;
