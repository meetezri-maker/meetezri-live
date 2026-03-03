-- Drop dependent policies first
DROP POLICY IF EXISTS "Users can view own appointments" ON appointments;
DROP POLICY IF EXISTS "Therapists can view patient safety plans" ON safety_plans;
DROP POLICY IF EXISTS "Therapists can update own profile" ON therapist_profiles;
DROP POLICY IF EXISTS "Anyone can view verified therapists" ON therapist_profiles;
DROP POLICY IF EXISTS "Admins and Therapists can manage crisis events" ON crisis_events;

-- Rename table therapist_profiles to companion_profiles
ALTER TABLE IF EXISTS public.therapist_profiles RENAME TO companion_profiles;

-- Rename column therapist_id to companion_id in appointments table
ALTER TABLE IF EXISTS public.appointments RENAME COLUMN therapist_id TO companion_id;

-- Recreate policies for appointments
CREATE POLICY "Users can view own appointments" ON appointments
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = companion_id);

-- Recreate policies for safety_plans
CREATE POLICY "Companions can view patient safety plans" ON safety_plans
  FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM appointments 
        WHERE appointments.user_id = safety_plans.user_id 
        AND appointments.companion_id = auth.uid()
    )
  );

-- Recreate policies for companion_profiles
CREATE POLICY "Companions can update own profile" ON companion_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Anyone can view verified companions" ON companion_profiles
  FOR SELECT USING (is_verified = true);

-- Update crisis_events policy
CREATE POLICY "Admins and Companions can manage crisis events" ON crisis_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND (profiles.role = 'admin' OR profiles.role = 'companion')
    )
  );
