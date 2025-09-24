const { PrismaClient } = require("@prisma/client");
const AuthUtils = require("../utils/auth");

const prisma = new PrismaClient();

class AuthController {
    static async register(req, res) {
        try {
            const { email, password, name } = req.body;

            // Validation
            if (!email || !password || !name) {
                return res
                    .status(400)
                    .json({ error: "All fields are required" });
            }

            // Check if user exists
            const existingUser = await prisma.user.findUnique({
                where: { email },
            });

            if (existingUser) {
                return res.status(400).json({ error: "User already exists" });
            }

            // Hash password & create user
            const hashedPassword = await AuthUtils.hashPassword(password);
            const user = await prisma.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name,
                },
                select: { id: true, email: true, name: true, role: true },
            });

            // Create empty cart for user
            await prisma.cart.create({
                data: { userId: user.id },
            });

            // Generate token
            const token = AuthUtils.generateToken({ userId: user.id });

            res.status(201).json({
                message: "User registered successfully",
                user,
                token,
            });
        } catch (error) {
            console.error("Register error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    static async login(req, res) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res
                    .status(400)
                    .json({ error: "Email and password are required" });
            }

            // Find user
            const user = await prisma.user.findUnique({
                where: { email },
            });

            if (!user) {
                return res.status(401).json({ error: "Invalid credentials" });
            }

            // Check password
            const isValidPassword = await AuthUtils.comparePassword(
                password,
                user.password
            );
            if (!isValidPassword) {
                return res.status(401).json({ error: "Invalid credentials" });
            }

            // Generate token
            const token = AuthUtils.generateToken({ userId: user.id });

            res.json({
                message: "Login successful",
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                },
                token,
            });
        } catch (error) {
            console.error("Login error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }
}

module.exports = AuthController;
