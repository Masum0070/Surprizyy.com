-- Surprizyy schema (V2: includes Supabase Auth + RLS for admin protection)

create extension if not exists pgcrypto;

-- If you already ran this schema before price existed, this adds it safely:
-- alter table templates add column if not exists price numeric(10,2) default 0;
-- alter table templates add column if not exists preview_urls jsonb default '[]'::jsonb;

create table if not exists gift_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text default '🎁',
  active boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid references gift_types(id) on delete cascade,
  name text not null,
  description text default '',
  price numeric(10,2) default 0,
  preview_url text default '',
  preview_urls jsonb default '[]'::jsonb,
  active boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table if not exists form_sections (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references templates(id) on delete cascade,
  title text not null,
  active boolean default true,
  sort_order int default 0
);

create table if not exists form_fields (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references form_sections(id) on delete cascade,
  type text not null,
  label text not null,
  placeholder text default '',
  required boolean default false,
  active boolean default true,
  sort_order int default 0,
  max_files int default 5,
  options jsonb default '[]'::jsonb
);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid references gift_types(id) on delete set null,
  template_id uuid references templates(id) on delete set null,
  customer_name text,
  status text default 'New',
  created_at timestamptz default now()
);

create table if not exists submission_values (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references submissions(id) on delete cascade,
  field_id uuid references form_fields(id) on delete set null,
  value_json jsonb
);

create table if not exists submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references submissions(id) on delete cascade,
  field_id uuid references form_fields(id) on delete set null,
  file_path text not null,
  file_name text
);

-- Create a Storage bucket named exactly:
-- submission-images
-- You can create it from Supabase Dashboard > Storage.
-- (Recommend leaving the bucket "Private" — access is controlled by the
-- storage policies below, not by the bucket being public.)

-- =========================================================================
-- ROW LEVEL SECURITY (RLS)
-- =========================================================================
-- This is what actually protects the database. Without this, anyone who has
-- your public anon key (which is always visible in the frontend, by design)
-- could read or write any row directly, bypassing your admin login entirely.
--
-- The pattern used everywhere below:
--   - anon   (not logged in, i.e. any customer on the public site) can only
--             do exactly what the customer-facing flow needs: read the
--             catalog (gifts/templates/sections/fields), and create new
--             submissions/values/files. Nothing else.
--   - authenticated (a real Supabase Auth admin user, logged in at /admin)
--             can read and write everything.
--
-- Run this whole block once. If you need to re-run it later, drop the
-- existing policies first (DROP POLICY IF EXISTS "..." ON table_name;)
-- or you'll get "policy already exists" errors.

alter table gift_types enable row level security;
alter table templates enable row level security;
alter table form_sections enable row level security;
alter table form_fields enable row level security;
alter table submissions enable row level security;
alter table submission_values enable row level security;
alter table submission_files enable row level security;

-- Catalog tables: public read, admin-only write
create policy "Public can read gift types" on gift_types for select using (true);
create policy "Admins can manage gift types" on gift_types for all to authenticated using (true) with check (true);

create policy "Public can read templates" on templates for select using (true);
create policy "Admins can manage templates" on templates for all to authenticated using (true) with check (true);

create policy "Public can read form sections" on form_sections for select using (true);
create policy "Admins can manage form sections" on form_sections for all to authenticated using (true) with check (true);

create policy "Public can read form fields" on form_fields for select using (true);
create policy "Admins can manage form fields" on form_fields for all to authenticated using (true) with check (true);

-- Submission tables: contain customer PII, so no public read at all.
-- Public (anon) can only INSERT (submit a form). Admins can read/update/delete.
create policy "Anyone can submit a form" on submissions for insert to anon, authenticated with check (true);
create policy "Admins can manage submissions" on submissions for all to authenticated using (true) with check (true);

create policy "Anyone can submit form values" on submission_values for insert to anon, authenticated with check (true);
create policy "Admins can manage submission values" on submission_values for all to authenticated using (true) with check (true);

create policy "Anyone can submit form files" on submission_files for insert to anon, authenticated with check (true);
create policy "Admins can manage submission files" on submission_files for all to authenticated using (true) with check (true);

-- Storage: customers can upload to the submission-images bucket; only
-- admins can view or delete what's in it.
create policy "Anyone can upload submission images"
on storage.objects for insert to anon, authenticated
with check (bucket_id = 'submission-images');

create policy "Admins can manage submission images"
on storage.objects for all to authenticated
using (bucket_id = 'submission-images')
with check (bucket_id = 'submission-images');

-- =========================================================================
-- CREATE YOUR ADMIN LOGIN
-- =========================================================================
-- 1. In Supabase Dashboard: Authentication -> Users -> Add user
-- 2. Set an email + password, and tick "Auto Confirm User" so it's usable
--    immediately without an email confirmation step.
-- 3. Go to /admin on your site and log in with that email + password.
-- 4. (Recommended) Under Authentication -> Providers -> Email, turn OFF
--    "Allow new users to sign up" so nobody else can self-register an
--    admin account.
