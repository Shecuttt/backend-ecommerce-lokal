const { PrismaClient } = require("@prisma/client");
const AuthUtils = require("../utils/auth");

const prisma = new PrismaClient();

const authenticate = async (req, res, next) => {
    try {
        const token = req.header("Authorization")?.replace("Bearer ", "");

        if (!token) {
            return res
                .status(401)
                .json({ error: "Access denied. No token provided." });
        }

        const decoded = AuthUtils.verifyToken(token);
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, email: true, name: true, role: true },
        });

        if (!user) {
            return res.status(401).json({ error: "Invalid token." });
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ error: "Invalid token." });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res
                .status(403)
                .json({ error: "Access denied. Insufficient permissions." });
        }
        next();
    };
};

module.exports = { authenticate, authorize };
