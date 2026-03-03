
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const userId = 'b53646f9-8d29-46e5-8fd6-c580f0740e42'; // The correct Auth ID for saifali87154@gmail.com
const email = 'saifali87154@gmail.com';

async function main() {
  console.log(`Promoting user ${userId} to super_admin...`);

  try {
    const updatedProfile = await prisma.profiles.update({
      where: { id: userId },
      data: {
        role: 'super_admin',
        email: email // Update email as well since it was null
      },
    });
    console.log('Profile updated successfully:', updatedProfile);
  } catch (error) {
    console.error('Error updating profile:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
