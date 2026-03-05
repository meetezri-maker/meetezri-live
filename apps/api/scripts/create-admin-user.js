const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from apps/api/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;

// Prefer SUPABASE_SERVICE_KEY but fall back to older naming if present
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase admin credentials (SUPABASE_URL / SUPABASE_SERVICE_KEY)');
  process.exit(1);
}

const prisma = new PrismaClient();
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const email = 'saifali87154@gmail.com';
const password = 'Password123!';

async function main() {
  try {
    console.log(`Ensuring admin user exists for ${email}...`);

    // 1. Find or create Supabase auth user
    const {
      data: { users },
      error: listError,
    } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error('Error listing Supabase users:', listError);
      process.exit(1);
    }

    let user = users.find((u) => u.email === email);

    if (!user) {
      console.log('User not found in auth.users, creating...');
      const { data, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createError) {
        console.error('Error creating Supabase user:', createError);
        process.exit(1);
      }

      user = data.user;
      console.log('Created Supabase user with id:', user.id);
    } else {
      console.log('Found existing Supabase user with id:', user.id);

      // Optionally reset password to ensure it matches what the UI expects
      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password,
      });
      if (passwordError) {
        console.error('Error updating password:', passwordError);
      } else {
        console.log('Password updated for existing user.');
      }
    }

    const userId = user.id;

    // 2. Ensure a profile exists with super_admin role
    console.log('Upserting profile with super_admin role...');
    const profile = await prisma.profiles.upsert({
      where: { id: userId },
      update: {
        email,
        role: 'super_admin',
        account_status: 'active',
      },
      create: {
        id: userId,
        email,
        role: 'super_admin',
        account_status: 'active',
      },
    });

    console.log('Profile upserted:', {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      account_status: profile.account_status,
    });

    console.log('\n✅ Admin user is ready:');
    console.log(`   Email:    ${email}`);
    console.log(`   Password: ${password}`);
  } catch (err) {
    console.error('Failed to create admin user:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

