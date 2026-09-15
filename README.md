# Surprizyy Form Builder V2

React + JavaScript + CSS + Supabase (with Auth + RLS).

## Run
1. Install Node.js.
2. Open this folder in VS Code.
3. Run `npm install`
4. Copy `.env.example` to `.env` and add your Supabase URL + anon key.
5. Run `npm run dev`.

User panel: `/`
Admin panel: `/admin` (requires login — see below)

## Supabase setup
1. Run `supabase_schema.sql` in Supabase SQL Editor. This creates the tables,
   enables Row Level Security, and sets up the access policies.
2. Create a Storage bucket named exactly `submission-images` (Dashboard ->
   Storage). Leave it Private — the storage policies in the SQL file control
   access, not bucket-level publicity.
3. Create your admin login: Dashboard -> Authentication -> Users -> Add user.
   Set an email + password and tick "Auto Confirm User". Log in with that
   email/password at `/admin`.
4. Recommended: Authentication -> Providers -> Email -> turn off "Allow new
   users to sign up", so nobody can self-register an admin account.

The app works in demo/local state if Supabase credentials are not configured
(admin is open with no login in that case, since there's nothing to protect).

## Security notes
- `/admin` now requires a real Supabase Auth session, not just a client-side
  password — the previous version's password check lived in the JS bundle
  and could be read by anyone, which is no longer the case.
- Row Level Security policies mean even someone with your public anon key
  cannot read customer submissions or write to any table without being
  logged in as an admin. Customers can still submit forms and upload images
  without logging in — that's the only thing the public role is allowed to do.
- If you ever add more tables, remember RLS is OFF by default on new tables —
  you must explicitly enable it and add policies, or that table is wide open.

