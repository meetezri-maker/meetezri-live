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

async function findAuthUserByEmail(targetEmail) {
  let page = 1;
  const perPage = 200;

  while (true) {
    const {
      data,
      error,
    } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    const users = data?.users || [];
    const user = users.find((candidate) => candidate.email === targetEmail);

    if (user) {
      return user;
    }

    if (users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

async function main() {
  try {
    console.log(`Ensuring admin user exists for ${email}...`);

    let user = await findAuthUserByEmail(email);

    if (!user) {
      console.log('User not found in auth.users, creating...');
      const { data, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: {
          role: 'super_admin',
          app_role: 'super_admin',
        },
      });

      if (createError) {
        if (createError.code === 'email_exists') {
          user = await findAuthUserByEmail(email);
        }
      }

      if (createError && !user) {
        console.error('Error creating Supabase user:', createError);
        process.exit(1);
      }

      if (!user) {
        user = data.user;
      }

      console.log('Using Supabase user with id:', user.id);
    } else {
      console.log('Found existing Supabase user with id:', user.id);
    }

    const userId = user.id;

    const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      app_metadata: {
        ...(user.app_metadata || {}),
        role: 'super_admin',
        app_role: 'super_admin',
      },
    });

    if (updateAuthError) {
      console.error('Error updating auth user metadata/password:', updateAuthError);
    } else {
      console.log('Auth user password and admin metadata updated.');
    }

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

