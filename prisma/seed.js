const { PrismaClient } = require("@prisma/client");
const AuthUtils = require("../src/utils/auth");

const prisma = new PrismaClient();

async function main() {
    // Create admin user
    const adminPassword = await AuthUtils.hashPassword("admin123");
    const admin = await prisma.user.create({
        data: {
            name: "Admin User",
            email: "admin@example.com",
            password_hash: adminPassword,
            role: "ADMIN",
            phone_number: "+62812345678",
        },
    });

    // Create customer user
    const customerPassword = await AuthUtils.hashPassword("customer123");
    const customer = await prisma.user.create({
        data: {
            name: "John Doe",
            email: "customer@example.com",
            password_hash: customerPassword,
            role: "CUSTOMER",
            phone_number: "+62987654321",
        },
    });

    // Create cart for customer
    await prisma.cart.create({
        data: { user_id: customer.user_id },
    });

    // Create sample products (admin sebagai seller)
    const products = [
        {
            user_id: admin.user_id,
            name: "iPhone 15 Pro",
            description: "Latest iPhone with titanium design",
            price: 99900,
            stock: 50,
            image_url: "https://example.com/iphone15.jpg",
        },
        {
            user_id: admin.user_id,
            name: "MacBook Air M2",
            description: "Lightweight laptop with M2 chip",
            price: 119900,
            stock: 30,
            image_url: "https://example.com/macbook.jpg",
        },
    ];

    for (const product of products) {
        await prisma.product.create({ data: product });
    }

    console.log("🌱 Database seeded successfully!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
