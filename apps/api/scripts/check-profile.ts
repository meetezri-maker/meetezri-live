import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const email = 'saifali87154@gmail.com';

async function main() {
  console.log(`Checking profile for email: ${email}`);
  
  // First get the user from profiles by email (if email is stored there)
  // Or better, search by ID if we know it, but we only have email handy.
  // The profiles table usually has an ID that matches auth.users ID.
  // It also has an 'email' field based on previous context.

  const profile = await prisma.profiles.findFirst({
    where: { email: email }
  });

  if (profile) {
    console.log('Profile FOUND:', profile);
  } else {
    console.log('Profile NOT FOUND for email:', email);
    
    // Let's list all profiles to see what's there
    const allProfiles = await prisma.profiles.findMany();
    console.log('All profiles:', allProfiles);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
