const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  try {
    const id = "b53646f9-8d29-46e5-8fd6-c580f0740e42";
    await prisma.profiles.update({
      where: { id },
      data: { role: "super_admin" },
    });
    console.log(`Set role to super_admin for profile ${id}`);
  } catch (error) {
    console.error("Failed to set super_admin role:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

