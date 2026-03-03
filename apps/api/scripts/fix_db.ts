import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting DB fix...');
  
  try {
    // 1. Drop dependent policies
    console.log('Dropping dependent policies...');
    await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS "Users can view own appointments" ON appointments;`);
    await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS "Therapists can view patient safety plans" ON safety_plans;`);
    await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS "Therapists can update own profile" ON therapist_profiles;`);
    await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS "Anyone can view verified therapists" ON therapist_profiles;`);
    await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS "Admins and Therapists can manage crisis events" ON crisis_events;`);

    // 2. Rename table (if exists)
    console.log('Renaming table...');
    try {
        await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS public.therapist_profiles RENAME TO companion_profiles;`);
    } catch (e) {
        console.log('Table rename might have failed or already done:', e);
    }

    // 3. Rename column (if exists)
    console.log('Renaming column...');
    try {
        await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS public.appointments RENAME COLUMN therapist_id TO companion_id;`);
    } catch (e) {
        console.log('Column rename might have failed or already done:', e);
    }

    // 4. Recreate policies
    console.log('Recreating policies...');
    await prisma.$executeRawUnsafe(`
      CREATE POLICY "Users can view own appointments" ON appointments
      FOR SELECT USING (auth.uid() = user_id OR auth.uid() = companion_id);
    `);

    await prisma.$executeRawUnsafe(`
      CREATE POLICY "Companions can view patient safety plans" ON safety_plans
      FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM appointments 
            WHERE appointments.user_id = safety_plans.user_id 
            AND appointments.companion_id = auth.uid()
        )
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE POLICY "Companions can update own profile" ON companion_profiles
      FOR UPDATE USING (auth.uid() = id);
    `);

    await prisma.$executeRawUnsafe(`
      CREATE POLICY "Anyone can view verified companions" ON companion_profiles
      FOR SELECT USING (is_verified = true);
    `);

    await prisma.$executeRawUnsafe(`
      CREATE POLICY "Admins and Companions can manage crisis events" ON crisis_events
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid() 
          AND (profiles.role = 'admin' OR profiles.role = 'companion')
        )
      );
    `);
    
    console.log('DB fix completed successfully.');

  } catch (error) {
    console.error('Error executing DB fix:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
