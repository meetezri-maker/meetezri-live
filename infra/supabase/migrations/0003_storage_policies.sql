-- Create the avatars bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Enable RLS on storage.objects (usually enabled by default, but good to ensure)
alter table storage.objects enable row level security;

-- Policy: Public Read Access
drop policy if exists "Public Access to Avatars" on storage.objects;
create policy "Public Access to Avatars"
  on storage.objects for select
  using ( bucket_id = 'avatars' );

-- Policy: Authenticated users can upload avatars
-- Restricts uploads to a folder named after their user ID
drop policy if exists "Authenticated users can upload avatars" on storage.objects;
create policy "Authenticated users can upload avatars"
  on storage.objects for insert
  to authenticated
  with check ( 
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text 
  );

-- Policy: Authenticated users can update their own avatars
drop policy if exists "Authenticated users can update avatars" on storage.objects;
create policy "Authenticated users can update avatars"
  on storage.objects for update
  to authenticated
  using ( 
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text 
  );

-- Policy: Authenticated users can delete their own avatars
drop policy if exists "Authenticated users can delete avatars" on storage.objects;
create policy "Authenticated users can delete avatars"
  on storage.objects for delete
  to authenticated
  using ( 
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text 
  );
