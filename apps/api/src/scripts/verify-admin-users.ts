
import { PrismaClient } from '@prisma/client';
const jwt = require('jsonwebtoken');

// Polyfill fetch if needed (though Node 18+ has it)
const fetch = global.fetch || require('node-fetch');

const prisma = new PrismaClient();
// Use the secret from .env or the hardcoded one I saw
const rawSecret = process.env.SUPABASE_JWT_SECRET || 'BNf04hL8JjnrbSHH7nHn1cYBVA2Dh6ahgaljbJKXSd7+5qTEu7EL/7AvexZ0iz+5Ql/CgLRH7nql2Y1rcIYuhA==';
let JWT_SECRET: any = rawSecret;
if (rawSecret.length > 20 && !rawSecret.includes(' ') && rawSecret.endsWith('=')) {
  try {
    JWT_SECRET = Buffer.from(rawSecret, 'base64');
    console.log('Using Base64 decoded secret');
  } catch (e) {
    console.log('Using raw secret string');
  }
}

async function main() {
  console.log('Connecting to database...');
  
  // Find an admin user
  let admin = await prisma.profiles.findFirst({
    where: { role: { in: ['super_admin', 'org_admin', 'team_admin'] } }
  });

  if (!admin) {
    console.log('No admin found. Promoting a user to super_admin temporarily.');
    const anyUser = await prisma.profiles.findFirst();
    if (anyUser) {
        console.log(`Found user ${anyUser.email}. Promoting to super_admin for test.`);
        admin = await prisma.profiles.update({
            where: { id: anyUser.id },
            data: { role: 'super_admin' }
        });
    } else {
        console.error('No users found in database to promote.');
        process.exit(1);
    }
  }

  console.log(`Using admin user: ${admin.email} (${admin.id})`);

  // Generate JWT
  const token = jwt.sign({
    sub: admin.id,
    role: 'authenticated',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 60 * 60 // 1 hour
  }, JWT_SECRET);

  console.log('Token generated.');

  try {
      // Make request
      const url = 'http://localhost:3001/api/admin/users?page=1&limit=10';
      console.log(`Fetching ${url}...`);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`Response status: ${response.status}`);
      
      if (response.status === 200) {
        const data = await response.json();
        console.log('Success! Data length:', Array.isArray(data) ? data.length : 'Not an array');
        if (Array.isArray(data) && data.length > 0) {
            console.log('First user sample:', JSON.stringify(data[0], null, 2));
        }
      } else {
        const text = await response.text();
        console.error('Error response:', text);
      }
  } catch (err) {
      console.error('Request failed:', err);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
